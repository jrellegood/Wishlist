import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'crypto';
import { verifyAdminCode } from '../../lib/adminAuth.js';
import { supabase, shapeGift, type DbGift } from '../../lib/db.js';
import { enrichLink } from '../../lib/enrichUtils.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!verifyAdminCode(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { title, description, category, priority, priceRange, links = [] } = req.body ?? {};

  if (!title?.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }

  const giftId = `gift-${randomUUID().split('-')[0]}`;

  const { error: giftError } = await supabase.from('gifts').insert({
    id: giftId,
    title: title.trim(),
    description: description?.trim() || null,
    category: category ?? 'other',
    priority: priority ?? 'medium',
    price_range: priceRange?.trim() || null,
  });

  if (giftError) {
    console.error('Failed to create gift:', giftError);
    return res.status(500).json({ error: 'Failed to create gift' });
  }

  // Enrich and insert links — short timeout so the response stays fast
  for (const link of links) {
    if (!link.url?.trim()) continue;
    const ogData = await enrichLink(link.url.trim(), 5000);
    await supabase.from('gift_links').insert({
      gift_id: giftId,
      url: link.url.trim(),
      store: link.store?.trim() || null,
      og_title: ogData?.ogTitle ?? null,
      og_image: ogData?.ogImage ?? null,
      og_price: ogData?.ogPrice ?? null,
      og_brand: ogData?.ogBrand ?? null,
      enriched_at: new Date().toISOString(),
    });
  }

  const { data: gift } = await supabase
    .from('gifts')
    .select('*, gift_links(*)')
    .eq('id', giftId)
    .single();

  return res.status(201).json({ gift: shapeGift(gift as DbGift) });
}
