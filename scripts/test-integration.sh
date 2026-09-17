#!/usr/bin/env bash
set -euo pipefail

TEST_DB_URL="postgresql://scos_test:scos_test@localhost:5433/scos_test"
COMPOSE=(docker compose -f docker-compose.test.yml)

echo "Starting test database..."
"${COMPOSE[@]}" up -d --wait
trap 'echo "Tearing down test database..."; "${COMPOSE[@]}" down' EXIT

echo "Running migrations..."
DATABASE_URL="$TEST_DB_URL" npx prisma migrate deploy
DATABASE_URL="$TEST_DB_URL" npx prisma db seed

echo "Running tests..."
DATABASE_URL="$TEST_DB_URL" pnpm test:all

echo "All tests passed!"
