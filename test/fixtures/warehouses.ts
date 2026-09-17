import { WAREHOUSES } from "../../prisma/seedData.js";
import type { WarehouseWithStock } from "../../src/domain/types.js";

// Seeded warehouses in domain shape, ids in seed order.
export const warehouses: WarehouseWithStock[] = WAREHOUSES.map((w, i) => ({
  id: i + 1,
  ...w,
}));

export const totalStock = warehouses.reduce((s, w) => s + w.stock, 0);
