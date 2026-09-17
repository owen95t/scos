import { PrismaClient } from "@prisma/client";
import { WAREHOUSES } from "./seedData.ts";

const prisma = new PrismaClient();

async function main() {
  const product = await prisma.product.upsert({
    where: { sku: "SCOS-P1-PRO" },
    update: {},
    create: {
      sku: "SCOS-P1-PRO",
      name: "SCOS Station P1 Pro",
      unitPrice: 150,
      weightGrams: 365,
    },
  });

  for (const wh of WAREHOUSES) {
    const warehouse = await prisma.warehouse.upsert({
      where: { name: wh.name },
      update: { latitude: wh.latitude, longitude: wh.longitude },
      create: {
        name: wh.name,
        latitude: wh.latitude,
        longitude: wh.longitude,
      },
    });

    await prisma.warehouseStock.upsert({
      where: {
        warehouseId_productId: {
          warehouseId: warehouse.id,
          productId: product.id,
        },
      },
      update: { quantity: wh.stock },
      create: {
        warehouseId: warehouse.id,
        productId: product.id,
        quantity: wh.stock,
      },
    });
  }

  console.log("Seed complete: 1 product, 6 warehouses with stock");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
