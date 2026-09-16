import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const WAREHOUSES = [
  { name: "Los Angeles", latitude: 33.9425, longitude: -118.408056, stock: 355 },
  { name: "New York", latitude: 40.639722, longitude: -73.778889, stock: 578 },
  { name: "São Paulo", latitude: -23.435556, longitude: -46.473056, stock: 265 },
  { name: "Paris", latitude: 49.009722, longitude: 2.547778, stock: 694 },
  { name: "Warsaw", latitude: 52.165833, longitude: 20.967222, stock: 245 },
  { name: "Hong Kong", latitude: 22.308889, longitude: 113.914444, stock: 419 },
];

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
