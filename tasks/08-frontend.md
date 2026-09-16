# 08 — Frontend

## Scope

`apps/web/` — Vite + React + TypeScript:

- `src/components/OrderForm.tsx` — form with quantity, latitude, longitude inputs + Verify/Submit buttons
- `src/components/QuoteSummary.tsx` — displays quote: subtotal, discount, shipping, total, validity
- `src/components/FulfillmentBreakdown.tsx` — table showing per-warehouse fulfillment legs
- `src/api/ordersClient.ts` — API client functions, imports types from `@scos/shared-types`
- `src/App.tsx` — single-page layout composing the above
- `src/main.tsx` — entry point
- `index.html`, `vite.config.ts`, `package.json`

No state management library, no routing — single screen.
Proxy API requests to backend in dev via Vite config.

## Acceptance Criteria

- `pnpm dev` starts Vite dev server
- Form submits verify request and displays quote
- Submit button creates order and shows order number
- Fulfillment breakdown renders per-warehouse legs
- Types imported from `@scos/shared-types`, not redeclared
- Basic component tests with Vitest + jsdom/happy-dom

## Dependencies

- 02 (shared types)
- 06 (API — need working endpoints to test against)
