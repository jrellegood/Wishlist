# Wishlist Website Project Plan

## Overview

A static wishlist website hosted on GitHub Pages where family/friends can view gift ideas and mark items as purchased. Protected by a simple shared password. Product links are automatically enriched with schema.org Product data for rich card displays.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        GitHub Repository                        │
├─────────────────┬─────────────────┬─────────────────────────────┤
│  Static Site    │  Data Layer     │  Automation                 │
│  React + Vite   │  gifts.json     │  deploy.yml (on push)       │
│  Tailwind CSS   │                 │  mark-bought.yml (dispatch) │
│  GitHub Pages   │                 │  enrich-links.yml (weekly)  │
└─────────────────┴─────────────────┴─────────────────────────────┘
```

## Tech Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Hosting:** GitHub Pages
- **Data:** JSON file in repo, enriched with schema.org Product data
- **Automation:** GitHub Actions for deploy, purchase marking, and link enrichment

-----

## Data Model

`data/gifts.json` structure:

```json
{
  "gifts": [
    {
      "id": "unique-id",
      "title": "Human-provided title (fallback)",
      "description": "Why I want this / notes",
      "category": "tech | home | games | clothing | books | other",
      "priority": "high | medium | low",
      "priceRange": "Approximate like $50-100 (fallback)",
      "purchased": false,
      "links": [
        {
          "url": "https://amazon.com/...",
          "store": "Amazon",
          "schema": {
            "@type": "Product",
            "name": "Exact product name from site",
            "image": "https://...",
            "brand": { "name": "Brand" },
            "offers": { "price": "94.99", "priceCurrency": "USD" }
          },
          "schemaFetchedAt": "2024-12-20T06:00:00Z"
        }
      ]
    }
  ]
}
```

The `schema` and `schemaFetchedAt` fields are populated automatically by the enrichment workflow. When adding gifts manually, just provide `url` and `store`.

-----

## GitHub Actions Workflows

### 1. deploy.yml

- **Triggers:** Push to main, workflow_dispatch
- **Purpose:** Build Vite app and deploy to GitHub Pages
- **Environment:** Needs `WISHLIST_PAT` secret for the mark-bought feature to work client-side

### 2. mark-bought.yml

- **Triggers:** workflow_dispatch with `gift_id` input
- **Purpose:** Update gifts.json to set `purchased: true` for the given ID
- **Implementation:** Use `jq` to modify JSON, then auto-commit

### 3. enrich-links.yml

- **Triggers:** Push to gifts.json, weekly cron schedule, workflow_dispatch
- **Purpose:** Fetch product URLs and extract schema.org JSON-LD data
- **Logic:**
  - For each link, skip if `schemaFetchedAt` is less than 7 days old
  - Fetch the URL server-side (bypasses CORS)
  - Parse HTML for `<script type="application/ld+json">` containing Product schema
  - Store relevant fields (name, image, brand, price) and timestamp
  - Commit changes if any updates were made
- **Dependencies:** cheerio for HTML parsing

-----

## Frontend Components

### App.tsx

- Password gate using localStorage for persistence
- Password: `familywishes2024` (hardcoded, easily changeable)
- Renders FilterBar and GiftList when authenticated

### PasswordPrompt.tsx

- Simple centered form
- Shows error on wrong password

### FilterBar.tsx

- Filter by category (dropdown or chips)
- Sort by priority, category, or title
- Toggle to hide purchased items

### GiftList.tsx

- Fetches gifts.json at runtime
- Applies filters/sorting
- Purchased items sink to bottom
- Responsive grid layout

### GiftCard.tsx

Two display modes based on schema availability:

**With schema data:**

- Product image (if available)
- Product name from schema (overrides manual title)
- Brand display
- Actual price from offers
- Your description shown as personal note
- Store links as buttons

**Without schema (fallback):**

- Manual title and description
- Price range estimate
- Store links if URLs provided

**Common elements:**

- Priority indicator (color-coded)
- Category badge
- “Mark as Bought” button → triggers workflow_dispatch
- Purchased state: greyed out, strikethrough, moved to bottom

### lib/github.ts

- Function to trigger mark-bought workflow via GitHub API
- Uses PAT baked in at build time via env var

-----

## Styling Direction

- Clean, minimal, card-based layout
- Responsive: 1 column mobile → 2-3 columns desktop
- Priority colors: red/orange (high), amber (medium), gray (low)
- Purchased items: reduced opacity, muted colors, strikethrough title
- Product images should be consistent size/aspect ratio when displayed
- Pleasant neutral palette with subtle accent color

-----

## File Structure

```
wishlist/
├── .github/workflows/
│   ├── deploy.yml
│   ├── mark-bought.yml
│   └── enrich-links.yml
├── scripts/
│   └── enrich-links.mjs      # Node script for schema extraction
├── data/
│   └── gifts.json
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── types.ts
│   ├── components/
│   │   ├── PasswordPrompt.tsx
│   │   ├── GiftList.tsx
│   │   ├── GiftCard.tsx
│   │   └── FilterBar.tsx
│   ├── hooks/
│   │   └── useGifts.ts
│   └── lib/
│       └── github.ts
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── README.md
```

-----

## Environment & Secrets

**Build-time env vars (in workflow):**

- `VITE_GITHUB_OWNER` — repo owner
- `VITE_GITHUB_REPO` — repo name
- `VITE_GITHUB_PAT` — from secrets, for client-side workflow dispatch

**Repository secret:**

- `WISHLIST_PAT` — Personal Access Token with `contents:write` and `actions:write` scopes

-----

## Setup Instructions (for README)

1. Create GitHub repo
1. Generate PAT with `contents:write` and `actions:write` on the repo
1. Add `WISHLIST_PAT` secret in repo settings
1. Enable GitHub Pages with “GitHub Actions” as source
1. Update `vite.config.ts` base path to match repo name
1. Push to main → triggers deploy

**To add gifts:** Edit `data/gifts.json`, add entries with URLs. Enrichment runs automatically on push and weekly.

**To change password:** Edit the constant in `App.tsx`

-----

## Implementation Phases

1. **Project setup:** Vite + React + TypeScript + Tailwind, basic file structure
1. **Static display:** Types, sample data, GiftCard and GiftList rendering
1. **Filtering/sorting:** FilterBar wired to list, purchased items handling
1. **Password gate:** PasswordPrompt, localStorage auth state
1. **Schema-aware cards:** Conditional rendering based on schema presence
1. **GitHub workflows:** All three workflows, enrichment script
1. **Mark as bought:** Client-side workflow trigger, confirmation UX
1. **Polish:** Loading states, error handling, responsive tweaks, README
