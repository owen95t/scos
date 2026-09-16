import { PrismaClient } from "@prisma/client";
import { createOrderRepository } from "./repositories/orderRepository.js";
import { createWarehouseRepository } from "./repositories/warehouseRepository.js";
import { createAuditService } from "./services/auditService.js";
import { createOrderService } from "./services/orderService.js";

export function createContainer() {
  const prisma = new PrismaClient();
  const warehouseRepository = createWarehouseRepository(prisma);
  const orderRepository = createOrderRepository(prisma);
  const auditService = createAuditService(prisma);
  const orderService = createOrderService(prisma, auditService);

  return {
    prisma,
    warehouseRepository,
    orderRepository,
    auditService,
    orderService,
  };
}
