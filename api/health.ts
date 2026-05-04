import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasPurchaseCode: !!process.env.PURCHASE_CODE,
    hasCronSecret: !!process.env.CRON_SECRET,
    nodeVersion: process.version,
  });
}
