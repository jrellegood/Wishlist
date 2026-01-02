import { useState } from 'react';
import type { Gift } from '../types';
import { markGiftAsBought } from '../lib/github';

interface GiftCardProps {
  gift: Gift;
  onGiftUpdated: () => void;
}

export function GiftCard({ gift, onGiftUpdated }: GiftCardProps) {
  const [isMarking, setIsMarking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMarkAsBought = async () => {
    if (!confirm('Mark this gift as purchased?')) {
      return;
    }

    try {
      setIsMarking(true);
      setError(null);
      await markGiftAsBought(gift.id);

      // Wait a bit for the workflow to complete and data to update
      setTimeout(() => {
        onGiftUpdated();
        setIsMarking(false);
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark as bought');
      setIsMarking(false);
    }
  };

  const priorityColors = {
    high: 'border-l-priority-high',
    medium: 'border-l-priority-medium',
    low: 'border-l-priority-low',
  };

  const priorityLabels = {
    high: 'High Priority',
    medium: 'Medium Priority',
    low: 'Low Priority',
  };

  const priorityBadgeColors = {
    high: 'bg-red-100 text-red-800',
    medium: 'bg-amber-100 text-amber-800',
    low: 'bg-gray-100 text-gray-800',
  };

  const categoryColors: Record<string, string> = {
    tech: 'bg-blue-100 text-blue-800',
    home: 'bg-green-100 text-green-800',
    games: 'bg-purple-100 text-purple-800',
    clothing: 'bg-pink-100 text-pink-800',
    books: 'bg-orange-100 text-orange-800',
    other: 'bg-gray-100 text-gray-800',
  };

  // Check if any link has schema data
  const linkWithSchema = gift.links.find(link => link.schema);
  const schema = linkWithSchema?.schema;

  return (
    <div className={`card border-l-4 ${priorityColors[gift.priority]} ${gift.purchased ? 'card-purchased' : ''}`}>
      {/* Product Image (if available from schema) */}
      {schema?.image && (
        <div className="w-full h-48 bg-gray-200 overflow-hidden">
          <img
            src={schema.image}
            alt={schema.name || gift.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="p-4">
        {/* Title - use schema name if available */}
        <h3 className={`text-xl font-semibold mb-2 ${gift.purchased ? 'line-through text-gray-500' : 'text-gray-800'}`}>
          {schema?.name || gift.title}
        </h3>

        {/* Brand (if available from schema) */}
        {schema?.brand?.name && (
          <p className="text-sm text-gray-600 mb-2">
            Brand: {schema.brand.name}
          </p>
        )}

        {/* Badges */}
        <div className="flex gap-2 mb-3">
          <span className={`px-2 py-1 text-xs font-medium rounded ${priorityBadgeColors[gift.priority]}`}>
            {priorityLabels[gift.priority]}
          </span>
          <span className={`px-2 py-1 text-xs font-medium rounded ${categoryColors[gift.category]}`}>
            {gift.category}
          </span>
          {gift.purchased && (
            <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-800">
              Purchased ✓
            </span>
          )}
        </div>

        {/* Description */}
        <p className="text-gray-700 mb-3 text-sm">
          {gift.description}
        </p>

        {/* Price */}
        <div className="mb-4">
          {schema?.offers?.price && schema?.offers?.priceCurrency ? (
            <p className="text-lg font-semibold text-gray-900">
              {schema.offers.priceCurrency} ${schema.offers.price}
            </p>
          ) : (
            <p className="text-sm text-gray-600">
              Approx: {gift.priceRange}
            </p>
          )}
        </div>

        {/* Links */}
        {gift.links.length > 0 && (
          <div className="mb-4">
            <div className="flex flex-wrap gap-2">
              {gift.links.map((link, index) => (
                <a
                  key={index}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary text-sm"
                >
                  View on {link.store} →
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Mark as Bought Button */}
        {!gift.purchased && (
          <div>
            <button
              onClick={handleMarkAsBought}
              disabled={isMarking}
              className="btn btn-primary w-full"
            >
              {isMarking ? 'Marking as bought...' : 'Mark as Bought'}
            </button>
            {error && (
              <p className="text-red-600 text-sm mt-2">{error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
