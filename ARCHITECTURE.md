# Wishlist — Architecture

## Overview

A public wishlist site shared with family and friends. Anyone with the URL can browse the list. Family members with a purchase code can mark items as purchased. All data lives in a managed database; the browser never holds credentials.

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                             │
│   React SPA (static assets served from Vercel CDN)         │
└──────────────┬──────────────────────────┬───────────────────┘
               │ GET /api/gifts           │ POST /api/mark-purchased
               │                          │ { giftId, purchaseCode }
               ▼                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   Vercel Serverless Functions               │
│                                                             │
│   api/gifts.ts           api/mark-purchased.ts             │
│   api/enrich.ts          (cron: weekly)                    │
│                                                             │
│   Env vars (server-side only, never in bundle):            │
│   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY                  │
│   PURCHASE_CODE, CRON_SECRET                               │
└──────────────────────────────┬──────────────────────────────┘
                               │ Supabase JS client
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                        Supabase                             │
│               (managed PostgreSQL, free tier)               │
│                                                             │
│   gifts table            gift_links table                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Components

### Frontend — React/Vite on Vercel

The React app is a fully static build deployed to Vercel's CDN. It has no knowledge of the database, the purchase code, or any credentials. All data access goes through the API layer.

- Public — no password gate to view the list
- Fetches gift data from `GET /api/gifts` on page load
- Filters and sorts entirely client-side (dataset is small enough)
- Purchase flow: user clicks "Mark as Purchased", enters the purchase code in a prompt, the code is POSTed to the API — never stored client-side beyond the duration of the request
- UI updates optimistically on success; reverts on failure

**Tech:** React 18, TypeScript, Vite, Tailwind CSS

### API Layer — Vercel Serverless Functions

Three functions in an `api/` directory at the project root. Vercel automatically routes requests to these and provides a Node.js runtime. Environment variables set in the Vercel dashboard are available here but never reach the browser.

```
api/
  gifts.ts           → GET  /api/gifts
  mark-purchased.ts  → POST /api/mark-purchased
  enrich.ts          → POST /api/enrich  (invoked by Vercel cron + manually)
```

All three use the Supabase JS client with the service role key, which has full database access. This key never leaves the server.

**Runtime:** `@vercel/node` (Node.js 20)
**Dependencies added:** `@supabase/supabase-js`, `cheerio`

### Database — Supabase (PostgreSQL)

Supabase hosts a managed Postgres database on their free tier (500 MB, no expiry). The database is the single source of truth for all gift data. Supabase's built-in REST and realtime features are not used directly by the browser — all access is mediated by the API functions.

### Link Enrichment — Vercel Cron

A weekly cron job invokes `POST /api/enrich`. The function queries for links that have never been enriched or were last enriched more than 7 days ago, fetches each URL server-side, parses Open Graph tags, and writes the results back to `gift_links`.

Because enrichment runs server-side, there are no CORS issues and no PAT or API key is exposed. Amazon URLs often do not serve useful OG data to bots; in those cases the enrichment is skipped and the manually entered `title` and `price_range` from the `gifts` table are used as fallback in the UI.

---

## Database Schema

