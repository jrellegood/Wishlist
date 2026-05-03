import { useState } from 'react';
import type { Gift, GiftInput } from '../types';
import { GiftCard } from './GiftCard';
import { FilterBar } from './FilterBar';
import { AdminModal } from './AdminModal';
import { AdminGiftForm } from './AdminGiftForm';
import { AdminUnlock } from './AdminUnlock';
import { useGifts } from '../hooks/useGifts';
import { useAdmin } from '../hooks/useAdmin';

export function GiftList() {
  const { gifts, loading, error, filters, setFilters, markPurchased, createGift, updateGift, deleteGift } = useGifts();
  const { isAdmin, adminCode, unlockAdmin, lockAdmin } = useAdmin();

  const [showUnlock, setShowUnlock] = useState(false);
  const [editingGift, setEditingGift] = useState<Gift | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const handleCreate = async (input: GiftInput) => {
    await createGift(input, adminCode!);
    setShowAddModal(false);
  };

  const handleUpdate = async (input: GiftInput) => {
    await updateGift(editingGift!.id, input, adminCode!);
    setEditingGift(null);
  };

  const handleDelete = async (giftId: string) => {
    await deleteGift(giftId, adminCode!);
  };

  const handleLockToggle = () => {
    if (isAdmin) {
      lockAdmin();
      setShowUnlock(false);
    } else {
      setShowUnlock(prev => !prev);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4" />
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
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">🎁 Wishlist</h1>
              <p className="text-gray-600">Browse and mark items as purchased</p>
            </div>

            <div className="flex items-center gap-3 mt-1 shrink-0">
              {isAdmin && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="btn btn-primary text-sm"
                >
                  + Add Gift
                </button>
              )}
              <button
                onClick={handleLockToggle}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded"
                title={isAdmin ? 'Exit admin mode' : 'Admin login'}
                aria-label={isAdmin ? 'Exit admin mode' : 'Admin login'}
              >
                {isAdmin ? (
                  <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 018 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {showUnlock && !isAdmin && (
            <AdminUnlock
              unlockAdmin={async (code) => {
                const ok = await unlockAdmin(code);
                if (ok) setShowUnlock(false);
                return ok;
              }}
              onCancel={() => setShowUnlock(false)}
            />
          )}
        </div>

        <FilterBar filters={filters} onFiltersChange={setFilters} />

        {gifts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No gifts match your filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {gifts.map((gift) => (
              <GiftCard
                key={gift.id}
                gift={gift}
                onMarkPurchased={markPurchased}
                isAdmin={isAdmin}
                onEdit={() => setEditingGift(gift)}
                onDelete={() => handleDelete(gift.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add modal */}
      {showAddModal && (
        <AdminModal title="Add Gift" onClose={() => setShowAddModal(false)}>
          <AdminGiftForm
            onSubmit={handleCreate}
            onCancel={() => setShowAddModal(false)}
          />
        </AdminModal>
      )}

      {/* Edit modal */}
      {editingGift && (
        <AdminModal title="Edit Gift" onClose={() => setEditingGift(null)}>
          <AdminGiftForm
            gift={editingGift}
            onSubmit={handleUpdate}
            onCancel={() => setEditingGift(null)}
          />
        </AdminModal>
      )}
    </div>
  );
}
