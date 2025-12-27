import { useState, useEffect, useMemo } from 'react';
import type { Gift, GiftsData, FilterState } from '../types';

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
        const response = await fetch('/Wishlist/data/gifts.json');
        if (!response.ok) {
          throw new Error('Failed to fetch gifts');
        }
        const data: GiftsData = await response.json();
        setGifts(data.gifts);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchGifts();
  }, []);

  const filteredAndSortedGifts = useMemo(() => {
    let result = [...gifts];

    // Filter by category
    if (filters.category !== 'all') {
      result = result.filter(gift => gift.category === filters.category);
    }

    // Filter out purchased if needed
    if (filters.hidePurchased) {
      result = result.filter(gift => !gift.purchased);
    }

    // Sort
    result.sort((a, b) => {
      // Always put purchased items at the end
      if (a.purchased !== b.purchased) {
        return a.purchased ? 1 : -1;
      }

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

  const refetchGifts = async () => {
    try {
      setLoading(true);
      setError(null);
      // Add cache-busting query parameter
      const response = await fetch(`/Wishlist/data/gifts.json?t=${Date.now()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch gifts');
      }
      const data: GiftsData = await response.json();
      setGifts(data.gifts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return {
    gifts: filteredAndSortedGifts,
    loading,
    error,
    filters,
    setFilters,
    refetchGifts,
  };
}
