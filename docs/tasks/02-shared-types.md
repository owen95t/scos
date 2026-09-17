# 02 — Shared Types Package

## Scope

`packages/shared-types/` — TypeScript types/interfaces only, no runtime code.

Types to define:
- `OrderQuote` — subtotal, discountAmount, shippingCost, total, valid, reason?, fulfillmentPlan
- `FulfillmentPlan` — array of `FulfillmentLeg` (warehouseId, warehouseName, quantity, distanceKm, shippingCost)
- `VerifyOrderRequest` — quantity, latitude, longitude
- `VerifyOrderResponse` — the quote
- `SubmitOrderRequest` — same as verify
- `SubmitOrderResponse` — orderNumber + quote
- `OrderResponse` — full order with fulfillment breakdown
- `WarehouseResponse` — warehouse info with current stock

Package has its own `package.json` and `tsconfig.json` extending base. No dependency on api or web.

## Acceptance Criteria

- `tsc --noEmit` passes in the package
- Types are importable via `@scos/shared-types`
- No runtime dependencies

## Dependencies

- 01 (workspace setup — needs tsconfig.base.json and pnpm-workspace.yaml)
