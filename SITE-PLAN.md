# mossymesh.com — Site Plan

**Domain:** https://mossymesh.com (owned)  
**Repo:** https://github.com/movahedi-ca/mossymesh-com  
**Product source:** https://github.com/movahedi-ca/MossyMesh  
**Host:** Cloudflare Pages (static + optional Functions)

## Product one-liner

MossyMesh (MessyMash PoC) turns phones, Raspberry Pis, PCs, and LoRa radios into a decentralized offline compute mesh — censorship-resistant, identity-routed, with deterministic WASM jobs and a ≤10 MB edge ledger. Chess PoC proves cross-device state determinism.

## Design goals

1. **Marketing-grade** landing for founders, developers, and mesh operators.
2. **API-friendly** from day one: machine-readable JSON under `/api/*`, OpenAPI 3.1, CORS-ready, no SPA-only content trap.
3. **Deployable** to Cloudflare Pages on `mossymesh.com` with clear DNS steps.

## Agent ownership (no overlap)

| Agent | Role | Owns |
| --- | --- | --- |
| A | Frontend / Brand | `src/`, `public/` (except `public/api/`), `index.html` or Astro pages, styles, assets |
| B | API surface | `public/api/**`, `openapi/**`, `functions/api/**` (if CF Functions), API docs page content data |
| C | Deploy / Domain | `wrangler.toml`, `package.json` scripts, `.github/workflows/`, `DEPLOY.md`, headers/CORS `_headers`/`_redirects` |

## Stack (agreed)

- **Vite + vanilla TS or lightweight Astro** — prefer **Vite multi-page or single index + secondary pages** for zero lock-in.
- Static JSON in `public/api/` so CDN serves APIs without a backend.
- Optional Cloudflare Pages Functions only for dynamic stubs (`/api/health` live check).
- Dark, technical, trustworthy aesthetic (mesh / edge / crypto-adjacent, not gamer neon).

## Must-have pages

- `/` — hero, mission, SLAs, phases, CTAs (GitHub, docs, API)
- `/docs` or `/developers` — human docs linking to OpenAPI
- `/api` index listing endpoints
- `/api/v1/project.json`, `/api/v1/health.json`, `/api/v1/phases.json`, `/api/v1/stack.json`
- `/openapi.yaml` (or `.json`) — full OpenAPI 3.1 for the public gateway surface (from MossyMesh interop contracts)

## SLAs to surface (from MossyMesh README)

- ≤10 MB active ledger on edge
- <1% unverifiable outputs
- <5% job timeout in unstable RF
- No centralized DNS/IP/cloud DB as control plane
- Chess PoC ~836 Mnps class engine target

## API-friendly rules

- All marketing facts also available as JSON
- `Access-Control-Allow-Origin: *` on `/api/*` via `_headers`
- Stable versioning under `/api/v1/`
- OpenAPI documents real + planned mesh gateway routes (`/api/v1/health`, `/api/v1/submit_job`, etc.)
- `llms.txt` and optional `robots.txt` allowing API paths

## Non-goals

- Full mesh node backend in this repo
- Fiat payment / crypto token sale UI
- Copying the entire Rust monorepo
