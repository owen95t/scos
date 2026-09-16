import { describe, expect, it } from "vitest";
import { calculateOrder } from "../../../src/domain/orderCalculator.js";
import type { WarehouseWithStock } from "../../../src/domain/types.js";

const warehouses: WarehouseWithStock[] = [
  { id: 1, name: "Los Angeles", latitude: 33.9425, longitude: -118.408056, stock: 355 },
  { id: 2, name: "New York", latitude: 40.639722, longitude: -73.778889, stock: 578 },
  { id: 3, name: "São Paulo", latitude: -23.435556, longitude: -46.473056, stock: 265 },
  { id: 4, name: "Paris", latitude: 49.009722, longitude: 2.547778, stock: 694 },
  { id: 5, name: "Warsaw", latitude: 52.165833, longitude: 20.967222, stock: 245 },
  { id: 6, name: "Hong Kong", latitude: 22.308889, longitude: 113.914444, stock: 419 },
];

describe("calculateOrder", () => {
  it("valid order near a warehouse", () => {
    const result = calculateOrder(warehouses, 10, { latitude: 34.0, longitude: -118.0 });
    expect(result.valid).toBe(true);
    expect(result.pricing.subtotal).toBe(1500);
    expect(result.pricing.discountPercent).toBe(0);
    expect(result.shippingCost).toBeGreaterThan(0);
    expect(result.total).toBe(result.pricing.discountedTotal + result.shippingCost);
  });

  it("invalid — insufficient stock", () => {
    const totalStock = warehouses.reduce((s, w) => s + w.stock, 0);
    const result = calculateOrder(warehouses, totalStock + 1, { latitude: 0, longitude: 0 });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Insufficient stock");
  });

  it("15% threshold — shipping exactly at boundary", () => {
    const singleWarehouse: WarehouseWithStock[] = [
      { id: 1, name: "Test", latitude: 0, longitude: 0, stock: 10000 },
    ];

    const result = calculateOrder(singleWarehouse, 100, { latitude: 0, longitude: 0.01 });

    expect(result.valid).toBe(true);

    const shippingRatio = result.shippingCost / result.pricing.discountedTotal;
    expect(shippingRatio).toBeLessThanOrEqual(0.15);
  });

  it("15% threshold — shipping exceeds boundary → invalid", () => {
    const farWarehouse: WarehouseWithStock[] = [
      { id: 1, name: "Remote", latitude: 0, longitude: 0, stock: 10000 },
    ];

    const result = calculateOrder(farWarehouse, 1, { latitude: 80, longitude: 170 });

    if (!result.valid) {
      expect(result.reason).toContain("15%");
    }
  });

  it("discount tiers applied correctly in full order", () => {
    const result = calculateOrder(warehouses, 50, { latitude: 49.0, longitude: 2.5 });
    expect(result.pricing.discountPercent).toBe(10);
    expect(result.pricing.discountAmount).toBe(750);
    expect(result.pricing.discountedTotal).toBe(6750);
  });

  it("multi-warehouse split order", () => {
    const result = calculateOrder(warehouses, 600, { latitude: 40.0, longitude: -74.0 });
    expect(result.allocation.legs.length).toBeGreaterThan(1);
    expect(result.allocation.fulfilled).toBe(true);
    expect(result.pricing.discountPercent).toBe(20);
  });
});
