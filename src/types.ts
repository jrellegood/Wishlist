export type Category = 'tech' | 'home' | 'games' | 'clothing' | 'books' | 'fitness' | 'other';
export type Priority = 'high' | 'medium' | 'low';

export interface GiftLink {
  id: number;
  url: string;
  store: string;
  ogTitle?: string | null;
  ogImage?: string | null;
  ogPrice?: string | null;
  ogBrand?: string | null;
  enrichedAt?: string | null;
}

export interface Gift {
  id: string;
  title: string;
  description: string;
  category: Category;
  priority: Priority;
  priceRange: string;
  purchased: boolean;
  purchasedAt: string | null;
  links: GiftLink[];
}

export interface GiftLinkInput {
  id?: number;
  url: string;
  store: string;
}

export interface GiftInput {
  title: string;
  description: string;
  category: Category;
  priority: Priority;
  priceRange: string;
  purchased?: boolean;
  links: GiftLinkInput[];
}

export type SortBy = 'priority' | 'category' | 'title';

export interface FilterState {
  category: Category | 'all';
  sortBy: SortBy;
  hidePurchased: boolean;
}
