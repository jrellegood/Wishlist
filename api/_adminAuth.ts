import { timingSafeEqual } from 'crypto';
import type { VercelRequest } from '@vercel/node';

export function verifyAdminCode(req: VercelRequest): boolean {
  const auth = (req.headers['authorization'] ?? '') as string;
  const code = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const expected = process.env.ADMIN_CODE ?? '';
  if (!code || !expected) return false;
  try {
    const aBuf = Buffer.from(code);
    const bBuf = Buffer.from(expected);
    if (aBuf.length !== bBuf.length) return false;
    return timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}
