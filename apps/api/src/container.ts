import { PrismaClient } from "@prisma/client";
import { createOrderRepository } from "./repositories/orderRepository.js";
import { createWarehouseRepository } from "./repositories/warehouseRepository.js";
import { createOrderService } from "./services/orderService.js";

export function createContainer() {
  const prisma = new PrismaClient();
  const warehouseRepository = createWarehouseRepository(prisma);
  const orderRepository = createOrderRepository(prisma);
  const orderService = createOrderService(prisma);

  return {
    prisma,
    warehouseRepository,
    orderRepository,
    orderService,
  };
}
