import * as cheerio from 'cheerio';

export interface OgData {
  ogTitle: string | null;
  ogImage: string | null;
  ogPrice: string | null;
  ogBrand: string | null;
}

async function fetchHtml(url: string, timeoutMs: number): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
    });
    return response.ok ? await response.text() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchWithScrape(url: string, timeoutMs = 10000): Promise<OgData | null> {
  const html = await fetchHtml(url, timeoutMs);
  if (!html) return null;

  const $ = cheerio.load(html);

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
          if ((offer as Record<string, unknown>)?.price) {
            ogPrice = String((offer as Record<string, unknown>).price);
          }
        }
        if (!ogBrand && product.brand) {
          ogBrand = String((product.brand as Record<string, string>).name ?? product.brand);
        }
        if (!ogBrand && product.author) {
          ogBrand = String((product.author as Record<string, string>).name ?? product.author);
        }
      } catch {
        // malformed JSON-LD, skip
      }
    });
  }

  if (!ogTitle && !ogImage) return null;
  return { ogTitle, ogImage, ogPrice, ogBrand };
}

export async function fetchWithMicrolink(url: string, timeoutMs = 10000): Promise<OgData | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
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

export async function enrichLink(url: string, timeoutMs = 10000): Promise<OgData | null> {
  return (await fetchWithScrape(url, timeoutMs)) ?? (await fetchWithMicrolink(url, timeoutMs));
}
