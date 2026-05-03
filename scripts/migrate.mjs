// One-time migration: gifts.json -> Supabase
// Run with: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate.mjs
// Delete this file after running.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const { gifts } = JSON.parse(readFileSync(join(__dirname, '../public/data/gifts.json'), 'utf8'));

console.log(`Migrating ${gifts.length} gifts...`);

for (const gift of gifts) {
  const { error: giftError } = await supabase.from('gifts').insert({
    id: gift.id,
    title: gift.title,
    description: gift.description ?? null,
    category: gift.category,
    priority: gift.priority,
    price_range: gift.priceRange ?? null,
    purchased: gift.purchased ?? false,
    purchased_at: gift.purchased ? new Date().toISOString() : null,
  });

  if (giftError) {
    console.error(`Failed to insert gift ${gift.id}:`, giftError.message);
    continue;
  }

  for (const link of gift.links ?? []) {
    const { error: linkError } = await supabase.from('gift_links').insert({
      gift_id: gift.id,
      url: link.url,
      store: link.store ?? null,
      og_title: link.schema?.name ?? null,
      og_image: link.schema?.image ?? null,
      og_price: link.schema?.offers?.price ?? null,
      og_brand: link.schema?.brand?.name ?? null,
      enriched_at: link.schemaFetchedAt ?? null,
    });

    if (linkError) {
      console.error(`Failed to insert link for ${gift.id}:`, linkError.message);
    }
  }

  console.log(`  ✓ ${gift.id}: ${gift.title}`);
}

console.log('\nMigration complete.');
