# 05 — Repositories + Services

## Scope

`apps/api/src/repositories/`:
- `warehouseRepository.ts` — getAll(), getWithStock()
- `orderRepository.ts` — create(), findByOrderNumber()

`apps/api/src/services/`:
- `orderService.ts`:
  - `verifyOrder(quantity, lat, lng)` — read-only: fetch warehouses+stock, run domain calculator, return quote. No side effects.
  - `submitOrder(quantity, lat, lng)` — transactional:
    1. BEGIN transaction
    2. SELECT ... FOR UPDATE on relevant WarehouseStock rows (locked in warehouse_id ASC order)
    3. Re-run allocation against live stock
    4. Decrement stock
    5. Insert Order, OrderLine, OrderFulfillment rows
    6. COMMIT (or ROLLBACK + 409 on insufficient stock)

Integration test at `apps/api/test/integration/`:
- Concurrent submission test: fire N parallel submitOrder() calls at a low-stock warehouse, assert total stock decremented never goes below 0 and no overselling occurs.

## Acceptance Criteria

- `verifyOrder` returns correct quote without DB writes
- `submitOrder` persists order and decrements stock atomically
- Concurrent test proves no overselling (stock CHECK constraint + FOR UPDATE locking)
- 409 returned on insufficient stock mid-transaction

## Dependencies

- 03 (domain layer — allocation, pricing, distance functions)
- 04 (prisma schema — DB models)
