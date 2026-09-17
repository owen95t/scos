import type { PrismaClient } from "@prisma/client";
import { WAREHOUSES } from "../../prisma/seedData.ts";
import { PRODUCT_ID } from "../../src/domain/product.ts";

// Clears order data and restores seeded stock levels.
export async function resetDb(prisma: PrismaClient): Promise<void> {
  await prisma.orderFulfillment.deleteMany();
  await prisma.orderLine.deleteMany();
  await prisma.order.deleteMany();

  for (const wh of WAREHOUSES) {
    await prisma.warehouseStock.updateMany({
      where: { productId: PRODUCT_ID, warehouse: { name: wh.name } },
      data: { quantity: wh.stock },
    });
  }
}

export async function warehouseIdByName(prisma: PrismaClient, name: string): Promise<number> {
  const warehouse = await prisma.warehouse.findUniqueOrThrow({ where: { name } });
  return warehouse.id;
}
