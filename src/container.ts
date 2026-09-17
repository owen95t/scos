import { PrismaClient } from "@prisma/client";
import { createOrderRepository } from "./repositories/orderRepository.ts";
import { createWarehouseRepository } from "./repositories/warehouseRepository.ts";
import { createOrderService } from "./services/orderService.ts";

export function createContainer() {
  const prisma = new PrismaClient();
  const warehouseRepository = createWarehouseRepository(prisma);
  const orderRepository = createOrderRepository(prisma);
  const orderService = createOrderService({
    prisma,
    warehouseRepository,
    orderRepository,
  });

  return {
    prisma,
    warehouseRepository,
    orderRepository,
    orderService,
  };
}
