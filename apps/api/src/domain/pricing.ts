import type { PricingResult } from "./types.js";

const UNIT_PRICE = 150;

const DISCOUNT_TIERS = [
  { minQuantity: 250, percent: 20 },
  { minQuantity: 100, percent: 15 },
  { minQuantity: 50, percent: 10 },
  { minQuantity: 25, percent: 5 },
] as const;

export function getDiscountPercent(quantity: number): number {
  for (const tier of DISCOUNT_TIERS) {
    if (quantity >= tier.minQuantity) return tier.percent;
  }
  return 0;
}

export function calculatePricing(quantity: number): PricingResult {
  const subtotal = quantity * UNIT_PRICE;
  const discountPercent = getDiscountPercent(quantity);
  const discountAmount = subtotal * (discountPercent / 100);
  const discountedTotal = subtotal - discountAmount;

  return {
    unitPrice: UNIT_PRICE,
    subtotal,
    discountPercent,
    discountAmount,
    discountedTotal,
  };
}
