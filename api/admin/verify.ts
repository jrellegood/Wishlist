import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAdminCode } from '../_adminAuth';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!verifyAdminCode(req)) {
    return res.status(401).json({ error: 'Invalid admin code' });
  }
  return res.status(200).json({ ok: true });
}
