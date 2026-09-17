# SCOS Order Management

Order management system for the SCOS Station P1 Pro. Multi-warehouse fulfillment with greedy nearest-warehouse allocation, volume discounts, and Haversine-based shipping cost calculation.

## Prerequisites

- Node.js >= 20
- pnpm 9.x (`npm install -g pnpm`)
- Docker & Docker Compose (for database)

## Quick Start

```bash
# Install dependencies
pnpm install

# Start Postgres
docker compose up postgres -d

# Run migrations and seed
cp .env.example .env
npx prisma migrate deploy
npx prisma db seed

# Start API dev server (on :3001)
pnpm dev
```

Environment variables are validated at startup (`src/config/env.ts`); the server exits with a list of any missing or invalid values. `pnpm dev` loads `.env` automatically.

## Running with Docker Compose

```bash
# Start postgres + api
docker compose up --build

# API: http://localhost:3001
# Swagger: http://localhost:3001/docs
```

## Testing

```bash
# Unit tests only (no database needed)
pnpm test

# Full integration tests (starts disposable Postgres via Docker)
pnpm test:integration
```

## Project Structure

```
src/                — Fastify API (routes, services, domain, repositories)
src/shared-types/   — Shared response types (imported as `#shared-types`)
prisma/             — Schema, migrations, seed
test/               — Unit, API and integration tests
openapi.yaml        — API specification
```

Frontend lives in a separate repo: `scos-fe/`

## API Documentation

Swagger UI is served at `/docs` when the API is running.

Import [postman/scos-api.postman_collection.json](postman/scos-api.postman_collection.json) into Postman to exercise the API. Its `baseUrl` collection variable defaults to `http://localhost:3001`; run `Submit order` before `Get order details` so the generated order number is captured automatically.

The collection is synchronized from `openapi.yaml`. Run `pnpm postman:generate` after changing the API specification. `pnpm postman:check` verifies that the committed collection matches the specification and can be used in CI.

### Endpoints

- `POST /api/orders/verify` — Get a quote (no side effects)
- `POST /api/orders` — Submit an order (transactional)
- `GET /api/orders/:orderNumber` — Get order details
- `GET /api/warehouses` — List warehouses with stock

## Technical Decisions

- **Fastify** — schema-first validation/serialization (Zod via `fastify-type-provider-zod`) and built-in Swagger generation, with lower overhead than Express.
- **Prisma** — type-safe queries and migrations matched to the Postgres schema; dropped to raw SQL (`$queryRawUnsafe`/`$executeRawUnsafe`) only where `SELECT ... FOR UPDATE` row locking is needed for oversell-safe stock decrements.
- **Postgres** — relational data (orders, warehouses, stock) with real transactions and row locks, needed to prevent overselling under concurrent orders.
- **pnpm** — fast, disk-efficient installs with a strict lockfile.
- **Zod** — one schema definition drives both runtime validation and generated OpenAPI types, avoiding drift between API docs and validation.
- **Vitest** — fast, native ESM/TS support with minimal config.

## Logging

Structured logging via Pino with per-request correlation IDs. Every log line in a request's lifecycle carries the same `reqId` — grep it for a full trace.

```bash
# Configure via environment variables
LOG_LEVEL=debug    # debug (default in dev), info (default in prod), warn, error
NODE_ENV=development  # "production" outputs JSON, anything else uses pino-pretty
```

**Dev output** (colorized, human-readable):
```
22:14:33.120 INFO  (req-a3f8b2c1): submitting order
    quantity: 50, latitude: 34, longitude: -118
22:14:33.136 INFO  (req-a3f8b2c1): allocation decided
    legs: [{"warehouseId":1,"qty":50,"distanceKm":42}]
22:14:33.142 INFO  (req-a3f8b2c1): order created
    orderNumber: "ORD-000012", total: 6853.5
```

**Production output** (newline-delimited JSON, for log aggregators):
```json
{"level":30,"time":1694812473120,"reqId":"req-a3f8b2c1","msg":"submitting order","quantity":50}
```

