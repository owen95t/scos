import { PrismaClient } from "@prisma/client";
import { createOrderRepository } from "./repositories/orderRepository.ts";
import { createWarehouseRepository } from "./repositories/warehouseRepository.ts";
import { createAuditService } from "./services/auditService.ts";
import { createOrderService } from "./services/orderService.ts";

export function createContainer() {
  const prisma = new PrismaClient();
  const warehouseRepository = createWarehouseRepository(prisma);
  const orderRepository = createOrderRepository(prisma);
  const auditService = createAuditService(prisma);
  const orderService = createOrderService({
    prisma,
    warehouseRepository,
    orderRepository,
    auditService,
  });

  return {
    prisma,
    warehouseRepository,
    orderRepository,
    auditService,
    orderService,
  };
}
