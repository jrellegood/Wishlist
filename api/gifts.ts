import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { data: gifts, error } = await supabase
    .from('gifts')
    .select('*, gift_links(*)')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch gifts:', error);
    return res.status(500).json({ error: 'Failed to fetch gifts' });
  }

  const shaped = (gifts ?? []).map(gift => ({
    id: gift.id,
    title: gift.title,
    description: gift.description,
    category: gift.category,
    priority: gift.priority,
    priceRange: gift.price_range,
    purchased: gift.purchased,
    purchasedAt: gift.purchased_at,
    links: (gift.gift_links ?? []).map((link: Record<string, unknown>) => ({
      id: link.id,
      url: link.url,
      store: link.store,
      ogTitle: link.og_title,
      ogImage: link.og_image,
      ogPrice: link.og_price,
      ogBrand: link.og_brand,
      enrichedAt: link.enriched_at,
    })),
  }));

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ gifts: shaped });
}
