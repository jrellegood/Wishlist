import { useState } from 'react';
import type { Gift } from '../types';

interface GiftCardProps {
  gift: Gift;
  onMarkPurchased: (giftId: string) => void;
  isAdmin?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function GiftCard({ gift, onMarkPurchased, isAdmin, onEdit, onDelete }: GiftCardProps) {
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [purchaseCode, setPurchaseCode] = useState('');
  const [isMarking, setIsMarking] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleMarkClick = () => { setShowCodeInput(true); setPurchaseError(null); };

  const handleSubmitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsMarking(true);
    setPurchaseError(null);
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
        setPurchaseError(response.status === 401 ? 'Incorrect code. Try again.' : (data.error ?? 'Something went wrong.'));
        setPurchaseCode('');
      }
    } catch {
      setPurchaseError('Network error. Please try again.');
    } finally {
      setIsMarking(false);
    }
  };

  const handleCancelCode = () => { setShowCodeInput(false); setPurchaseCode(''); setPurchaseError(null); };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await onDelete?.();
    } finally {
      setIsDeleting(false);
      setConfirmingDelete(false);
    }
  };

  const priorityColors = { high: 'border-l-priority-high', medium: 'border-l-priority-medium', low: 'border-l-priority-low' };
  const priorityLabels = { high: 'High Priority', medium: 'Medium Priority', low: 'Low Priority' };
  const priorityBadgeColors = { high: 'bg-red-100 text-red-800', medium: 'bg-amber-100 text-amber-800', low: 'bg-gray-100 text-gray-800' };
  const categoryColors: Record<string, string> = {
    tech: 'bg-blue-100 text-blue-800', home: 'bg-green-100 text-green-800',
    games: 'bg-purple-100 text-purple-800', clothing: 'bg-pink-100 text-pink-800',
    books: 'bg-orange-100 text-orange-800', fitness: 'bg-teal-100 text-teal-800',
    other: 'bg-gray-100 text-gray-800',
  };

  const categoryIcons: Record<string, React.ReactNode> = {
    tech: (
      <svg className="w-16 h-16 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    home: (
      <svg className="w-16 h-16 text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    games: (
      <svg className="w-16 h-16 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
      </svg>
    ),
    clothing: (
      <svg className="w-16 h-16 text-pink-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7l-4 4 4 4V7zm10 0v8l4-4-4-4zM7 7h10M7 15h10M9 4l3 3 3-3" />
      </svg>
    ),
    books: (
      <svg className="w-16 h-16 text-orange-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    fitness: (
      <svg className="w-16 h-16 text-teal-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    other: (
      <svg className="w-16 h-16 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  };

  const categoryPlaceholderBg: Record<string, string> = {
    tech: 'bg-blue-50', home: 'bg-green-50', games: 'bg-purple-50',
    clothing: 'bg-pink-50', books: 'bg-orange-50', fitness: 'bg-teal-50', other: 'bg-gray-50',
  };

  const linkWithOg = gift.links.find(l => l.ogImage || l.ogTitle);
  const displayTitle = linkWithOg?.ogTitle ?? gift.title;
  const displayImage = linkWithOg?.ogImage;
  const displayBrand = linkWithOg?.ogBrand;
  const displayPrice = linkWithOg?.ogPrice;

  return (
    <div className={`card border-l-4 ${priorityColors[gift.priority]} ${gift.purchased ? 'card-purchased' : ''}`}>
      <div className="w-full h-48 overflow-hidden">
        {displayImage ? (
          <img src={displayImage} alt={displayTitle} className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full flex items-center justify-center ${categoryPlaceholderBg[gift.category] ?? 'bg-gray-50'}`}>
            {categoryIcons[gift.category] ?? categoryIcons.other}
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className={`text-xl font-semibold mb-2 ${gift.purchased ? 'line-through text-gray-500' : 'text-gray-800'}`}>
          {displayTitle}
        </h3>

        {displayBrand && <p className="text-sm text-gray-600 mb-2">Brand: {displayBrand}</p>}

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
          {displayPrice
            ? <p className="text-lg font-semibold text-gray-900">${displayPrice}</p>
            : <p className="text-sm text-gray-600">Approx: {gift.priceRange}</p>
          }
        </div>

        {gift.links.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {gift.links.map((link, i) => (
              <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary text-sm">
                View on {link.store} →
              </a>
            ))}
          </div>
        )}

        {/* Purchase flow */}
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
                {purchaseError && <p className="text-red-600 text-sm">{purchaseError}</p>}
                <div className="flex gap-2">
                  <button type="submit" disabled={isMarking || !purchaseCode} className="btn btn-primary flex-1">
                    {isMarking ? 'Confirming…' : 'Confirm'}
                  </button>
                  <button type="button" onClick={handleCancelCode} disabled={isMarking} className="btn btn-secondary">
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Admin controls */}
        {isAdmin && (
          <div className={`flex gap-2 ${!gift.purchased ? 'mt-2' : ''}`}>
            <button
              onClick={onEdit}
              className="btn btn-secondary text-sm flex-1"
            >
              Edit
            </button>

            {!confirmingDelete ? (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="btn text-sm flex-1 border border-red-200 text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            ) : (
              <div className="flex gap-1 flex-1">
                <button
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                  className="btn text-sm flex-1 bg-red-600 text-white hover:bg-red-700"
                >
                  {isDeleting ? '…' : 'Confirm'}
                </button>
                <button
                  onClick={() => setConfirmingDelete(false)}
                  disabled={isDeleting}
                  className="btn btn-secondary text-sm"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
