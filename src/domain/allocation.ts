import { haversineDistance } from "./distance.ts";
import type {
  AllocationLeg,
  AllocationResult,
  Destination,
  WarehouseWithStock,
} from "./types.ts";

const SHIPPING_RATE_PER_KG_PER_KM = 0.01;
const PRODUCT_WEIGHT_KG = 0.365;

export function calculateShippingCost(
  distanceKm: number,
  quantity: number
): number {
  return SHIPPING_RATE_PER_KG_PER_KM * PRODUCT_WEIGHT_KG * quantity * distanceKm;
}

export function allocateOrder(
  warehouses: WarehouseWithStock[],
  quantity: number,
  destination: Destination
): AllocationResult {
  const warehousesWithDistance = warehouses
    .filter((w) => w.stock > 0)
    .map((w) => ({
      warehouse: w,
      distanceKm: haversineDistance(
        w.latitude,
        w.longitude,
        destination.latitude,
        destination.longitude
      ),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const legs: AllocationLeg[] = [];
  let remaining = quantity;

  for (const { warehouse, distanceKm } of warehousesWithDistance) {
    if (remaining <= 0) break;

    const take = Math.min(remaining, warehouse.stock);
    const shippingCost = calculateShippingCost(distanceKm, take);

    legs.push({ warehouse, quantity: take, distanceKm, shippingCost });
    remaining -= take;
  }

  const totalShippingCost = legs.reduce((sum, leg) => sum + leg.shippingCost, 0);

  return {
    legs,
    totalShippingCost,
    fulfilled: remaining === 0,
    fulfilledQuantity: quantity - remaining,
  };
}
