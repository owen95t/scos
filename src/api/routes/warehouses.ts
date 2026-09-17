import type { FastifyPluginAsync } from "fastify";
import type { WarehouseRepository } from "../../repositories/warehouseRepository.js";

export function warehouseRoutes(
  warehouseRepository: WarehouseRepository
): FastifyPluginAsync {
  return async function (fastify) {
    fastify.get("/warehouses", async () => {
      return warehouseRepository.getAll();
    });
  };
}
