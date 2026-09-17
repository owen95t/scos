# SCOS Order Management

Order management system for the SCOS Station P1 Pro. Multi-warehouse fulfillment with greedy nearest-warehouse allocation, volume discounts, and Haversine-based shipping cost calculation.

- **API docs:** Swagger UI at `/docs` when the API is running
- **Architecture:** [ARCHITECTURE.MD](ARCHITECTURE.MD)
- **Frontend:** lives in a separate repo: `scos-fe/`

## Contents

1. [Quick Start](#quick-start)
2. [API](#api)
3. [How It Works](#how-it-works)
4. [Testing](#testing)
5. [Technical Decisions](#technical-decisions)
6. [Logging](#logging)
7. [CI/CD and Deployment](#cicd-and-deployment)
8. [Known Limitations](#known-limitations)
9. [What I Would Do Next](#what-i-would-do-next)

## Quick Start

### Option 1: Docker Compose (recommended)

Needs only Docker and Docker Compose.

```bash
# Start postgres + api
docker compose up --build

# The API container runs migrations and the seed on start
# API: http://localhost:3001
# Swagger: http://localhost:3001/docs
```

### Option 2: Local development

Prerequisites:

- Node.js 24 (see `.nvmrc`; `nvm use` picks it up)
- pnpm 9.x (`npm install -g pnpm`)
- Docker & Docker Compose (for database)

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

### Project structure

```
src/                — Fastify API (routes, services, domain, repositories)
src/types/          — API response types and shared type definitions
prisma/             — Schema, migrations, seed
test/               — Unit, API and integration tests
openapi.yaml        — API specification
```

## API

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/orders/verify` | Get a quote (no side effects) |
| `POST` | `/api/orders` | Submit an order (transactional) |
| `GET` | `/api/orders/:orderNumber` | Get order details |
| `GET` | `/api/warehouses` | List warehouses with stock |
| `GET` | `/health` | Liveness + database connectivity check (`200` when the DB is reachable, `503` otherwise) |

Swagger UI is served at `/docs` when the API is running.

**Order status:** orders have a `status` field (default: `confirmed`) and an `updated_at` timestamp. Warehouse stock rows also track `updated_at`. These are returned in the `GET /api/orders/:orderNumber` response.

### Postman

Import [postman/scos-api.postman_collection.json](postman/scos-api.postman_collection.json) into Postman to exercise the API. Its `baseUrl` collection variable defaults to `http://localhost:3001`; run `Submit order` before `Get order details` so the generated order number is captured automatically.

The collection is synchronized from `openapi.yaml`. Run `pnpm postman:generate` after changing the API specification. `pnpm postman:check` verifies that the committed collection matches the specification and can be used in CI.

## How It Works

### Order calculation

The rules live in `src/domain/`:

1. **Pricing** (`pricing.ts`): $150 per unit, with a volume discount of 5% at 25+ units, 10% at 50+, 15% at 100+ and 20% at 250+.
2. **Allocation** (`allocation.ts`): warehouses with stock are sorted by Haversine distance to the shipping address, and units are taken from the nearest first until the order is filled. Shipping cost grows linearly with units × distance, so filling from the nearest warehouse first gives the lowest total cost.
3. **Shipping** (`allocation.ts`): $0.01 per kg per km, at 0.365 kg per unit, summed across all warehouses used.
4. **Validity** (`orderCalculator.ts`): an order is invalid if there is not enough total stock, or if shipping costs more than 15% of the discounted total. The response includes the reason.

### Architecture

The request flow is:

```text
API → Service → Domain → Repository → Database
```

- **API** — Handles HTTP requests, validation, status codes, and responses.
- **Service** — Coordinates use cases, transactions, inventory updates, and order creation.
- **Domain** — Contains business rules such as pricing, discounts, shipping, allocation, and order validity.
- **Repository** — Reads and writes data through Prisma and PostgreSQL.

For more detail, see [ARCHITECTURE.MD](ARCHITECTURE.MD).

### Consistency

Order submission runs in a single transaction and locks stock rows with `SELECT ... FOR UPDATE`, so concurrent orders cannot oversell a warehouse.

## Testing

### Strategy

| Layer | Location | Database | What it covers |
|---|---|---|---|
| Unit | `test/unit/domain/` | No | Pricing, discounts, distance, allocation and order validity: the business rules, tested as pure functions |
| API | `test/api/` | Yes | HTTP routes: request validation, status codes and response shapes |
| Integration | `test/integration/` | Yes | Order service against real Postgres: transactions and stock updates |

### Commands

```bash
# Unit tests only (no database needed)
pnpm test

# API + integration tests against an already-running, migrated and seeded test DB
DATABASE_URL=postgresql://scos_test:scos_test@localhost:5433/scos_test pnpm test:db

# Everything (starts disposable Postgres via Docker, migrates, seeds, tears down)
pnpm test:integration
```

DB tests fail (rather than skip) when `DATABASE_URL` is unset, and refuse to run unless the database name ends in `_test`, because they wipe order data.

## Technical Decisions

- **Fastify** — schema-first validation/serialization (Zod via `fastify-type-provider-zod`) and built-in Swagger generation, with lower overhead than Express.
- **Prisma** — type-safe queries and migrations matched to the Postgres schema; dropped to raw SQL (`$queryRawUnsafe`/`$executeRawUnsafe`) only where `SELECT ... FOR UPDATE` row locking is needed for oversell-safe stock decrements.
- **Postgres** — relational data (orders, warehouses, stock) with real transactions and row locks, needed to prevent overselling under concurrent orders.
- **pnpm** — fast, disk-efficient installs with a strict lockfile.
- **Zod** — one schema definition drives both runtime validation and generated OpenAPI types, avoiding drift between API docs and validation.
- **Vitest** — fast, native ESM/TS support with minimal config.

## Logging

Structured logging via Pino with per-request correlation IDs. Every log line in a request's lifecycle carries the same `reqId` — grep it for a full trace.

Logged events: order verify/submit, allocation decisions, stock warnings, validation errors, unhandled errors.

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

## CI/CD and Deployment

### CI pipeline

GitHub Actions workflow `.github/workflows/ci.yml` runs on every push and PR to `main` (Node 24 from `.nvmrc`, pnpm 9):

1. **gitleaks** — scans full history for secrets. Runs in parallel with the other jobs; `deploy` waits for it to pass.
2. **lint** — `pnpm install`, `prisma generate`, `pnpm lint`.
3. **test-api** — starts a Postgres 16 service, runs migrations and seed, then unit tests (`pnpm test`) and DB tests (`pnpm test:db`).
4. **build** — `docker build`, the same image Render builds.
5. **deploy** — push to `main` only. Calls the Render deploy hook (`RENDER_DEPLOY_HOOK_URL` secret); skipped with a warning if the secret is not set.

### Secret scanning

[gitleaks](https://github.com/gitleaks/gitleaks) scans for hardcoded secrets at two points:

- **Pre-commit** — `.husky/pre-commit` runs `gitleaks git --staged` on every local commit and blocks it if a secret is staged. Needs the `gitleaks` binary on PATH (`brew install gitleaks`); if it's missing the hook stops with install instructions, and it warns if the installed version differs from the one CI uses. The hook installs automatically via `pnpm install` (husky `prepare` script).
- **CI** — the `gitleaks` job in `.github/workflows/ci.yml` scans full repo history on every push/PR to `main`, using `gitleaks/gitleaks-action@v3` pinned to gitleaks 8.28.0. Catches anything committed with `--no-verify`. `deploy` does not run unless this job passes.
- **Config** — both use `.gitleaks.toml` (the default ruleset). Add allowlist entries there for false positives. When upgrading gitleaks, update the version in both `.husky/pre-commit` and `ci.yml`.

### Deployment (Render)

`render.yaml` is a Render Blueprint that creates the API (Docker, free plan) and a Postgres 16 database, and wires `DATABASE_URL` between them.

1. In Render, choose **New → Blueprint** and select this repo.
2. In the `scos-api` service settings, copy the **Deploy Hook** URL.
3. In GitHub, add it as the repository secret `RENDER_DEPLOY_HOOK_URL`.

Auto-deploy is off in `render.yaml`; the CI `deploy` job triggers a deploy only after lint, tests, the Docker build and gitleaks pass on `main`.

On start, the container runs `prisma migrate deploy`, then the seed, then the server. Both are idempotent: the seed only creates missing rows and never overwrites stock. This avoids needing Render's pre-deploy command, which the free plan does not support.

## Known Limitations

Known gaps in the current code, as opposed to the future direction in the next section.

- **Exact money arithmetic**: monetary columns are stored as `DECIMAL(12,2)`, and amounts are rounded to cents when an order is saved. The pricing and shipping calculations in `src/domain/` still use JavaScript `number`, so the quote returned by `/api/orders/verify` can show unrounded amounts. For fully exact arithmetic, the domain code could use integer cents or `Prisma.Decimal`.
- **Consolidate the API specification**: there are currently two API specs. Swagger UI (`/docs`) is generated at runtime from the Zod route schemas, while `openapi.yaml` (the source for the Postman collection) is maintained by hand. Nothing checks that they match, so `openapi.yaml` may drift from the real routes. A future fix should settle on one source of truth, e.g. export the Fastify-generated spec to `openapi.yaml` in a script and check it in CI, or generate the Zod schemas from `openapi.yaml`.
- **Render free plan**: Render's free Postgres expires after 30 days, and free web services sleep when idle, so the first request after a pause is slow. Use paid plans for anything beyond a demo.
- **Migrations on start**: with more than one instance, move migrations to a pre-deploy command so they don't run on every instance start.
- **Connection pooling**: the `SELECT ... FOR UPDATE` locking works with standard Postgres; check compatibility before putting PgBouncer in transaction mode in front of it.

## What I Would Do Next

If this were a real project, I would:

- Add authentication and authorization for sales representatives and warehouse users.
- Add idempotency keys so retried requests cannot create duplicate orders.
- Add an audit trail. I left it out to keep the scope close to the 4-hour brief. In production, every stock change and order creation would write an `audit_log` row in the same transaction as the change, so a rolled-back order leaves no audit entry. Each row would record the action, the entity, the before and after values, the request ID (matching the log `reqId`) and the authenticated user. This supports investigating stock discrepancies and disputed orders. If write volume grew, I would move to a transactional outbox or change data capture (CDC) feeding an append-only store.
- Reduce lock contention: order submission currently locks all stock rows for the product, so submissions run one at a time. I would lock only the warehouses used by the order, or use conditional updates (`quantity >= n`) with a retry.
- Add load tests that submit orders in parallel against multiple API instances, checking that stock never goes negative and order numbers stay unique.
- Deploy multiple stateless API instances behind a load balancer, using PostgreSQL as the source of truth.
- Add monitoring, tracing, and alerts for failed transactions, lock waits, and low stock.
- Add order cancellation and inventory reservation if fulfillment becomes asynchronous.
- Keep orders and inventory in the same service initially, and split them only when independent scaling or ownership becomes necessary.
