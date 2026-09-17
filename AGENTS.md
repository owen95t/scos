# AGENTS.md

## Workflow

- Trunk-based development: commit directly to `main`. No feature branches.
- Keep commits small and focused.

## Project

pnpm monorepo:
- `apps/api` — Fastify API server
- `packages/shared-types` — shared TypeScript types

## Commands

- `pnpm build` — build all packages
- `pnpm -r test` — run tests across packages
- `pnpm --filter api dev` — start API dev server
