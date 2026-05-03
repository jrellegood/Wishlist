import { useState, FormEvent } from 'react';
import type { Gift, GiftInput, GiftLinkInput, Category, Priority } from '../types';

const CATEGORIES: Category[] = ['tech', 'home', 'games', 'clothing', 'books', 'fitness', 'other'];
const PRIORITIES: Priority[] = ['high', 'medium', 'low'];

interface AdminGiftFormProps {
  gift?: Gift;
  onSubmit: (data: GiftInput) => Promise<void>;
  onCancel: () => void;
}

function isValidUrl(value: string): boolean {
  try { new URL(value); return true; } catch { return false; }
}

export function AdminGiftForm({ gift, onSubmit, onCancel }: AdminGiftFormProps) {
  const [title, setTitle] = useState(gift?.title ?? '');
  const [description, setDescription] = useState(gift?.description ?? '');
  const [category, setCategory] = useState<Category>(gift?.category ?? 'other');
  const [priority, setPriority] = useState<Priority>(gift?.priority ?? 'medium');
  const [priceRange, setPriceRange] = useState(gift?.priceRange ?? '');
  const [purchased, setPurchased] = useState(gift?.purchased ?? false);
  const [links, setLinks] = useState<GiftLinkInput[]>(
    gift?.links.map(l => ({ id: l.id, url: l.url, store: l.store ?? '' })) ?? [{ url: '', store: '' }]
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const isEditing = gift != null;

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = 'Title is required.';
    links.forEach((link, i) => {
      if (link.url.trim() && !isValidUrl(link.url.trim())) {
        errs[`link_${i}`] = 'Enter a valid URL (include https://).';
      }
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  const addLink = () => setLinks(prev => [...prev, { url: '', store: '' }]);

  const removeLink = (i: number) => setLinks(prev => prev.filter((_, idx) => idx !== i));

  const updateLink = (i: number, field: keyof GiftLinkInput, value: string) =>
    setLinks(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setSubmitError('');

    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        priceRange: priceRange.trim(),
        ...(isEditing && { purchased }),
        links: links.filter(l => l.url.trim()).map(l => ({
          ...(l.id != null && { id: l.id }),
          url: l.url.trim(),
          store: l.store.trim(),
        })),
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong.');
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Title */}
      <div>
        <label htmlFor="gift-title" className="block text-sm font-medium text-gray-700 mb-1">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          id="gift-title"
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className={`input w-full ${errors.title ? 'border-red-400' : ''}`}
          placeholder="e.g. The Art of Game Design"
          disabled={isSubmitting}
          autoFocus
        />
        {errors.title && <p className="text-red-600 text-xs mt-1">{errors.title}</p>}
      </div>

      {/* Description */}
      <div>
        <label htmlFor="gift-description" className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          id="gift-description"
          value={description}
          onChange={e => setDescription(e.target.value)}
          className="input w-full resize-none"
          rows={2}
          placeholder="Why you want it, edition notes, etc."
          disabled={isSubmitting}
        />
      </div>

      {/* Category + Priority row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="gift-category" className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <select
            id="gift-category"
            value={category}
            onChange={e => setCategory(e.target.value as Category)}
            className="input w-full"
            disabled={isSubmitting}
          >
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="gift-priority" className="block text-sm font-medium text-gray-700 mb-1">
            Priority
          </label>
          <select
            id="gift-priority"
            value={priority}
            onChange={e => setPriority(e.target.value as Priority)}
            className="input w-full"
            disabled={isSubmitting}
          >
            {PRIORITIES.map(p => (
              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Price Range */}
      <div>
        <label htmlFor="gift-price" className="block text-sm font-medium text-gray-700 mb-1">
          Price Range
        </label>
        <input
          id="gift-price"
          type="text"
          value={priceRange}
          onChange={e => setPriceRange(e.target.value)}
          className="input w-full"
          placeholder="e.g. $20–40"
          disabled={isSubmitting}
        />
      </div>

      {/* Purchased toggle — only shown when editing */}
      {isEditing && (
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={purchased}
            onChange={e => setPurchased(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600"
            disabled={isSubmitting}
          />
          <span className="text-sm font-medium text-gray-700">Mark as purchased</span>
        </label>
      )}

      {/* Links */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Store Links</p>
        <div className="space-y-2">
          {links.map((link, i) => (
            <div key={i} className="flex gap-2 items-start">
              <div className="flex-1 space-y-1">
                <input
                  type="url"
                  value={link.url}
                  onChange={e => updateLink(i, 'url', e.target.value)}
                  placeholder="https://..."
                  className={`input w-full text-sm ${errors[`link_${i}`] ? 'border-red-400' : ''}`}
                  disabled={isSubmitting}
                />
                {errors[`link_${i}`] && (
                  <p className="text-red-600 text-xs">{errors[`link_${i}`]}</p>
                )}
              </div>
              <input
                type="text"
                value={link.store}
                onChange={e => updateLink(i, 'store', e.target.value)}
                placeholder="Store name"
                className="input w-28 text-sm"
                disabled={isSubmitting}
              />
              {links.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeLink(i)}
                  className="mt-1 text-gray-400 hover:text-red-500 transition-colors"
                  aria-label="Remove link"
                  disabled={isSubmitting}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addLink}
          className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
          disabled={isSubmitting}
        >
          + Add link
        </button>
      </div>

      {submitError && (
        <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded px-3 py-2">
          {submitError}
        </p>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-secondary"
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="btn btn-primary min-w-[100px]"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Gift'}
        </button>
      </div>
    </form>
  );
}
