import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../lib/db.js';
import { enrichLink } from '../lib/enrichUtils.js';

function isAuthorized(req: VercelRequest): boolean {
  if (req.headers['x-vercel-cron'] === '1') return true;
  const auth = (req.headers['authorization'] ?? '') as string;
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: links, error } = await supabase
    .from('gift_links')
    .select('id, url')
    .or(`enriched_at.is.null,enriched_at.lt.${sevenDaysAgo}`);

  if (error) {
    console.error('Failed to query links:', error);
    return res.status(500).json({ error: 'Failed to query links' });
  }

  let enriched = 0;
  let failed = 0;

  for (const link of links ?? []) {
    const data = await enrichLink(link.url);

    // Only set fields that have real values — never overwrite existing good data with nulls
    const update: Record<string, unknown> = { enriched_at: new Date().toISOString() };
    if (data?.ogTitle) update.og_title = data.ogTitle;
    if (data?.ogImage) update.og_image = data.ogImage;
    if (data?.ogPrice) update.og_price = data.ogPrice;
    if (data?.ogBrand) update.og_brand = data.ogBrand;

    const { error: updateError } = await supabase
      .from('gift_links')
      .update(update)
      .eq('id', link.id);

    if (updateError) {
      failed++;
    } else if (data) {
      enriched++;
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return res.status(200).json({ enriched, failed });
}
