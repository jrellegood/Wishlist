# Wishlist — Implementation Plan

Steps are grouped into phases. Dependencies are listed per step so work can be parallelized where possible. Each step notes which files are created, modified, or deleted.

---

## Phase 1 — Infrastructure (no code changes)

These steps happen outside the codebase. Complete all of Phase 1 before writing any code; you will need the Supabase credentials to configure the API layer.

---

### Step 1 — Create Supabase project

**Depends on:** nothing

1. Go to supabase.com, create a free account and a new project
2. Choose a region close to you
3. Note the **Project URL** and **service role key** from Project Settings → API
   - `SUPABASE_URL` = the Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` = the `service_role` key (not `anon`)

---

### Step 2 — Create database schema

**Depends on:** Step 1

In the Supabase dashboard, open the SQL Editor and run:

```sql
CREATE TABLE gifts (
  id           TEXT        PRIMARY KEY,
  title        TEXT        NOT NULL,
  description  TEXT,
  category     TEXT        NOT NULL DEFAULT 'other',
  priority     TEXT        NOT NULL DEFAULT 'medium',
  price_range  TEXT,
  purchased    BOOLEAN     NOT NULL DEFAULT FALSE,
  purchased_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE gift_links (
  id          SERIAL      PRIMARY KEY,
  gift_id     TEXT        NOT NULL REFERENCES gifts(id) ON DELETE CASCADE,
  url         TEXT        NOT NULL,
  store       TEXT,
  og_title    TEXT,
  og_image    TEXT,
  og_price    TEXT,
  og_brand    TEXT,
  enriched_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### Step 3 — Migrate gifts.json data into the database

**Depends on:** Step 2

Write a one-time Node.js migration script (does not live in the repo permanently):

```js
// migrate.mjs  — run once, then delete
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { gifts } = JSON.parse(readFileSync('./public/data/gifts.json', 'utf8'));

for (const gift of gifts) {
  await supabase.from('gifts').insert({
    id: gift.id,
    title: gift.title,
    description: gift.description,
    category: gift.category,
    priority: gift.priority,
    price_range: gift.priceRange,
    purchased: gift.purchased,
    purchased_at: gift.purchased ? new Date().toISOString() : null,
  });

  for (const link of gift.links ?? []) {
    await supabase.from('gift_links').insert({
      gift_id: gift.id,
      url: link.url,
      store: link.store,
      og_title: link.schema?.name ?? null,
      og_image: link.schema?.image ?? null,
      og_price: link.schema?.offers?.price ?? null,
      og_brand: link.schema?.brand?.name ?? null,
      enriched_at: link.schemaFetchedAt ?? null,
    });
  }
}
console.log('Done');
```

Run it with:
```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node migrate.mjs
```

Verify in the Supabase Table Editor that all 40 gifts and their links are present.

---

### Step 4 — Connect repo to Vercel

**Depends on:** nothing (can run in parallel with Steps 1–3)

1. Go to vercel.com, create a free Hobby account
2. Import the GitHub repo (`jrellegood/wishlist`)
3. Framework preset: **Vite**
4. Build command: `npm run build`
5. Output directory: `dist`
6. Do not set environment variables yet — that's Step 5

Vercel will attempt a first deploy and succeed (the current code still works against the static JSON).

---

### Step 5 — Set Vercel environment variables

**Depends on:** Steps 1 and 4

In Vercel → Project → Settings → Environment Variables, add:

| Name | Value | Environments |
|---|---|---|
| `SUPABASE_URL` | your Supabase project URL | Production, Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | your service role key | Production, Preview |
| `PURCHASE_CODE` | a short phrase you'll share with family | Production, Preview |
| `CRON_SECRET` | a random string (e.g. `openssl rand -hex 20`) | Production, Preview |

These are never exposed to the browser — they are only available inside the serverless function processes.

---

## Phase 2 — API Layer

All new code. Steps 6–9 can be written in parallel once Phase 1 is complete.

---

### Step 6 — Install new dependencies

**Depends on:** Phase 1 complete (need to know the stack)

```bash
npm install @supabase/supabase-js cheerio
npm install --save-dev @vercel/node
```

**Files modified:** `package.json`, `package-lock.json`

---

### Step 7 — Create api/gifts.ts

**Depends on:** Steps 2, 6

**File created:** `api/gifts.ts`

Query `gifts` joined to `gift_links`, transform to the response shape defined in the architecture doc, return JSON. No authentication — this endpoint is public.

Key implementation notes:
- Use a single query with Supabase's `select('*, gift_links(*)')` to avoid N+1
- Group the flat rows by gift ID into the nested `{ gifts: [{ ..., links: [] }] }` shape
- Set `Cache-Control: no-store` so browsers always get fresh data

---

### Step 8 — Create api/mark-purchased.ts

**Depends on:** Steps 2, 6

**File created:** `api/mark-purchased.ts`

Validate request body, compare `purchaseCode` to `process.env.PURCHASE_CODE` using a constant-time comparison (Node's `crypto.timingSafeEqual`), query to confirm the gift exists and is not already purchased, then update.

Key implementation notes:
- Only accept `POST`; return 405 for other methods
- Return specific error codes (400, 401, 404, 409) per the API contract in ARCHITECTURE.md
- The comparison must be timing-safe to prevent timing attacks on the purchase code, even though this is a low-stakes app — it's the right habit

---

### Step 9 — Create api/enrich.ts

**Depends on:** Steps 2, 6

**File created:** `api/enrich.ts`

Check `Authorization: Bearer <CRON_SECRET>` header, query stale gift links, fetch each URL, parse OG tags, write results back.

Key implementation notes:
- Only accept `POST`; return 405 for other methods
- Return 401 if the bearer token is missing or wrong
- OG tags to target (in priority order):
  - Title: `og:title` → `<title>`
  - Image: `og:image`
  - Price: `product:price:amount` → `og:price:amount` → `og:price`
  - Brand: `og:brand` → `og:site_name`
- Always write `enriched_at = NOW()` even on failure, so the cron doesn't retry broken URLs every week
- Add a 1-second delay between requests to be a polite scraper
- Set a 10-second fetch timeout per URL

---

### Step 10 — Create vercel.json

**Depends on:** Step 9

**File created:** `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/enrich",
      "schedule": "0 6 * * 0"
    }
  ]
}
```

Vercel cron does not support passing headers, so the cron invocation hits the endpoint without the bearer token. Handle this by also accepting an `x-vercel-cron: 1` header that Vercel automatically sets on cron-triggered requests, in addition to the bearer token check.

Update `api/enrich.ts` to accept either:
- `Authorization: Bearer <CRON_SECRET>` (manual invocation)
- `x-vercel-cron: 1` header (automatic Vercel cron)

---

## Phase 3 — Frontend Updates

These steps update the React app to use the new API. Steps 11–13 can be done in parallel. Steps 14–16 depend on 11.

---

### Step 11 — Update src/types.ts

**Depends on:** nothing (pure type change)

**File modified:** `src/types.ts`

Replace `ProductSchema`, `SchemaOffer`, `SchemaBrand` with flat OG fields on `GiftLink`. Add `purchasedAt` to `Gift`. Remove `GiftsData` wrapper (no longer needed; hook can return `Gift[]` directly).

```typescript
export interface GiftLink {
  id: number;
  url: string;
  store: string;
  ogTitle?: string;
  ogImage?: string;
  ogPrice?: string;
  ogBrand?: string;
  enrichedAt?: string;
}

export interface Gift {
  id: string;
  title: string;
  description: string;
  category: Category;
  priority: Priority;
  priceRange: string;
  purchased: boolean;
  purchasedAt: string | null;
  links: GiftLink[];
}
```

---

### Step 12 — Update src/hooks/useGifts.ts

**Depends on:** Step 11

**File modified:** `src/hooks/useGifts.ts`

- Change fetch target from `/Wishlist/data/gifts.json` to `/api/gifts`
- Update response parsing for the new shape
- Remove the cache-busting timestamp query param and the `refetchGifts` function — the UI will update local state directly after a successful purchase instead of refetching
- Add a `markPurchased(giftId: string)` function that updates local state optimistically, then confirm/revert based on the API response (see Step 14)

---

### Step 13 — Update src/App.tsx

**Depends on:** nothing (independent simplification)

**File modified:** `src/App.tsx`

Remove all password gate logic. The app now renders `<GiftList />` directly. Delete the `authenticated` state, the `handleAuthSuccess` callback, and the `<PasswordPrompt />` conditional.

---

### Step 14 — Update src/components/GiftCard.tsx

**Depends on:** Steps 11, 12

**File modified:** `src/components/GiftCard.tsx`

Three changes:

**1. Replace schema fields with OG fields**

Old: `link.schema?.name`, `link.schema?.image`, `link.schema?.offers?.price`, `link.schema?.brand?.name`
New: `link.ogTitle`, `link.ogImage`, `link.ogPrice`, `link.ogBrand`

Fallback behavior is unchanged: if OG fields are absent, fall back to `gift.title` and `gift.priceRange`.

**2. Replace the GitHub workflow trigger with a purchase code prompt**

Remove the import of `markGiftAsBought` from `src/lib/github.ts`.

Add local state for the purchase code flow:
```
isPurchasing: boolean
purchaseCode: string
purchaseError: string
```

When the user clicks "Mark as Purchased":
- Show an inline input for the purchase code (below the button, not a separate modal)
- On submit, POST to `/api/mark-purchased` with `{ giftId, purchaseCode }`
- On 200: call the `onMarkPurchased(giftId)` callback from the hook (updates parent state)
- On 401: show "Incorrect code" error inline
- On any other error: show a generic error message
- Clear the purchase code from state after the request (success or failure)

**3. Remove the 3-second delay**

Delete the `setTimeout` that delayed the refetch. The UI update is now immediate and authoritative.

---

### Step 15 — Update src/components/GiftList.tsx

**Depends on:** Step 12

**File modified:** `src/components/GiftList.tsx`

Update the props passed to `<GiftCard>`:
- Remove `refetchGifts` prop (no longer needed)
- Pass `onMarkPurchased` callback from the hook instead

---

### Step 16 — Update vite.config.ts

**Depends on:** nothing

**File modified:** `vite.config.ts`

Change the hardcoded base path:
```typescript
// Before
base: '/Wishlist/',

// After
base: process.env.VITE_BASE_PATH ?? '/',
```

On Vercel, no `VITE_BASE_PATH` is set, so the app serves from `/`. If you ever need the GitHub Pages path for a preview, set `VITE_BASE_PATH=/Wishlist/` in that environment.

---

## Phase 4 — Deletions

Clean up everything the new architecture replaces. Do these after Phase 3 is working end-to-end locally.

---

### Step 17 — Delete src/lib/github.ts

**Depends on:** Step 14 (GiftCard no longer imports it)

**File deleted:** `src/lib/github.ts`

---

### Step 18 — Delete src/components/PasswordPrompt.tsx

**Depends on:** Step 13 (App.tsx no longer imports it)

**File deleted:** `src/components/PasswordPrompt.tsx`

---

### Step 19 — Delete GitHub Actions workflows

**Depends on:** Phase 3 complete and Vercel auto-deploy confirmed working

**Files deleted:**
- `.github/workflows/deploy.yml` — replaced by Vercel GitHub integration
- `.github/workflows/mark-bought.yml` — replaced by `api/mark-purchased.ts`
- `.github/workflows/enrich-links.yml` — replaced by `api/enrich.ts` + Vercel cron

---

### Step 20 — Delete old scripts and data files

**Depends on:** Step 3 (migration complete and verified)

**Files deleted:**
- `scripts/enrich-links.mjs` — replaced by `api/enrich.ts`
- `public/data/gifts.json` — data now lives in Supabase (keep a local copy as backup if desired)
- `ProjectPlan.md` — superseded by ARCHITECTURE.md (optional)

---

## Phase 5 — Verify and Ship

---

### Step 21 — Local development testing

**Depends on:** Phases 2 and 3 complete

Install the Vercel CLI and run locally:
```bash
npm install -g vercel
vercel dev
```

`vercel dev` runs both the Vite dev server and the serverless functions together, using the environment variables from your Vercel project (pulled automatically). This is the closest local equivalent to production.

Test the following flows:
- Page loads and displays all gifts
- Filter by category, sort, hide purchased — all work client-side
- Click "Mark as Purchased" on an un-purchased gift
  - Enter wrong code → inline error shown
  - Enter correct code → gift immediately shows purchased state
- Purchased gift shows at bottom, strikethrough, no button
- Invoke enrichment manually: `curl -X POST http://localhost:3000/api/enrich -H "Authorization: Bearer <CRON_SECRET>"`

---

### Step 22 — Deploy to production

**Depends on:** Step 21 passing

Push to `main`. Vercel automatically builds and deploys. Visit the Vercel-assigned URL (or your custom domain if configured) and run the same tests against production.

Confirm:
- Browser DevTools → Network → no requests to `api.github.com`
- Browser DevTools → Sources → no PAT, no purchase code visible in any JS file
- Purchase flow works end-to-end with the real database

---

## Dependency Graph

```
Step 1 ──► Step 2 ──► Step 3
                          │
Step 4 ──► Step 5         │
                          │
           Phase 1 complete
           │
           ▼
Step 6 ──► Step 7 ──────────────────────────► Step 21 ──► Step 22
       ├── Step 8 ──► (Step 14, Step 15)──► ┘
       └── Step 9 ──► Step 10

Step 11 ──► Step 12 ──► Step 15
        └── Step 14 ──┘

Step 13  (independent)
Step 16  (independent)

Phase 3 complete ──► Step 17, 18, 19, 20 (deletions, any order)
```

---

## Estimated Effort

| Phase | Steps | Effort |
|---|---|---|
| Infrastructure | 1–5 | ~1 hour (mostly waiting for Supabase/Vercel setup UI) |
| API Layer | 6–10 | ~2–3 hours |
| Frontend Updates | 11–16 | ~1–2 hours |
| Deletions | 17–20 | ~15 minutes |
| Testing | 21–22 | ~30 minutes |
| **Total** | | **~5–6 hours** |

The API layer (Phase 2) is the most novel work. The frontend changes (Phase 3) are mostly mechanical substitutions — the component structure stays the same.
