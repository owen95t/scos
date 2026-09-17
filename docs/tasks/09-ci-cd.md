# 09 — CI/CD

## Scope

`.github/workflows/ci.yml`:

Pipeline steps:
1. Lint (eslint across all workspaces)
2. Test — api and web in parallel:
   - API: spin up postgres service container, run prisma migrate, run unit + integration + API tests
   - Web: run component tests
3. Build all workspaces
4. Deploy step (placeholder/manual trigger — actual deploy config is out of scope)

## Acceptance Criteria

- Workflow YAML is valid
- Uses pnpm with caching
- Postgres service container for API tests
- API and web tests run in parallel via matrix or separate jobs
- Build step runs after tests pass

## Dependencies

- 06 (API tests must exist)
- 08 (web tests must exist)
