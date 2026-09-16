import type { PrismaClient } from "@prisma/client";
import type { OrderQuote } from "@scos/shared-types";
import { allocateOrder, calculateShippingCost } from "../domain/allocation.js";
import { haversineDistance } from "../domain/distance.js";
import { calculateOrder } from "../domain/orderCalculator.js";
import { calculatePricing } from "../domain/pricing.js";
import type { WarehouseWithStock } from "../domain/types.js";
import type { Logger } from "../types/logger.js";

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
      log: Logger,
      quantity: number,
      latitude: number,
      longitude: number
    ): Promise<OrderQuote> {
      log.info({ quantity, latitude, longitude }, "verifying order");
      const warehouses = await getWarehousesWithStock();
      log.debug({ warehouseCount: warehouses.length, totalStock: warehouses.reduce((s, w) => s + w.stock, 0) }, "warehouses loaded");
      const calc = calculateOrder(warehouses, quantity, { latitude, longitude });
      log.info({
        valid: calc.valid,
        allocationLegs: calc.allocation.legs.length,
        shippingCost: calc.shippingCost,
        total: calc.total,
        ...(calc.reason && { reason: calc.reason }),
      }, "order verified");
      return toQuote(calc);
    },

    async submitOrder(
      log: Logger,
      quantity: number,
      latitude: number,
      longitude: number
    ): Promise<{ orderNumber: string; quote: OrderQuote }> {
      log.info({ quantity, latitude, longitude }, "submitting order");
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

        log.debug({ warehouseCount: warehouses.length }, "stock locked for allocation");

        const calc = calculateOrder(warehouses, quantity, {
          latitude,
          longitude,
        });

        if (!calc.valid) {
          if (!calc.allocation.fulfilled) {
            log.warn({ requested: quantity, available: calc.allocation.fulfilledQuantity }, "insufficient stock");
            throw new InsufficientStockError(calc.reason!);
          }
          log.warn({ reason: calc.reason }, "invalid order");
          throw new InvalidOrderError(calc.reason!);
        }

        log.info({
          legs: calc.allocation.legs.map(l => ({
            warehouseId: l.warehouse.id,
            qty: l.quantity,
            distanceKm: Math.round(l.distanceKm),
          })),
        }, "allocation decided");

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

        log.info({ orderNumber: order.orderNumber, total: calc.total }, "order created");

        return {
          orderNumber: order.orderNumber,
          quote: toQuote(calc),
        };
      });
    },
  };
}

export type OrderService = ReturnType<typeof createOrderService>;
