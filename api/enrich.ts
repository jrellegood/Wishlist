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

interface OgData {
  ogTitle: string | null;
  ogImage: string | null;
  ogPrice: string | null;
  ogBrand: string | null;
}

// Strategy 1: OG meta tags + JSON-LD from the page itself
async function fetchWithScrape(url: string): Promise<OgData | null> {
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

    // OG meta tags
    let ogTitle = $('meta[property="og:title"]').attr('content') ?? null;
    let ogImage = $('meta[property="og:image"]').attr('content') ?? null;
    let ogPrice =
      $('meta[property="product:price:amount"]').attr('content') ??
      $('meta[property="og:price:amount"]').attr('content') ??
      $('meta[property="og:price"]').attr('content') ??
      null;
    let ogBrand =
      $('meta[property="og:brand"]').attr('content') ??
      $('meta[property="og:site_name"]').attr('content') ??
      null;

    // JSON-LD as fallback for any fields still missing
    if (!ogTitle || !ogImage) {
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const raw = JSON.parse($(el).html() ?? '');
          const items: Record<string, unknown>[] = Array.isArray(raw) ? raw : [raw];
          const product = items.find(d => d['@type'] === 'Product');
          if (!product) return;

          if (!ogTitle && product.name) ogTitle = String(product.name);
          if (!ogImage && product.image) {
            const img = Array.isArray(product.image) ? product.image[0] : product.image;
            ogImage = typeof img === 'string' ? img : ((img as Record<string, string>)?.url ?? null);
          }
          if (!ogPrice && product.offers) {
            const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
            if ((offer as Record<string, unknown>)?.price) ogPrice = String((offer as Record<string, unknown>).price);
          }
          if (!ogBrand && product.brand) ogBrand = String((product.brand as Record<string, string>).name ?? product.brand);
          if (!ogBrand && product.author) ogBrand = String((product.author as Record<string, string>).name ?? product.author);
        } catch {
          // malformed JSON-LD, skip
        }
      });
    }

    if (!ogTitle && !ogImage) return null;
    return { ogTitle, ogImage, ogPrice, ogBrand };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Strategy 2: Microlink — handles JS-rendered pages and Amazon, free up to ~50 req/day
async function fetchWithMicrolink(url: string): Promise<OgData | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const apiUrl = `https://api.microlink.io?url=${encodeURIComponent(url)}`;
    const response = await fetch(apiUrl, { signal: controller.signal });
    if (!response.ok) return null;

    const json = await response.json() as { status: string; data: Record<string, unknown> };
    if (json.status !== 'success') return null;

    const { data } = json;
    const ogTitle = (data.title as string) ?? null;
    const ogImage = ((data.image as Record<string, string>)?.url) ?? null;
    const ogPrice = ((data.price as Record<string, string>)?.amount) ?? null;
    const ogBrand = (data.publisher as string) ?? null;

    if (!ogTitle && !ogImage) return null;
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
    // Try direct scrape first; fall back to Microlink for JS-heavy/bot-blocked pages
    const data = (await fetchWithScrape(link.url)) ?? (await fetchWithMicrolink(link.url));

    // Only set fields that have real values — never overwrite existing good data with nulls
    const update: Record<string, unknown> = { enriched_at: new Date().toISOString() };
    if (data?.ogTitle) update.og_title = data.ogTitle;
    if (data?.ogImage) update.og_image = data.ogImage;
    if (data?.ogPrice) update.og_price = data.ogPrice;
    if (data?.ogBrand) update.og_brand = data.ogBrand;

    const { error: updateError } = await supabase
      .from('gift_links')
      .update(update)
      .eq('id', link.id);

    if (updateError) {
      failed++;
    } else if (data) {
      enriched++;
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return res.status(200).json({ enriched, failed });
}
