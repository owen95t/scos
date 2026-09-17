# AGENTS.md

## Workflow

- Trunk-based development: commit directly to `main`. No feature branches.
- Keep commits small and focused.

## Project

Single-package backend (pnpm):
- `src/` — Fastify API server
- `src/shared-types/` — shared TypeScript response types (`#shared-types`)

## Commands

- `pnpm build` — compile to `dist/`
- `pnpm test` — run tests
- `pnpm dev` — start API dev server
