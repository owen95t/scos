#!/usr/bin/env bash
set -euo pipefail

TEST_DB_URL="postgresql://scos_test:scos_test@localhost:5433/scos_test"

echo "Starting test database..."
docker compose -f docker-compose.test.yml up -d --wait

echo "Running migrations..."
DATABASE_URL="$TEST_DB_URL" npx prisma migrate deploy
DATABASE_URL="$TEST_DB_URL" npx prisma db seed

echo "Running tests..."
DATABASE_URL="$TEST_DB_URL" pnpm test

echo "Tearing down test database..."
docker compose -f docker-compose.test.yml down

echo "All tests passed!"
