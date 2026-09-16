import type { PrismaClient } from "@prisma/client";

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
  };
}

export type OrderRepository = ReturnType<typeof createOrderRepository>;
