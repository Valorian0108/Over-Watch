# Tidepool

Tidepool is a live CoinMarketCap observatory that makes crypto and real-world asset signals easier to read.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `COINMARKETCAP_API_KEY` — CoinMarketCap Pro API access

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/living-market/src/App.tsx` — single-screen Tidepool observatory UI
- `artifacts/living-market/src/index.css` — responsive visual system and motion rules
- `artifacts/api-server/src/routes/market.ts` — normalized CoinMarketCap overview, asset, search, RWA, and explanation routes
- `lib/api-spec/openapi.yaml` — source of truth for market API contracts

## Architecture decisions

- The first release uses a deliberately narrow observatory surface instead of a conventional multi-page terminal.
- Explanations are deterministic and grounded in the latest returned snapshot; the UI never presents invented values.
- CoinMarketCap RWA data is currently metadata-first, so unquoted price and change fields remain explicitly unreported.
- API clients and Zod schemas are generated from the OpenAPI contract.

## Product

- Live total market cap, volume, BTC dominance, and signal count
- Crypto, real-world asset, and combined focus lenses
- CMC-backed asset search from the Signals section
- Selectable asset detail cards with source/as-of context
- Plain-language “Ask the market” explanations grounded in the current snapshot, with optional AgentRouter support and deterministic fallback
- Honest loading, empty, partial-data, and source-error states

## User preferences

No persistent user preferences recorded.

## Gotchas

- Regenerate generated API clients after changing `lib/api-spec/openapi.yaml`.
- RWA market quotes are not available on the current CMC route; do not substitute fake prices for metadata.
- AgentRouter may return an anti-bot HTML challenge to server-side requests; preserve the deterministic explainer fallback when its JSON API is unavailable.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
