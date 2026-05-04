# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Vite dev server (frontend only, no API)
npm run build        # tsc + vite build (output → dist/)
npm run lint         # ESLint

# Run the API test suite against live Supabase (requires env vars)
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ADMIN_CODE=... PURCHASE_CODE=... node scripts/test-api.mjs
```

There is no local API server for development — use `vercel dev` if you need to test serverless functions locally, or deploy to Vercel and test against the live URL.

## Architecture

**Stack:** React + Vite (static frontend) → Vercel serverless functions (`api/`) → Supabase (PostgreSQL).

```
api/          Vercel serverless functions (one file = one route)
lib/          Shared server-side utilities imported by api/ functions
src/          React frontend (Vite, never runs on the server)
scripts/      Dev tooling
```

### Critical deployment constraint

`package.json` has `"type": "module"`, so Node.js uses its ESM loader for all `.js` files at runtime. ESM requires **explicit `.js` extensions** on relative imports — the resolver will not append them. All imports from `api/` into `lib/` must use `.js`:

```ts
import { supabase } from '../lib/db.js';      // ✓
import { supabase } from '../lib/db';          // ✗ — ERR_MODULE_NOT_FOUND at runtime
```

Do not put shared utilities back into `api/` with an underscore prefix (`api/_db.ts`). Vercel excludes underscore-prefixed files from function bundles entirely — they won't be present at `/var/task/api/_db` at runtime.

### Shared server utilities (`lib/`)

| File | Purpose |
|------|---------|
| `lib/db.ts` | Supabase client (service role key), `DbGift`/`DbLink` types, `shapeGift()` mapper |
| `lib/adminAuth.ts` | `verifyAdminCode(req)` — timing-safe `Bearer` token check against `ADMIN_CODE` env var |
| `lib/enrichUtils.ts` | `enrichLink(url)` — scrapes OG tags + JSON-LD, falls back to Microlink API |

### API routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/gifts` | GET | none | Public gift list |
| `/api/mark-purchased` | POST | `PURCHASE_CODE` in body | Mark a gift purchased |
| `/api/admin/verify` | POST | `ADMIN_CODE` Bearer | Validate admin code |
| `/api/admin/gifts` | POST | `ADMIN_CODE` Bearer | Create gift + enrich links |
| `/api/admin/gifts/[id]` | PUT / DELETE | `ADMIN_CODE` Bearer | Update / delete gift |
| `/api/admin/gift-links/[id]` | DELETE | `ADMIN_CODE` Bearer | Delete a single link |
| `/api/enrich` | POST | `CRON_SECRET` Bearer | Re-enrich stale links (weekly cron) |

Two separate secrets: `PURCHASE_CODE` lets guests mark items as purchased; `ADMIN_CODE` allows full CRUD. Neither is exposed to the browser.

### Database (Supabase)

Two tables: `gifts` and `gift_links` (FK `gift_id → gifts.id`, cascade delete). Snake_case columns map to camelCase via `shapeGift()` in `lib/db.ts`. `gift_links` stores OG enrichment data (`og_title`, `og_image`, `og_price`, `og_brand`, `enriched_at`). When updating a gift's links, the API diffs by `id`: existing links without an `id` are inserted, links whose `id` is no longer present are deleted.

### Frontend data flow

`useGifts` (fetches, filters, sorts, exposes CRUD) and `useAdmin` (verifies code against `/api/admin/verify`, persists to `localStorage`) are the two hooks that drive everything. `GiftList` composes them; `GiftCard` is purely presentational. Admin modals (`AdminModal`, `AdminGiftForm`) are rendered via React portal to `document.body`.

### tsconfig scope

`tsconfig.json` only covers `src/` (`"include": ["src"]`). The `api/` and `lib/` files are **not type-checked** by the project tsconfig — they're compiled by Vercel's esbuild at deploy time. Run `npx tsc --noEmit` to check `src/` only.

## Environment variables

All secrets live in Vercel environment settings (never in the frontend bundle):

| Variable | Used by |
|----------|---------|
| `SUPABASE_URL` | `lib/db.ts` |
| `SUPABASE_SERVICE_ROLE_KEY` | `lib/db.ts` (full DB access — not the anon/publishable key) |
| `PURCHASE_CODE` | `api/mark-purchased.ts` |
| `ADMIN_CODE` | `lib/adminAuth.ts` via all `api/admin/*` routes |
| `CRON_SECRET` | `api/enrich.ts` |
