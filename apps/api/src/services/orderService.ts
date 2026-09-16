import type { PrismaClient } from "@prisma/client";
import type { OrderQuote } from "@scos/shared-types";
import { allocateOrder, calculateShippingCost } from "../domain/allocation.js";
import { haversineDistance } from "../domain/distance.js";
import { calculateOrder } from "../domain/orderCalculator.js";
import { calculatePricing } from "../domain/pricing.js";
import type { WarehouseWithStock } from "../domain/types.js";

export class InsufficientStockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsufficientStockError";
  }
}

export class InvalidOrderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidOrderError";
  }
}

function toQuote(
  calc: ReturnType<typeof calculateOrder>
): OrderQuote {
  return {
    subtotal: calc.pricing.subtotal,
    discountPercent: calc.pricing.discountPercent,
    discountAmount: calc.pricing.discountAmount,
    shippingCost: calc.shippingCost,
    total: calc.total,
    valid: calc.valid,
    reason: calc.reason,
    fulfillmentPlan: calc.allocation.legs.map((leg) => ({
      warehouseId: leg.warehouse.id,
      warehouseName: leg.warehouse.name,
      quantity: leg.quantity,
      distanceKm: Math.round(leg.distanceKm * 100) / 100,
      shippingCost: Math.round(leg.shippingCost * 100) / 100,
    })),
  };
}

export function createOrderService(prisma: PrismaClient) {
  async function getWarehousesWithStock(): Promise<WarehouseWithStock[]> {
    const warehouses = await prisma.warehouse.findMany({
      include: { stock: true },
      orderBy: { id: "asc" },
    });
    return warehouses.map((w) => ({
      id: w.id,
      name: w.name,
      latitude: w.latitude,
      longitude: w.longitude,
      stock: w.stock[0]?.quantity ?? 0,
    }));
  }

  return {
    async verifyOrder(
      quantity: number,
      latitude: number,
      longitude: number
    ): Promise<OrderQuote> {
      const warehouses = await getWarehousesWithStock();
      const calc = calculateOrder(warehouses, quantity, { latitude, longitude });
      return toQuote(calc);
    },

    async submitOrder(
      quantity: number,
      latitude: number,
      longitude: number
    ): Promise<{ orderNumber: string; quote: OrderQuote }> {
      return prisma.$transaction(async (tx) => {
        const rawStocks = await tx.$queryRawUnsafe<
          Array<{
            warehouse_id: number;
            product_id: number;
            quantity: number;
            name: string;
            latitude: number;
            longitude: number;
          }>
        >(
          `SELECT ws.warehouse_id, ws.product_id, ws.quantity, w.name, w.latitude, w.longitude
           FROM warehouse_stock ws
           JOIN warehouses w ON w.id = ws.warehouse_id
           WHERE ws.product_id = 1
           ORDER BY ws.warehouse_id ASC
           FOR UPDATE OF ws`
        );

        const warehouses: WarehouseWithStock[] = rawStocks.map((r) => ({
          id: r.warehouse_id,
          name: r.name,
          latitude: r.latitude,
          longitude: r.longitude,
          stock: r.quantity,
        }));

        const calc = calculateOrder(warehouses, quantity, {
          latitude,
          longitude,
        });

        if (!calc.valid) {
          if (!calc.allocation.fulfilled) {
            throw new InsufficientStockError(calc.reason!);
          }
          throw new InvalidOrderError(calc.reason!);
        }

        for (const leg of calc.allocation.legs) {
          await tx.$executeRawUnsafe(
            `UPDATE warehouse_stock SET quantity = quantity - $1
             WHERE warehouse_id = $2 AND product_id = 1`,
            leg.quantity,
            leg.warehouse.id
          );
        }

        const [seqResult] = await tx.$queryRawUnsafe<Array<{ nextval: string }>>(
          `SELECT nextval('order_number_seq')`
        );
        const orderNumber = `ORD-${seqResult.nextval.padStart(6, "0")}`;

        const order = await tx.order.create({
          data: {
            orderNumber,
            quantity,
            subtotal: calc.pricing.subtotal,
            discountAmount: calc.pricing.discountAmount,
            shippingCost: calc.shippingCost,
            total: calc.total,
            latitude,
            longitude,
            lines: {
              create: {
                productId: 1,
                quantity,
                unitPrice: calc.pricing.unitPrice,
                discountPercent: calc.pricing.discountPercent,
                fulfillments: {
                  create: calc.allocation.legs.map((leg) => ({
                    warehouseId: leg.warehouse.id,
                    quantity: leg.quantity,
                    distanceKm: Math.round(leg.distanceKm * 100) / 100,
                    shippingCost: Math.round(leg.shippingCost * 100) / 100,
                  })),
                },
              },
            },
          },
        });

        return {
          orderNumber: order.orderNumber,
          quote: toQuote(calc),
        };
      });
    },
  };
}

export type OrderService = ReturnType<typeof createOrderService>;
