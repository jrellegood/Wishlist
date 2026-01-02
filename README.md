# Wishlist Website

A password-protected wishlist website hosted on GitHub Pages where family and friends can view gift ideas and mark items as purchased. Product links are automatically enriched with schema.org Product data for rich card displays.

## Features

- **Password Protection**: SHA-256 hashed password to control access
- **Automatic Product Enrichment**: Links are enriched with product data (name, image, price, brand) from schema.org markup
- **Mark as Bought**: Click a button to mark gifts as purchased via GitHub Actions
- **Filter & Sort**: Filter by category, sort by priority/category/title, hide purchased items
- **Responsive Design**: Works seamlessly on mobile, tablet, and desktop
- **Static & Fast**: Built with Vite and hosted on GitHub Pages

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **Hosting**: GitHub Pages
- **Data**: JSON file in repository
- **Automation**: GitHub Actions for deployment, purchase marking, and link enrichment

## Setup Instructions

### 1. Initial Repository Setup

1. Fork or clone this repository
2. Enable GitHub Pages:
   - Go to repository **Settings** → **Pages**
   - Set **Source** to "GitHub Actions"

### 2. Create Personal Access Token (PAT)

1. Go to GitHub **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2. Click **Generate new token (classic)**
3. Give it a descriptive name (e.g., "Wishlist Automation")
4. Select scopes:
   - `repo` (Full control of private repositories)
   - `workflow` (Update GitHub Action workflows)
5. Click **Generate token** and copy the token value

### 3. Add Repository Secret

1. Go to your repository **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `WISHLIST_PAT`
4. Value: Paste the PAT you created above
5. Click **Add secret**

### 4. Configure Repository Name

If your repository name is different from "Wishlist", update the base path in `vite.config.ts`:

```typescript
export default defineConfig({
  plugins: [react()],
  base: '/your-repo-name/', // Update this
  // ...
})
```

### 5. Deploy

Push to the `main` branch, and GitHub Actions will automatically build and deploy your site. The site will be available at:

```
https://<username>.github.io/<repo-name>/
```

## Usage

### Adding Gifts

Edit `public/data/gifts.json` and add new gift entries:

```json
{
  "id": "unique-id",
  "title": "Gift Title",
  "description": "Why I want this",
  "category": "tech",
  "priority": "high",
  "priceRange": "$50-100",
  "purchased": false,
  "links": [
    {
      "url": "https://example.com/product",
      "store": "Store Name"
    }
  ]
}
```

**Categories**: `tech`, `home`, `games`, `clothing`, `books`, `other`
**Priorities**: `high`, `medium`, `low`

When you push changes to `gifts.json`, the enrichment workflow will automatically fetch product schema data from the URLs.

### Marking Items as Purchased

When viewing the wishlist:

1. Click the "Mark as Bought" button on a gift card
2. Confirm the action
3. The workflow will update `gifts.json` and the item will show as purchased
4. Refresh the page after a few seconds to see the update

### Changing the Password

The password is stored as a SHA-256 hash for basic security. To change it:

1. Generate the SHA-256 hash of your new password:
   ```bash
   node -e "const crypto = require('crypto'); console.log(crypto.createHash('sha256').update('YourNewPassword').digest('hex'));"
   ```

2. Edit `src/components/PasswordPrompt.tsx` and update the hash constant:
   ```typescript
   const CORRECT_PASSWORD_HASH = 'your-new-hash-here';
   ```

3. Rebuild and deploy after making changes.

### Manual Enrichment

To manually trigger product schema enrichment:

1. Go to **Actions** tab in your repository
2. Select "Enrich Product Links" workflow
3. Click **Run workflow**

The workflow also runs automatically:
- When `public/data/gifts.json` is updated
- Weekly on Sundays at 6 AM UTC

## Project Structure

```
wishlist/
├── .github/workflows/
│   ├── deploy.yml           # Build and deploy to GitHub Pages
│   ├── mark-bought.yml      # Mark gifts as purchased
│   └── enrich-links.yml     # Fetch product schema data
├── scripts/
│   └── enrich-links.mjs     # Schema extraction script
├── public/
│   └── data/
│       └── gifts.json       # Gift data
├── src/
│   ├── components/
│   │   ├── PasswordPrompt.tsx
│   │   ├── GiftList.tsx
│   │   ├── GiftCard.tsx
│   │   └── FilterBar.tsx
│   ├── hooks/
│   │   └── useGifts.ts
│   ├── lib/
│   │   └── github.ts        # GitHub API integration
│   ├── types.ts             # TypeScript type definitions
│   ├── App.tsx              # Main app with password gate
│   ├── main.tsx             # Entry point
│   └── index.css            # Tailwind styles
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── README.md
```

## Development

### Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Environment Variables

For local development, create a `.env` file:

```env
VITE_GITHUB_OWNER=your-username
VITE_GITHUB_REPO=Wishlist
VITE_GITHUB_PAT=your-pat-token
```

## How It Works

### Product Enrichment

1. The `enrich-links.mjs` script fetches each product URL
2. It parses the HTML to find `<script type="application/ld+json">` tags
3. It extracts Product schema data (name, image, price, brand)
4. The data is saved back to `gifts.json` with a timestamp
5. Links are only re-fetched if older than 7 days

### Mark as Bought

1. User clicks "Mark as Bought" button
2. Frontend calls GitHub API to trigger `mark-bought.yml` workflow
3. Workflow uses `jq` to update the JSON file
4. Changes are committed and pushed automatically
5. User refreshes to see updated data

### Deployment

1. Push to `main` branch triggers `deploy.yml`
2. Workflow builds the Vite app with environment variables
3. Artifact is uploaded and deployed to GitHub Pages
4. Site is available at your GitHub Pages URL

## Security Notes

- Password is hashed using SHA-256 before comparison (basic security layer)
- The hash is still visible in client-side code (suitable for family use, not high-security applications)
- PAT is exposed in the built JavaScript (limit permissions to this repo only)
- For sensitive wishlists, consider server-side authentication

## License

MIT

## Contributing

Feel free to open issues or pull requests for improvements!
