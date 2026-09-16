# 03 — Domain Layer

## Scope

`apps/api/src/domain/` — pure functions, zero I/O:

- `types.ts` — domain types (Warehouse, Product, AllocationResult, etc.)
- `pricing.ts` — unit price, discount tiers (25+→5%, 50+→10%, 100+→15%, 250+→20%), subtotal/discount calculation
- `distance.ts` — Haversine distance between two lat/lng points
- `allocation.ts` — greedy nearest-warehouse-first allocation: sort warehouses by distance, fill from nearest until quantity satisfied
- `orderCalculator.ts` — orchestrates pricing + allocation + shipping cost + 15% validity check

Unit tests at `apps/api/test/unit/domain/` covering:
- Discount tier boundaries (24→0%, 25→5%, 49→5%, 50→10%, 99→10%, 100→15%, 249→15%, 250→20%)
- Split-warehouse allocation (quantity exceeds nearest warehouse stock)
- Exact stock exhaustion (quantity exactly equals available stock)
- 15% validity threshold edge (shipping cost at exactly 15% of discounted total)
- Haversine known-distance check

## Acceptance Criteria

- All domain functions are pure (no imports from prisma, express, etc.)
- All unit tests pass via `vitest`
- Discount boundaries tested exhaustively
- Allocation handles split across 2+ warehouses
- 15% threshold boundary tested (at and just over)

## Dependencies

- 01 (workspace setup)
- 02 (shared types — FulfillmentPlan, OrderQuote used in calculator output)
