export interface FulfillmentLeg {
  warehouseId: number;
  warehouseName: string;
  quantity: number;
  distanceKm: number;
  shippingCost: number;
}

export type FulfillmentPlan = FulfillmentLeg[];

export interface OrderQuote {
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  shippingCost: number;
  total: number;
  valid: boolean;
  reason?: string;
  fulfillmentPlan: FulfillmentPlan;
}

export interface VerifyOrderRequest {
  quantity: number;
  latitude: number;
  longitude: number;
}

export type VerifyOrderResponse = OrderQuote;

export type SubmitOrderRequest = VerifyOrderRequest;

export interface SubmitOrderResponse {
  orderNumber: string;
  quote: OrderQuote;
}

export interface OrderFulfillmentResponse {
  warehouseId: number;
  warehouseName: string;
  quantity: number;
  distanceKm: number;
  shippingCost: number;
}

export interface OrderLineResponse {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  fulfillments: OrderFulfillmentResponse[];
}

export interface OrderResponse {
  id: number;
  orderNumber: string;
  quantity: number;
  subtotal: number;
  discountAmount: number;
  shippingCost: number;
  total: number;
  latitude: number;
  longitude: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  lines: OrderLineResponse[];
}

export interface WarehouseStockResponse {
  productId: number;
  productName: string;
  quantity: number;
}

export interface WarehouseResponse {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  stock: WarehouseStockResponse[];
}

export interface ErrorResponse {
  error: "INVALID_ORDER" | "INSUFFICIENT_STOCK" | "VALIDATION_ERROR" | "NOT_FOUND";
  reason: string;
}