```sql
CREATE TABLE gifts (
  id           TEXT        PRIMARY KEY,                -- e.g. "gift-001"
  title        TEXT        NOT NULL,
  description  TEXT,
  category     TEXT        NOT NULL DEFAULT 'other',   -- tech|home|games|clothing|books|fitness|other
  priority     TEXT        NOT NULL DEFAULT 'medium',  -- high|medium|low
  price_range  TEXT,                                   -- human string, e.g. "$50-100"
  purchased    BOOLEAN     NOT NULL DEFAULT FALSE,
  purchased_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE gift_links (
  id          SERIAL      PRIMARY KEY,
  gift_id     TEXT        NOT NULL REFERENCES gifts(id) ON DELETE CASCADE,
  url         TEXT        NOT NULL,
  store       TEXT,                                    -- "Amazon", "B&H", etc.
  og_title    TEXT,
  og_image    TEXT,
  og_price    TEXT,                                    -- raw string, e.g. "49.99"
  og_brand    TEXT,
  enriched_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

`gift_links` is normalized out of `gifts` so multiple store links per gift are stored as rows rather than nested JSON, making them independently queryable and updatable.

---

## API Contract

### GET /api/gifts

Returns all gifts with their links. No authentication required.

**Response 200**
```json
{
  "gifts": [
    {
      "id": "gift-001",
      "title": "Infomocracy",
      "description": "By Malka Older",
      "category": "books",
      "priority": "medium",
      "priceRange": "$10",
      "purchased": false,
      "purchasedAt": null,
      "links": [
        {
          "id": 1,
          "url": "https://www.amazon.com/...",
          "store": "Amazon",
          "ogTitle": "Infomocracy: Book One of the Centenal Cycle",
          "ogImage": "https://m.media-amazon.com/images/...",
          "ogPrice": "9.99",
          "ogBrand": "Malka Older",
          "enrichedAt": "2026-04-12T07:09:37.110Z"
        }
      ]
    }
  ]
}
```

The response shape mirrors the old `gifts.json` structure closely to minimize frontend changes. `ogTitle`, `ogImage`, `ogPrice`, `ogBrand` replace the old `schema.*` fields. All are nullable — the UI falls back to `title` and `priceRange` when absent.

---

### POST /api/mark-purchased

Verifies the purchase code server-side and marks the gift purchased. The purchase code is never returned to or stored by the client beyond the single request.

**Request body**
```json
{
  "giftId": "gift-001",
  "purchaseCode": "christmas24"
}
```

**Response 200**
```json
{ "success": true }
```

**Response 400** — missing fields
```json
{ "error": "giftId and purchaseCode are required" }
```

**Response 401** — wrong code
```json
{ "error": "Invalid purchase code" }
```

**Response 404** — unknown gift
```json
{ "error": "Gift not found" }
```

**Response 409** — already purchased
```json
{ "error": "Gift is already marked as purchased" }
```

The function updates `purchased = true` and `purchased_at = NOW()` atomically. Because this is a real database write, the response is authoritative — the UI can trust a 200 and update immediately without a polling delay.

---

### POST /api/enrich

Fetches Open Graph metadata for un-enriched or stale gift links. Protected by a bearer token so it cannot be called arbitrarily by the public.

**Authorization header**
```
Authorization: Bearer <CRON_SECRET>
```

**Behavior**
1. Queries `gift_links` where `enriched_at IS NULL OR enriched_at < NOW() - INTERVAL '7 days'`
2. For each link: fetches the URL server-side with a browser-like `User-Agent`, parses OG tags via Cheerio
3. Writes `og_title`, `og_image`, `og_price`, `og_brand`, and `enriched_at` back to the row
4. If fetch fails or no useful OG data is found, updates only `enriched_at` (marking it attempted) to prevent repeated failures on the same URL

**Response 200**
```json
{ "enriched": 3, "skipped": 1, "failed": 0 }
```

This endpoint is invoked by the Vercel cron job weekly and can also be triggered manually by hitting the URL with the correct bearer token (e.g. via `curl`).

---

## Data Flows

### Page Load

```
1. Browser requests wishlist.vercel.app
2. Vercel CDN serves static HTML/JS/CSS (no auth)
3. React app boots, calls GET /api/gifts
4. api/gifts.ts queries Supabase:
     SELECT gifts.*, gift_links.*
     FROM gifts
     LEFT JOIN gift_links ON gift_links.gift_id = gifts.id
     ORDER BY gifts.created_at
5. Transforms rows into nested Gift[] structure
6. Returns JSON to browser
7. React renders list; filtering/sorting runs client-side
```

### Mark as Purchased

```
1. User clicks "Mark as Purchased" on a gift card
2. UI shows a purchase code input (inline or small modal)
3. User enters code and submits
4. Browser POSTs { giftId, purchaseCode } to /api/mark-purchased
5. api/mark-purchased.ts:
     a. Validates fields present
     b. Compares purchaseCode to process.env.PURCHASE_CODE (constant-time)
     c. Queries gifts table: confirm gift exists and is not already purchased
     d. UPDATE gifts SET purchased=true, purchased_at=NOW() WHERE id=giftId
     e. Returns 200 { success: true }
