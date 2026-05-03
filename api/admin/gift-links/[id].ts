import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAdminCode } from '../../_adminAuth';
import { supabase } from '../../_db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!verifyAdminCode(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const id = Number(req.query.id);
  if (!id || isNaN(id)) {
    return res.status(400).json({ error: 'Missing or invalid link id' });
  }

  const { error } = await supabase.from('gift_links').delete().eq('id', id);
  if (error) {
    console.error('Failed to delete link:', error);
    return res.status(500).json({ error: 'Failed to delete link' });
  }

  return res.status(200).json({ ok: true });
}
