import type { Prisma, PrismaClient } from "@prisma/client";
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

    // Row-locks the product's stock rows until the transaction ends, so
    // concurrent submissions serialize and cannot oversell.
    async lockStockForUpdate(
      tx: Prisma.TransactionClient,
      productId: number
    ): Promise<WarehouseWithStock[]> {
      const rows = await tx.$queryRawUnsafe<
        Array<{
          warehouse_id: number;
          quantity: number;
          name: string;
          latitude: number;
          longitude: number;
        }>
      >(
        `SELECT ws.warehouse_id, ws.quantity, w.name, w.latitude, w.longitude
         FROM warehouse_stock ws
         JOIN warehouses w ON w.id = ws.warehouse_id
         WHERE ws.product_id = $1
         ORDER BY ws.warehouse_id ASC
         FOR UPDATE OF ws`,
        productId
      );

      return rows.map((r) => ({
        id: r.warehouse_id,
        name: r.name,
        latitude: r.latitude,
        longitude: r.longitude,
        stock: r.quantity,
      }));
    },

    async decrementStock(
      tx: Prisma.TransactionClient,
      productId: number,
      warehouseId: number,
      quantity: number
    ): Promise<void> {
      await tx.$executeRawUnsafe(
        `UPDATE warehouse_stock SET quantity = quantity - $1, updated_at = NOW()
         WHERE warehouse_id = $2 AND product_id = $3`,
        quantity,
        warehouseId,
        productId
      );
    },
  };
}

export type WarehouseRepository = ReturnType<typeof createWarehouseRepository>;