6. Browser receives 200, updates local state immediately — no refetch needed
7. Gift card shows purchased state (strikethrough, reduced opacity, no button)
```

### Weekly Enrichment (Cron)

```
1. Vercel cron fires POST /api/enrich with Authorization: Bearer CRON_SECRET
2. api/enrich.ts queries gift_links for stale/missing enrichment
3. For each link (with 1s delay between requests):
     a. fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 ...' } })
     b. cheerio.load(html)
     c. Extract og:title, og:image, product:price:amount (or og:price:amount), og:brand
     d. UPDATE gift_links SET og_title=..., og_image=..., enriched_at=NOW()
4. Returns summary { enriched, skipped, failed }
```

---

## Environment Variables

| Variable | Where set | Reaches browser? | Purpose |
|---|---|---|---|
| `SUPABASE_URL` | Vercel dashboard | No | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel dashboard | No | Full DB access from API functions |
| `PURCHASE_CODE` | Vercel dashboard | No | Shared code for marking gifts purchased |
| `CRON_SECRET` | Vercel dashboard | No | Protects `/api/enrich` from public invocation |

No `VITE_` prefixed variables remain. Nothing sensitive is embedded in the client bundle.

---

## Security Model

**Credential exposure**: Eliminated. No PAT, no DB key, no purchase code ever reaches the browser. All secrets live in Vercel's environment variable store and are only accessible inside serverless function processes.

**Purchase code**: Checked server-side with a constant-time string comparison. Even if someone inspects every byte of the JS bundle they cannot find the code. The code can be changed at any time by updating the Vercel env var and redeploying (one click).

**Viewing the list**: Intentionally public. The threat model for a personal wishlist is "family and friends should see it" — no authentication barrier makes it easier to share. If you ever want to restrict viewing, add a `VIEW_CODE` env var and check it in `GET /api/gifts`.

**Database access**: The browser never touches Supabase directly. All DB calls go through the API functions using the service role key. Supabase row-level security is not configured because it is not needed — the API functions are the only client.

**Enrichment endpoint**: Protected by bearer token. Without `CRON_SECRET`, the endpoint returns 401. This prevents someone from triggering mass URL fetches at your expense.

---

## Deployment Topology

```
GitHub (source of truth)
  │
  └─ push to main
        │
        ▼
  Vercel (automatic deploy via GitHub integration)
    ├─ Static build: vite build → CDN
    └─ API functions: api/*.ts → serverless runtime
        │
        └─ Reads env vars from Vercel dashboard
              (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
               PURCHASE_CODE, CRON_SECRET)

Supabase (always-on managed Postgres)
  └─ Accessed only by Vercel functions, never by browser
```

Vercel's GitHub integration redeploys automatically on every push to `main`. No GitHub Actions workflows are needed for deployment. The existing `deploy.yml`, `mark-bought.yml`, and `enrich-links.yml` workflows are removed.

---

## What Is Removed

| Removed | Replaced by |
|---|---|
| `VITE_GITHUB_PAT` in client bundle | No client-side credential at all |
| `src/lib/github.ts` (PAT + workflow_dispatch) | `POST /api/mark-purchased` |
| `src/components/PasswordPrompt.tsx` | Site is public |
| `public/data/gifts.json` as database | Supabase `gifts` + `gift_links` tables |
| `scripts/enrich-links.mjs` + GitHub Action | `api/enrich.ts` + Vercel cron |
| `.github/workflows/deploy.yml` | Vercel GitHub integration |
| `.github/workflows/mark-bought.yml` | `api/mark-purchased.ts` |
| `.github/workflows/enrich-links.yml` | `api/enrich.ts` + Vercel cron |
| SHA-256 hash in `PasswordPrompt.tsx` | `PURCHASE_CODE` env var, server-side |
| 3-second polling delay after purchase | Authoritative DB write, immediate UI update |
| `ProductSchema` / `schema.*` fields | `og*` fields on `GiftLink` |
