import { describe, expect, it } from "vitest";
import {
  allocateOrder,
  calculateShippingCost,
} from "../../../src/domain/allocation.ts";
import { totalStock, warehouses } from "../../fixtures/warehouses.ts";

describe("calculateShippingCost", () => {
  it("$0.01/kg/km × 0.365kg × 100 units × 1000km = $365", () => {
    expect(calculateShippingCost(1000, 100)).toBeCloseTo(365, 2);
  });
});

describe("allocateOrder", () => {
  it("single warehouse — nearest has enough stock", () => {
    const result = allocateOrder(warehouses, 10, { latitude: 34.0, longitude: -118.0 });
    expect(result.fulfilled).toBe(true);
    expect(result.legs).toHaveLength(1);
    expect(result.legs[0].warehouse.name).toBe("Los Angeles");
    expect(result.legs[0].quantity).toBe(10);
  });

  it("split across warehouses when nearest lacks stock", () => {
    const result = allocateOrder(warehouses, 400, { latitude: 34.0, longitude: -118.0 });
    expect(result.fulfilled).toBe(true);
    expect(result.legs.length).toBeGreaterThan(1);
    expect(result.legs[0].warehouse.name).toBe("Los Angeles");
    expect(result.legs[0].quantity).toBe(355);
    const totalAllocated = result.legs.reduce((s, l) => s + l.quantity, 0);
    expect(totalAllocated).toBe(400);
  });

  it("exact stock exhaustion — request equals total available", () => {
    const result = allocateOrder(warehouses, totalStock, { latitude: 0, longitude: 0 });
    expect(result.fulfilled).toBe(true);
    expect(result.fulfilledQuantity).toBe(totalStock);
  });

  it("insufficient stock — request exceeds total available", () => {
    const result = allocateOrder(warehouses, totalStock + 1, { latitude: 0, longitude: 0 });
    expect(result.fulfilled).toBe(false);
    expect(result.fulfilledQuantity).toBe(totalStock);
  });

  it("skips warehouses with 0 stock", () => {
    const modified = warehouses.map((w) =>
      w.name === "Los Angeles" ? { ...w, stock: 0 } : w
    );
    const result = allocateOrder(modified, 10, { latitude: 34.0, longitude: -118.0 });
    expect(result.legs[0].warehouse.name).not.toBe("Los Angeles");
  });

  it("sorts by distance — destination near Hong Kong picks HK first", () => {
    const result = allocateOrder(warehouses, 10, { latitude: 22.3, longitude: 114.0 });
    expect(result.legs[0].warehouse.name).toBe("Hong Kong");
  });
});
