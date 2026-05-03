import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function safeCompare(a: string, b: string): boolean {
  try {
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    if (aBuf.length !== bBuf.length) return false;
    return timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { giftId, purchaseCode } = req.body ?? {};

  if (!giftId || !purchaseCode) {
    return res.status(400).json({ error: 'giftId and purchaseCode are required' });
  }

  if (!safeCompare(String(purchaseCode), process.env.PURCHASE_CODE ?? '')) {
    return res.status(401).json({ error: 'Invalid purchase code' });
  }

  const { data: gift, error: fetchError } = await supabase
    .from('gifts')
    .select('id, purchased')
    .eq('id', giftId)
    .single();

  if (fetchError || !gift) {
    return res.status(404).json({ error: 'Gift not found' });
  }

  if (gift.purchased) {
    return res.status(409).json({ error: 'Gift is already marked as purchased' });
  }

  const { error: updateError } = await supabase
    .from('gifts')
    .update({ purchased: true, purchased_at: new Date().toISOString() })
    .eq('id', giftId);

  if (updateError) {
    console.error('Failed to update gift:', updateError);
    return res.status(500).json({ error: 'Failed to update gift' });
  }

  return res.status(200).json({ success: true });
}
