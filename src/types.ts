export type Category = 'tech' | 'home' | 'games' | 'clothing' | 'books' | 'other';
export type Priority = 'high' | 'medium' | 'low';

export interface SchemaOffer {
  price: string;
  priceCurrency: string;
}

export interface SchemaBrand {
  name: string;
}

export interface ProductSchema {
  '@type': 'Product';
  name: string;
  image?: string;
  brand?: SchemaBrand;
  offers?: SchemaOffer;
}

export interface GiftLink {
  url: string;
  store: string;
  schema?: ProductSchema;
  schemaFetchedAt?: string;
}

export interface Gift {
  id: string;
  title: string;
  description: string;
  category: Category;
  priority: Priority;
  priceRange: string;
  purchased: boolean;
  links: GiftLink[];
}

export interface GiftsData {
  gifts: Gift[];
}

export type SortBy = 'priority' | 'category' | 'title';

export interface FilterState {
  category: Category | 'all';
  sortBy: SortBy;
  hidePurchased: boolean;
}
