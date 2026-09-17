export interface Warehouse {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
}

export interface WarehouseWithStock extends Warehouse {
  stock: number;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  unitPrice: number;
  weightGrams: number;
}

export interface Destination {
  latitude: number;
  longitude: number;
}

export interface AllocationLeg {
  warehouse: WarehouseWithStock;
  quantity: number;
  distanceKm: number;
  shippingCost: number;
}

export interface AllocationResult {
  legs: AllocationLeg[];
  totalShippingCost: number;
  fulfilled: boolean;
  fulfilledQuantity: number;
}

export interface PricingResult {
  unitPrice: number;
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  discountedTotal: number;
}

export interface OrderCalculation {
  pricing: PricingResult;
  allocation: AllocationResult;
  shippingCost: number;
  total: number;
  valid: boolean;
  reason?: string;
}
