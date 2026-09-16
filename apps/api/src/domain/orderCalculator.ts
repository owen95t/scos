import { allocateOrder } from "./allocation.js";
import { calculatePricing } from "./pricing.js";
import type {
  Destination,
  OrderCalculation,
  WarehouseWithStock,
} from "./types.js";

const SHIPPING_COST_THRESHOLD = 0.15;

export function calculateOrder(
  warehouses: WarehouseWithStock[],
  quantity: number,
  destination: Destination
): OrderCalculation {
  const pricing = calculatePricing(quantity);
  const allocation = allocateOrder(warehouses, quantity, destination);

  if (!allocation.fulfilled) {
    return {
      pricing,
      allocation,
      shippingCost: allocation.totalShippingCost,
      total: pricing.discountedTotal + allocation.totalShippingCost,
      valid: false,
      reason: `Insufficient stock. Only ${allocation.fulfilledQuantity} units available across all warehouses.`,
    };
  }

  const shippingCost = allocation.totalShippingCost;
  const total = pricing.discountedTotal + shippingCost;

  if (shippingCost > pricing.discountedTotal * SHIPPING_COST_THRESHOLD) {
    return {
      pricing,
      allocation,
      shippingCost,
      total,
      valid: false,
      reason: `Shipping cost ($${shippingCost.toFixed(2)}) exceeds 15% of discounted total ($${(pricing.discountedTotal * SHIPPING_COST_THRESHOLD).toFixed(2)}).`,
    };
  }

  return {
    pricing,
    allocation,
    shippingCost,
    total,
    valid: true,
  };
}
