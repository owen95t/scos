import type { PrismaClient } from "@prisma/client";
import type { WarehouseWithStock } from "../domain/types.js";

export function createWarehouseRepository(prisma: PrismaClient) {
  return {
    async getAll() {
      return prisma.warehouse.findMany({
        include: {
          stock: { include: { product: true } },
        },
        orderBy: { id: "asc" },
      });
    },

    async getWithStock(productId: number): Promise<WarehouseWithStock[]> {
      const warehouses = await prisma.warehouse.findMany({
        include: {
          stock: {
            where: { productId },
          },
        },
        orderBy: { id: "asc" },
      });

      return warehouses.map((w) => ({
        id: w.id,
        name: w.name,
        latitude: w.latitude,
        longitude: w.longitude,
        stock: w.stock[0]?.quantity ?? 0,
      }));
    },
  };
}

export type WarehouseRepository = ReturnType<typeof createWarehouseRepository>;
