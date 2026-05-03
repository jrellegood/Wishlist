import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function isAuthorized(req: VercelRequest): boolean {
  if (req.headers['x-vercel-cron'] === '1') return true;
  const auth = req.headers['authorization'] ?? '';
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

async function fetchOgData(url: string): Promise<{
  ogTitle: string | null;
  ogImage: string | null;
  ogPrice: string | null;
  ogBrand: string | null;
} | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
    });
    if (!response.ok) return null;

    const html = await response.text();
    const $ = cheerio.load(html);

    const ogTitle = $('meta[property="og:title"]').attr('content') ?? null;
    const ogImage = $('meta[property="og:image"]').attr('content') ?? null;
    const ogPrice =
      $('meta[property="product:price:amount"]').attr('content') ??
      $('meta[property="og:price:amount"]').attr('content') ??
      $('meta[property="og:price"]').attr('content') ??
      null;
    const ogBrand =
      $('meta[property="og:brand"]').attr('content') ??
      $('meta[property="og:site_name"]').attr('content') ??
      null;

    return { ogTitle, ogImage, ogPrice, ogBrand };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
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
    const data = await fetchOgData(link.url);

    const update = data
      ? { og_title: data.ogTitle, og_image: data.ogImage, og_price: data.ogPrice, og_brand: data.ogBrand, enriched_at: new Date().toISOString() }
      : { enriched_at: new Date().toISOString() };

    const { error: updateError } = await supabase
      .from('gift_links')
      .update(update)
      .eq('id', link.id);

    if (updateError) {
      failed++;
    } else if (data?.ogTitle || data?.ogImage) {
      enriched++;
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return res.status(200).json({ enriched, failed });
}
