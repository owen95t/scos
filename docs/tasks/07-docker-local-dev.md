# 07 — Docker + Local Dev

## Scope

- `docker-compose.yml` — postgres + api + web for local development
- `docker-compose.test.yml` — disposable postgres for tests (different port, ephemeral volume)
- `apps/api/Dockerfile` — multi-stage build for API
- `apps/web/Dockerfile` — multi-stage build for web (nginx serving built assets)

Root `package.json` test script should:
1. Start docker-compose.test.yml postgres
2. Run prisma migrations against it
3. Run api unit + integration + API tests
4. Run web tests
5. Tear down test postgres

## Acceptance Criteria

- `docker compose up` boots all 3 services, API connects to postgres, web serves on its port
- `docker compose -f docker-compose.test.yml up -d` starts test postgres
- `pnpm test` at root runs full test suite against test DB
- Dockerfiles build successfully

## Dependencies

- 06 (API layer — need working api to containerize)
- 08 (frontend — need web app to containerize; can do Dockerfiles after web exists)
