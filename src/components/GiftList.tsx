import { GiftCard } from './GiftCard';
import { FilterBar } from './FilterBar';
import { useGifts } from '../hooks/useGifts';

export function GiftList() {
  const { gifts, loading, error, filters, setFilters, refetchGifts } = useGifts();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading wishlist...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg max-w-md">
          <h2 className="font-semibold mb-2">Error loading wishlist</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">🎁 Wishlist</h1>
          <p className="text-gray-600">Browse and mark items as purchased</p>
        </div>

        {/* Filters */}
        <FilterBar filters={filters} onFiltersChange={setFilters} />

        {/* Gift Grid */}
        {gifts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No gifts match your filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {gifts.map((gift) => (
              <GiftCard key={gift.id} gift={gift} onGiftUpdated={refetchGifts} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
