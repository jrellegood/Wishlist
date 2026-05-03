import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, shapeGift, type DbGift } from './_db';

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

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ gifts: (gifts as DbGift[]).map(shapeGift) });
}
