import type { Prisma, PrismaClient } from "@prisma/client";
import type { OrderCalculation } from "../domain/types.js";

export interface NewOrder {
  orderNumber: string;
  productId: number;
  quantity: number;
  latitude: number;
  longitude: number;
  calc: OrderCalculation;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function createOrderRepository(prisma: PrismaClient) {
  return {
    async findByOrderNumber(orderNumber: string) {
      return prisma.order.findUnique({
        where: { orderNumber },
        include: {
          lines: {
            include: {
              product: true,
              fulfillments: {
                include: { warehouse: true },
              },
            },
          },
        },
      });
    },

    async nextOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
      // nextval() comes back as BigInt from Prisma.
      const [row] = await tx.$queryRawUnsafe<Array<{ nextval: bigint }>>(
        `SELECT nextval('order_number_seq')`
      );
      return `ORD-${String(row.nextval).padStart(6, "0")}`;
    },

    async create(tx: Prisma.TransactionClient, order: NewOrder) {
      const { calc } = order;
      return tx.order.create({
        data: {
          orderNumber: order.orderNumber,
          quantity: order.quantity,
          subtotal: calc.pricing.subtotal,
          discountAmount: calc.pricing.discountAmount,
          shippingCost: calc.shippingCost,
          total: calc.total,
          latitude: order.latitude,
          longitude: order.longitude,
          lines: {
            create: {
              productId: order.productId,
              quantity: order.quantity,
              unitPrice: calc.pricing.unitPrice,
              discountPercent: calc.pricing.discountPercent,
              fulfillments: {
                create: calc.allocation.legs.map((leg) => ({
                  warehouseId: leg.warehouse.id,
                  quantity: leg.quantity,
                  distanceKm: round2(leg.distanceKm),
                  shippingCost: round2(leg.shippingCost),
                })),
              },
            },
          },
        },
      });
    },
  };
}

export type OrderRepository = ReturnType<typeof createOrderRepository>;
