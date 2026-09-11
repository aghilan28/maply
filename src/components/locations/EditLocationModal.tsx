import React, { useState, useEffect } from 'react';
import { X, Pencil, MapPin } from 'lucide-react';
import { LocationCategory, LocationItem } from '../../types/location';
import { CATEGORIES } from '../ui/CategoryPills';

interface EditLocationModalProps {
  isOpen?: boolean;
  location: LocationItem | null;
  onClose: () => void;
  onSave: (id: string, updatedData: Partial<LocationItem>) => void;
}

export const EditLocationModal: React.FC<EditLocationModalProps> = ({
  isOpen = true,
  location,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [cityRegion, setCityRegion] = useState('');
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState<LocationCategory>('Travel');
  const [tagsInput, setTagsInput] = useState('');
  const [notes, setNotes] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !location) return;
    setName(location.name);
    setCityRegion(location.cityRegion);
    setAddress(location.address);
    setCategory(location.category);
    setTagsInput(location.tags.join(' '));
    setNotes(location.notes || '');
    setImageUrl(location.imageUrl);
    setError('');
  }, [isOpen, location]);

  if (isOpen === false || !location) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError('Location name is required');
      return;
    }

    const tags = tagsInput
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      .map((t) => (t.startsWith('#') ? t : `#${t}`));

    onSave(location.id, {
      name: cleanName,
      cityRegion: cityRegion.trim() || location.cityRegion,
      address: address.trim() || location.address,
      category,
      tags,
      notes: notes.trim(),
      imageUrl: imageUrl.trim() || location.imageUrl,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md liquid-glass rounded-3xl border border-white/20 p-6 shadow-2xl relative text-xs">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
              <Pencil className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Edit Location</h3>
              <p className="text-[11px] text-slate-400">Update details for {location.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div>
            <label className="block font-semibold text-slate-300 mb-1">
              Location Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/15 focus:border-blue-400 outline-none text-white text-sm"
              required
            />
            {error && <p className="text-rose-400 text-[11px] mt-1">{error}</p>}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">City / Region</label>
              <input
                type="text"
                value={cityRegion}
                onChange={(e) => setCityRegion(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-white/5 border border-white/15 focus:border-blue-400 outline-none text-white text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as LocationCategory)}
                className="w-full px-3 py-1.5 rounded-xl bg-[#141e28] border border-white/15 focus:border-blue-400 outline-none text-white text-xs cursor-pointer"
              >
                {CATEGORIES.filter((c) => c.id !== null).map((c) => (
                  <option key={c.label} value={c.id!}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Full Address / Landmark</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl bg-white/5 border border-white/15 focus:border-blue-400 outline-none text-white text-xs"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Tags</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl bg-white/5 border border-white/15 focus:border-blue-400 outline-none text-white text-xs"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl bg-white/5 border border-white/15 focus:border-blue-400 outline-none text-white text-xs resize-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Image URL</label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl bg-white/5 border border-white/15 focus:border-blue-400 outline-none text-white text-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-md shadow-blue-600/30 cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
