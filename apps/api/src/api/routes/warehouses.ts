import type { FastifyPluginAsync } from "fastify";
import type { WarehouseRepository } from "../../repositories/warehouseRepository.js";

export function warehouseRoutes(
  warehouseRepository: WarehouseRepository
): FastifyPluginAsync {
  return async function (fastify) {
    fastify.get("/warehouses", async () => {
      const warehouses = await warehouseRepository.getAll();
      return warehouses.map((w) => ({
        id: w.id,
        name: w.name,
        latitude: w.latitude,
        longitude: w.longitude,
        stock: w.stock.map((s) => ({
          productId: s.productId,
          productName: s.product.name,
          quantity: s.quantity,
        })),
      }));
    });
  };
}
