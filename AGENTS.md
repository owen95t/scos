# AGENTS.md

## Workflow

- Trunk-based development: commit directly to `main`. No feature branches.
- Keep commits small and focused.
- Never add AI attribution to commits or PRs: no `Co-Authored-By:` trailers for Claude or any other AI tool, and no "Generated with ..." lines.

## Project

Single-package backend (pnpm):
- `src/` — Fastify API server
- `src/types/` — shared TypeScript types (API response shapes in `api.ts`)

## Commands

- `pnpm build` — compile to `dist/`
- `pnpm test` — run tests
- `pnpm dev` — start API dev server
