import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type DbLink = {
  id: number;
  url: string;
  store: string | null;
  og_title: string | null;
  og_image: string | null;
  og_price: string | null;
  og_brand: string | null;
  enriched_at: string | null;
};

export type DbGift = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  price_range: string | null;
  purchased: boolean;
  purchased_at: string | null;
  gift_links: DbLink[];
};

export function shapeGift(gift: DbGift) {
  return {
    id: gift.id,
    title: gift.title,
    description: gift.description,
    category: gift.category,
    priority: gift.priority,
    priceRange: gift.price_range,
    purchased: gift.purchased,
    purchasedAt: gift.purchased_at,
    links: (gift.gift_links ?? []).map(link => ({
      id: link.id,
      url: link.url,
      store: link.store,
      ogTitle: link.og_title,
      ogImage: link.og_image,
      ogPrice: link.og_price,
      ogBrand: link.og_brand,
      enrichedAt: link.enriched_at,
    })),
  };
}
