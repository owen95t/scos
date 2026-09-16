# 01 — Workspace Setup

## Scope

- `pnpm-workspace.yaml` declaring `apps/*` and `packages/*`
- Root `package.json` with scripts that fan out to workspaces (`build`, `test`, `lint`, `dev`)
- `tsconfig.base.json` with shared compiler options (strict, ESM, path aliases)
- Root `.gitignore` (node_modules, dist, .env, prisma generated, etc.)

## Acceptance Criteria

- `pnpm install` succeeds from root (no workspaces exist yet, but yaml is valid)
- `tsconfig.base.json` is valid JSON and sets `strict: true`, `module: "ESNext"`, `moduleResolution: "bundler"`
- `.gitignore` covers node_modules, dist, .env*, prisma client output, docker volumes

## Dependencies

None — this is the first task.