Logged events: order verify/submit, allocation decisions, stock warnings, validation errors, unhandled errors.

## Audit Trail

Every state mutation writes durable records to the `audit_log` table, inside the same database transaction as the data change — if the transaction rolls back, the audit entry does too.

### What's captured

| Action | Entity | Data |
|--------|--------|------|
| `ORDER_CREATED` | `order` / `ORD-XXXXXX` | orderId, quantity, lat/lng, subtotal, discountAmount, shippingCost, total, leg count |
| `STOCK_DECREMENTED` | `warehouse_stock` / `{warehouseId}:1` | warehouseId, warehouseName, quantityBefore, quantityAfter, decremented, orderNumber |

Each entry carries `request_id` (matches log `reqId`) and `timestamp`. The `actor` column is nullable — ready for when authentication is added.

### Querying

```sql
-- Full trace for a specific order
SELECT * FROM audit_log WHERE entity_id = 'ORD-000042' ORDER BY id;

-- All stock changes for a warehouse
SELECT * FROM audit_log
WHERE entity_type = 'warehouse_stock' AND entity_id LIKE '3:%'
ORDER BY timestamp DESC;

-- Everything from a single request
SELECT * FROM audit_log WHERE request_id = 'req-a3f8b2c1';

-- Recent order creations
SELECT * FROM audit_log WHERE action = 'ORDER_CREATED' ORDER BY timestamp DESC LIMIT 20;
```

### Order Status

Orders have a `status` field (default: `confirmed`) and `updated_at` timestamp. Warehouse stock rows also track `updated_at`. These are returned in the `GET /api/orders/:orderNumber` response.

## CI/CD

GitHub Actions workflow `.github/workflows/ci.yml` runs on every push and PR to `main` (Node 20, pnpm 9):

1. **gitleaks** — scans full history for secrets. Runs in parallel with the other jobs; `deploy` waits for it to pass.
2. **lint** — `pnpm install`, `prisma generate`, `pnpm lint`.
3. **test-api** — starts a Postgres 16 service, runs migrations and seed, then `pnpm test`.
4. **build** — `prisma generate`, `pnpm build`.
5. **deploy** — push to `main` only. Currently a placeholder `echo`; nothing is deployed.

## Secret Scanning

[gitleaks](https://github.com/gitleaks/gitleaks) scan for hardcoded secrets at two points:

- **Pre-commit** — `.husky/pre-commit` run `gitleaks git --staged` on every local commit, block it if a secret is staged. Needs the `gitleaks` binary on PATH (`brew install gitleaks`); if it's missing the hook stops with install instructions, and it warns if the installed version differs from the one CI uses. Hook install automatically via `pnpm install` (husky `prepare` script).
- **CI** — `gitleaks` job in `.github/workflows/ci.yml` scan full repo history on every push/PR to `main`, using `gitleaks/gitleaks-action@v2` pinned to gitleaks 8.28.0. Catches anything committed with `--no-verify`. `deploy` does not run unless this job passes.
- **Config** — both use `.gitleaks.toml` (the default ruleset). Add allowlist entries there for false positives. When upgrading gitleaks, update the version in both `.husky/pre-commit` and `ci.yml`.

## Production Deploy Notes

This project is scoped to local development. For a production deployment:

- **API**: Deploy to Fly.io or Render as a Docker container. Set `DATABASE_URL` to a managed Postgres instance (e.g. Neon, Supabase, or Fly Postgres). Run `prisma migrate deploy` as a release command.
- **Database**: Use a managed Postgres service with connection pooling. The `SELECT ... FOR UPDATE` locking strategy works with standard Postgres; verify compatibility if using a proxy like PgBouncer in transaction mode.
- **CI/CD**: The GitHub Actions workflow in `.github/workflows/ci.yml` handles lint, test, and build (see [CI/CD](#cicd)). Replace the placeholder `deploy` job with real steps with secrets for your hosting provider.
