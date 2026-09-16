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
cd apps/api
cp .env.example .env
npx prisma migrate deploy
npx prisma db seed
cd ../..

# Start API dev server (on :3001)
pnpm dev
```

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
apps/api/              — Fastify API with Prisma ORM
packages/shared-types/ — Shared TypeScript types
```

Frontend lives in a separate repo: `scos-fe/`

## API Documentation

Swagger UI is served at `/docs` when the API is running.

### Endpoints

- `POST /api/orders/verify` — Get a quote (no side effects)
- `POST /api/orders` — Submit an order (transactional)
- `GET /api/orders/:orderNumber` — Get order details
- `GET /api/warehouses` — List warehouses with stock

## Technical Decisions

- **Fastify** — schema-first validation/serialization (Zod via `fastify-type-provider-zod`) and built-in Swagger generation, with lower overhead than Express.
- **Prisma** — type-safe queries and migrations matched to the Postgres schema; dropped to raw SQL (`$queryRawUnsafe`/`$executeRawUnsafe`) only where `SELECT ... FOR UPDATE` row locking is needed for oversell-safe stock decrements.
- **Postgres** — relational data (orders, warehouses, stock) with real transactions and row locks, needed to prevent overselling under concurrent orders.
- **pnpm workspaces** — monorepo for api/web/shared-types with a single lockfile and fast, disk-efficient installs.
- **React + Vite** — fast dev server/HMR, minimal config for a small SPA.
- **Zod** — one schema definition drives both runtime validation and generated OpenAPI types, avoiding drift between API docs and validation.
- **Vitest** — fast, native ESM/TS support, shared config style with Vite.

## Production Deploy Notes

This project is scoped to local development. For a production deployment:

- **API**: Deploy to Fly.io or Render as a Docker container. Set `DATABASE_URL` to a managed Postgres instance (e.g. Neon, Supabase, or Fly Postgres). Run `prisma migrate deploy` as a release command.
- **Database**: Use a managed Postgres service with connection pooling. The `SELECT ... FOR UPDATE` locking strategy works with standard Postgres; verify compatibility if using a proxy like PgBouncer in transaction mode.
- **CI/CD**: The GitHub Actions workflow in `.github/workflows/ci.yml` handles lint, test, and build. Add deploy steps with secrets for your hosting provider.
