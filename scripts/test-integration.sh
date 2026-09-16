#!/usr/bin/env bash
set -euo pipefail

TEST_DB_URL="postgresql://scos_test:scos_test@localhost:5433/scos_test"

echo "Starting test database..."
docker compose -f docker-compose.test.yml up -d --wait

echo "Running migrations..."
cd apps/api
DATABASE_URL="$TEST_DB_URL" npx prisma migrate deploy
DATABASE_URL="$TEST_DB_URL" npx prisma db seed
cd ../..

echo "Running API tests..."
DATABASE_URL="$TEST_DB_URL" pnpm --filter @scos/api test

echo "Running web tests..."
pnpm --filter @scos/web test

echo "Tearing down test database..."
docker compose -f docker-compose.test.yml down

echo "All tests passed!"
