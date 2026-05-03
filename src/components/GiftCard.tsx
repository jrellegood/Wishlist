import { useState } from 'react';
import type { Gift } from '../types';

interface GiftCardProps {
  gift: Gift;
  onMarkPurchased: (giftId: string) => void;
}

export function GiftCard({ gift, onMarkPurchased }: GiftCardProps) {
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [purchaseCode, setPurchaseCode] = useState('');
  const [isMarking, setIsMarking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMarkClick = () => {
    setShowCodeInput(true);
    setError(null);
  };

  const handleSubmitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsMarking(true);
    setError(null);

    try {
      const response = await fetch('/api/mark-purchased', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ giftId: gift.id, purchaseCode }),
      });

      if (response.ok) {
        onMarkPurchased(gift.id);
      } else {
        const data = await response.json();
        setError(response.status === 401 ? 'Incorrect code. Try again.' : (data.error ?? 'Something went wrong.'));
        setPurchaseCode('');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsMarking(false);
    }
  };

  const handleCancelCode = () => {
    setShowCodeInput(false);
    setPurchaseCode('');
    setError(null);
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
    fitness: 'bg-teal-100 text-teal-800',
    other: 'bg-gray-100 text-gray-800',
  };

  const linkWithOg = gift.links.find(link => link.ogImage || link.ogTitle);
  const displayTitle = linkWithOg?.ogTitle ?? gift.title;
  const displayImage = linkWithOg?.ogImage;
  const displayBrand = linkWithOg?.ogBrand;
  const displayPrice = linkWithOg?.ogPrice;

  return (
    <div className={`card border-l-4 ${priorityColors[gift.priority]} ${gift.purchased ? 'card-purchased' : ''}`}>
      {displayImage && (
        <div className="w-full h-48 bg-gray-200 overflow-hidden">
          <img
            src={displayImage}
            alt={displayTitle}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="p-4">
        <h3 className={`text-xl font-semibold mb-2 ${gift.purchased ? 'line-through text-gray-500' : 'text-gray-800'}`}>
          {displayTitle}
        </h3>

        {displayBrand && (
          <p className="text-sm text-gray-600 mb-2">Brand: {displayBrand}</p>
        )}

        <div className="flex gap-2 mb-3 flex-wrap">
          <span className={`px-2 py-1 text-xs font-medium rounded ${priorityBadgeColors[gift.priority]}`}>
            {priorityLabels[gift.priority]}
          </span>
          <span className={`px-2 py-1 text-xs font-medium rounded ${categoryColors[gift.category] ?? 'bg-gray-100 text-gray-800'}`}>
            {gift.category}
          </span>
          {gift.purchased && (
            <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-800">
              Purchased ✓
            </span>
          )}
        </div>

        <p className="text-gray-700 mb-3 text-sm">{gift.description}</p>

        <div className="mb-4">
          {displayPrice ? (
            <p className="text-lg font-semibold text-gray-900">${displayPrice}</p>
          ) : (
            <p className="text-sm text-gray-600">Approx: {gift.priceRange}</p>
          )}
        </div>

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

        {!gift.purchased && (
          <div>
            {!showCodeInput ? (
              <button onClick={handleMarkClick} className="btn btn-primary w-full">
                Mark as Purchased
              </button>
            ) : (
              <form onSubmit={handleSubmitCode} className="space-y-2">
                <input
                  type="password"
                  value={purchaseCode}
                  onChange={e => setPurchaseCode(e.target.value)}
                  placeholder="Enter purchase code"
                  className="input w-full"
                  autoFocus
                  disabled={isMarking}
                />
                {error && <p className="text-red-600 text-sm">{error}</p>}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={isMarking || !purchaseCode}
                    className="btn btn-primary flex-1"
                  >
                    {isMarking ? 'Confirming...' : 'Confirm'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelCode}
                    disabled={isMarking}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
