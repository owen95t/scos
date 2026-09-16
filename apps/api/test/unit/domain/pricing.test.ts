import { describe, expect, it } from "vitest";
import {
  calculatePricing,
  getDiscountPercent,
} from "../../../src/domain/pricing.js";

describe("getDiscountPercent", () => {
  const cases: [number, number][] = [
    [1, 0],
    [24, 0],
    [25, 5],
    [49, 5],
    [50, 10],
    [99, 10],
    [100, 15],
    [249, 15],
    [250, 20],
    [1000, 20],
  ];

  it.each(cases)("quantity %i → %i%% discount", (quantity, expected) => {
    expect(getDiscountPercent(quantity)).toBe(expected);
  });
});

describe("calculatePricing", () => {
  it("no discount for 10 units", () => {
    const result = calculatePricing(10);
    expect(result.unitPrice).toBe(150);
    expect(result.subtotal).toBe(1500);
    expect(result.discountPercent).toBe(0);
    expect(result.discountAmount).toBe(0);
    expect(result.discountedTotal).toBe(1500);
  });

  it("5% discount for 30 units", () => {
    const result = calculatePricing(30);
    expect(result.subtotal).toBe(4500);
    expect(result.discountPercent).toBe(5);
    expect(result.discountAmount).toBe(225);
    expect(result.discountedTotal).toBe(4275);
  });

  it("20% discount for 250 units", () => {
    const result = calculatePricing(250);
    expect(result.subtotal).toBe(37500);
    expect(result.discountPercent).toBe(20);
    expect(result.discountAmount).toBe(7500);
    expect(result.discountedTotal).toBe(30000);
  });
});
