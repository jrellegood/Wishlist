import { useState, useEffect, useMemo } from 'react';
import type { Gift, GiftInput, FilterState } from '../types';

export function useGifts() {
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    category: 'all',
    sortBy: 'priority',
    hidePurchased: false,
  });

  useEffect(() => {
    const fetchGifts = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/gifts');
        if (!response.ok) throw new Error('Failed to fetch gifts');
        const data = await response.json();
        setGifts(data.gifts);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };
    fetchGifts();
  }, []);

  const markPurchased = (giftId: string) => {
    setGifts(prev =>
      prev.map(g =>
        g.id === giftId ? { ...g, purchased: true, purchasedAt: new Date().toISOString() } : g
      )
    );
  };

  const createGift = async (input: GiftInput, adminCode: string): Promise<void> => {
    const response = await fetch('/api/admin/gifts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminCode}`,
      },
      body: JSON.stringify(input),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? 'Failed to create gift');
    setGifts(prev => [...prev, data.gift]);
  };

  const updateGift = async (id: string, input: GiftInput, adminCode: string): Promise<void> => {
    const response = await fetch(`/api/admin/gifts/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminCode}`,
      },
      body: JSON.stringify(input),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? 'Failed to update gift');
    setGifts(prev => prev.map(g => (g.id === id ? data.gift : g)));
  };

  const deleteGift = async (id: string, adminCode: string): Promise<void> => {
    const response = await fetch(`/api/admin/gifts/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminCode}` },
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error ?? 'Failed to delete gift');
    }
    setGifts(prev => prev.filter(g => g.id !== id));
  };

  const filteredAndSortedGifts = useMemo(() => {
    let result = [...gifts];

    if (filters.category !== 'all') {
      result = result.filter(gift => gift.category === filters.category);
    }

    if (filters.hidePurchased) {
      result = result.filter(gift => !gift.purchased);
    }

    result.sort((a, b) => {
      if (a.purchased !== b.purchased) return a.purchased ? 1 : -1;

      switch (filters.sortBy) {
        case 'priority': {
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        case 'category':
          return a.category.localeCompare(b.category);
        case 'title':
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

    return result;
  }, [gifts, filters]);

  return {
    gifts: filteredAndSortedGifts,
    loading,
    error,
    filters,
    setFilters,
    markPurchased,
    createGift,
    updateGift,
    deleteGift,
  };
}
