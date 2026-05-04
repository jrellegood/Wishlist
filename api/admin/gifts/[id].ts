import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAdminCode } from '../../../lib/adminAuth';
import { supabase, shapeGift, type DbGift } from '../../../lib/db';
import { enrichLink } from '../../../lib/enrichUtils';

async function handlePut(req: VercelRequest, res: VercelResponse, id: string) {
  const { title, description, category, priority, priceRange, purchased, links = [] } = req.body ?? {};

  if (!title?.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }

  // Update gift fields
  const { error: giftError } = await supabase
    .from('gifts')
    .update({
      title: title.trim(),
      description: description?.trim() || null,
      category: category ?? 'other',
      priority: priority ?? 'medium',
      price_range: priceRange?.trim() || null,
      ...(typeof purchased === 'boolean' && {
        purchased,
        purchased_at: purchased ? new Date().toISOString() : null,
      }),
    })
    .eq('id', id);

  if (giftError) {
    console.error('Failed to update gift:', giftError);
    return res.status(500).json({ error: 'Failed to update gift' });
  }

  // Diff links: keep existing (have id), delete removed, insert new
  const { data: existingLinks } = await supabase
    .from('gift_links')
    .select('id')
    .eq('gift_id', id);

  const existingIds = (existingLinks ?? []).map(l => l.id as number);
  const keptIds = links.filter((l: { id?: number }) => l.id != null).map((l: { id: number }) => l.id);
  const toDelete = existingIds.filter(eid => !keptIds.includes(eid));
  const toAdd = links.filter((l: { id?: number }) => l.id == null);

  if (toDelete.length > 0) {
    await supabase.from('gift_links').delete().in('id', toDelete);
  }

  for (const link of toAdd) {
    if (!link.url?.trim()) continue;
    const ogData = await enrichLink(link.url.trim(), 5000);
    await supabase.from('gift_links').insert({
      gift_id: id,
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
    .eq('id', id)
    .single();

  return res.status(200).json({ gift: shapeGift(gift as DbGift) });
}

async function handleDelete(_req: VercelRequest, res: VercelResponse, id: string) {
  // gift_links cascade-delete via FK constraint
  const { error } = await supabase.from('gifts').delete().eq('id', id);
  if (error) {
    console.error('Failed to delete gift:', error);
    return res.status(500).json({ error: 'Failed to delete gift' });
  }
  return res.status(200).json({ ok: true });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!verifyAdminCode(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const id = req.query.id as string;
  if (!id) return res.status(400).json({ error: 'Missing gift id' });

  // Confirm the gift exists before any mutation
  const { data: existing } = await supabase
    .from('gifts')
    .select('id')
    .eq('id', id)
    .single();

  if (!existing) return res.status(404).json({ error: 'Gift not found' });

  if (req.method === 'PUT') return handlePut(req, res, id);
  if (req.method === 'DELETE') return handleDelete(req, res, id);
  return res.status(405).json({ error: 'Method not allowed' });
}
