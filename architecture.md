# Architecture

## Overview

SCOS Order Management is a pnpm monorepo with the API app and one shared package (`shared-types`). Single product (SCOS Station P1 Pro), multi-warehouse fulfillment. Frontend lives in a separate repo (`scos-fe/`).

```
apps/api/              Fastify + Prisma + Postgres — order verification/submission API
packages/shared-types/ Types shared across api/frontend (e.g. OrderQuote)
```

## API layering (`apps/api/src`)

```
api/routes          HTTP handlers (orders.ts, warehouses.ts), Zod-validated (orderSchemas.ts)
api/middleware      errorHandler.ts — maps domain errors to HTTP status
services            orderService.ts — orchestrates: lock stock → calculate → persist → audit
                    auditService.ts — writes audit_log rows (tx-aware)
domain              allocation.ts, pricing.ts, orderCalculator.ts, distance.ts, types.ts,
                    errors.ts, product.ts — pure, no I/O, fully unit-testable
repositories        orderRepository.ts, warehouseRepository.ts — all Prisma queries and raw SQL
container.ts        Manual DI: wires PrismaClient into repositories/services
```

Dependency direction: routes → services → domain (pure) + repositories → Prisma → Postgres.

Rules:
- Only repositories (and `auditService`) contain SQL or Prisma queries.
- The service owns the transaction (`prisma.$transaction`) and passes `tx` to repository methods that must join it.
- Repositories return domain types (`WarehouseWithStock`) or `@scos/shared-types` response shapes, so routes never see Prisma models.
- Routes handle HTTP concerns only: validation, status codes, error bodies.

### Why not full hexagonal / clean architecture

We considered ports and adapters (port interfaces, a unit-of-work abstraction, in-memory fakes) and chose not to use them for now:
- The codebase is small (~850 lines) with one write flow (`submitOrder`).
- The risky part is row locking under concurrency. A fake adapter can't prove it; the Postgres integration tests do.
- Postgres, Prisma and Fastify are fixed choices, so swappable adapters add indirection for no real gain.
- The domain is already pure and isolated, which covers most of what clean architecture buys.

Passing a Prisma `tx` from the service to repositories is the accepted trade-off. Revisit this when a second write flow shares transactions, a second transport (queue consumer, CLI) calls the services, or orchestration grows complex enough (payments, retries, external calls) to need fast unit tests.

## Domain logic

- **Allocation** (`allocation.ts`): greedy nearest-warehouse. Sorts in-stock warehouses by Haversine distance to destination, fills quantity from nearest first until exhausted or fulfilled.
- **Pricing** (`pricing.ts`): flat unit price ($150), tiered volume discount (5%/10%/15%/20% at 25/50/100/250 units).
- **Shipping cost**: `rate($0.01/kg/km) * weight(0.365kg) * qty * distance`, summed per warehouse leg.
- **Order validation** (`orderCalculator.ts`): combines pricing + allocation. Rejects if stock insufficient, or if shipping cost exceeds 15% of discounted subtotal.

Both `verifyOrder` (quote, no side effects) and `submitOrder` (persists) share this same calculation path, so quotes and actual orders can't drift.

## Order submission & concurrency

`orderService.submitOrder` runs in a single Prisma `$transaction`:
1. `warehouseRepository.lockStockForUpdate` — raw `SELECT ... FOR UPDATE OF ws` locks the relevant `warehouse_stock` rows.
2. Recomputes allocation/pricing against the locked read (not a stale earlier read).
3. `warehouseRepository.decrementStock` per warehouse leg.
4. `orderRepository.nextOrderNumber` — from a Postgres sequence (`order_number_seq`).
5. `orderRepository.create` — inserts `Order` → `OrderLine` → `OrderFulfillment` (nested Prisma writes).
6. `auditService.logMany` — audit rows in the same transaction.

Row locking prevents overselling under concurrent orders against the same warehouse stock.

## Data model (Prisma / Postgres)

```
Warehouse ──< WarehouseStock >── Product
Order ──< OrderLine ──< OrderFulfillment >── Warehouse
```

- `WarehouseStock` composite key `(warehouseId, productId)` — quantity per warehouse per product.
- `OrderFulfillment` records the actual per-warehouse split (qty, distance, shipping cost) for a placed order — an audit trail of the allocation decision at order time.
- Product is modeled generically, but the service currently uses a single `PRODUCT_ID` constant (`domain/product.ts`, single-SKU system).

## Testing

- `test/unit/domain/*` — pure function tests (allocation, pricing, orderCalculator) — no DB.
- `test/api/*` — route-level tests.
- `test/integration/orderService.test.ts` — exercises the real transaction against Postgres (`pnpm test:integration`, via `docker-compose.test.yml`).

## Deployment shape

See `README.md` Production Deploy Notes — API as a Docker container against managed Postgres, `SELECT ... FOR UPDATE` requires session-mode Postgres access (verify compatibility with transaction-mode poolers like PgBouncer).
