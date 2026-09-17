import { afterEach, describe, expect, it, vi } from "vitest";
import { calculateShippingCost } from "../../../src/domain/allocation.ts";
import { haversineDistance } from "../../../src/domain/distance.ts";
import { calculateOrder } from "../../../src/domain/orderCalculator.ts";
import type { WarehouseWithStock } from "../../../src/domain/types.ts";
import { totalStock, warehouses } from "../../fixtures/warehouses.ts";

// Lets a test pin the distance; otherwise the real haversine is used.
const distance = vi.hoisted(() => ({ fixedKm: undefined as number | undefined }));

vi.mock("../../../src/domain/distance.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/domain/distance.ts")>();
  return {
    haversineDistance: (...args: Parameters<typeof actual.haversineDistance>) =>
      distance.fixedKm ?? actual.haversineDistance(...args),
  };
});

afterEach(() => {
  distance.fixedKm = undefined;
});

describe("calculateOrder", () => {
  it("valid order near a warehouse", () => {
    const destination = { latitude: 34.0, longitude: -118.0 };
    const result = calculateOrder(warehouses, 10, destination);
    const la = warehouses[0];
    const expectedShipping = calculateShippingCost(
      haversineDistance(la.latitude, la.longitude, destination.latitude, destination.longitude),
      10
    );

    expect(result.valid).toBe(true);
    expect(result.pricing.subtotal).toBe(1500);
    expect(result.pricing.discountPercent).toBe(0);
    expect(result.shippingCost).toBeCloseTo(expectedShipping, 6);
    expect(result.total).toBe(result.pricing.discountedTotal + result.shippingCost);
  });

  it("invalid — insufficient stock", () => {
    const result = calculateOrder(warehouses, totalStock + 1, { latitude: 0, longitude: 0 });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Insufficient stock");
  });

  describe("15% shipping threshold", () => {
    const single: WarehouseWithStock[] = [
      { id: 1, name: "Test", latitude: 0, longitude: 0, stock: 10000 },
    ];
    const destination = { latitude: 1, longitude: 1 };
    // qty 1: discounted total $150, limit $22.50 → exactly 22.5 / (0.01 × 0.365) km.
    const boundaryKm = 22.5 / (0.01 * 0.365);

    it("shipping exactly at 15% is valid", () => {
      expect(calculateShippingCost(boundaryKm, 1)).toBe(22.5);
      distance.fixedKm = boundaryKm;

      const result = calculateOrder(single, 1, destination);
      expect(result.shippingCost).toBe(22.5);
      expect(result.valid).toBe(true);
    });

    it("shipping just over 15% is invalid", () => {
      distance.fixedKm = boundaryKm + 1;

      const result = calculateOrder(single, 1, destination);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("15%");
    });

    it("far destination with real distance is invalid", () => {
      const result = calculateOrder(single, 1, { latitude: 80, longitude: 170 });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("15%");
    });
  });

  it("discount tiers applied correctly in full order", () => {
    const result = calculateOrder(warehouses, 50, { latitude: 49.0, longitude: 2.5 });
    expect(result.pricing.discountPercent).toBe(10);
    expect(result.pricing.discountAmount).toBe(750);
    expect(result.pricing.discountedTotal).toBe(6750);
  });

  it("multi-warehouse split order", () => {
    const result = calculateOrder(warehouses, 600, { latitude: 40.0, longitude: -74.0 });
    expect(result.allocation.legs.map((l) => [l.warehouse.name, l.quantity])).toEqual([
      ["New York", 578],
      ["Los Angeles", 22],
    ]);
    expect(result.allocation.fulfilled).toBe(true);
    expect(result.pricing.discountPercent).toBe(20);
  });
});
