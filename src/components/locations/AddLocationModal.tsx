import React, { useState, useEffect } from 'react';
import { X, MapPin, Sparkles, Image as ImageIcon, Heart } from 'lucide-react';
import { LocationCategory, LocationItem } from '../../types/location';
import { DiscoveredPlace } from '../../types/place';
import { CATEGORIES } from '../ui/CategoryPills';
import { placeService } from '../../services/placeService';

interface AddLocationModalProps {
  isOpen: boolean;
  coords: { lat: number; lng: number } | null;
  initialPlace?: DiscoveredPlace | null;
  onClose: () => void;
  onSave: (locationData: Omit<LocationItem, 'id' | 'createdAt'>) => void;
}

export const AddLocationModal: React.FC<AddLocationModalProps> = ({
  isOpen,
  coords,
  initialPlace,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [cityRegion, setCityRegion] = useState('');
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState<LocationCategory>('Other');
  const [tagsInput, setTagsInput] = useState('');
  const [notes, setNotes] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [isLoadingReverseGeo, setIsLoadingReverseGeo] = useState(false);
  const [error, setError] = useState('');

  // When coordinates or initialPlace change, populate real discovered data or attempt reverse geocode
  useEffect(() => {
    if (!isOpen || !coords) return;
    setError('');
    setIsFavorite(false);

    if (initialPlace) {
      const pName =
        initialPlace.name && !initialPlace.name.includes('° N') && !initialPlace.name.includes('° S')
          ? initialPlace.name
          : '';
      setName(pName);
      const city = initialPlace.city || '';
      const country = initialPlace.country || '';
      const region = city ? (country ? `${city}, ${country}` : city) : country;
      setCityRegion(region);
      setAddress(
        initialPlace.address ||
          initialPlace.formattedAddress ||
          (region && pName ? `${pName}, ${region}` : pName)
      );
      if (initialPlace.category) {
        // Match category
        const catLower = initialPlace.category.toLowerCase();
        const matched = CATEGORIES.find(
          (c) => c.id && (c.id.toLowerCase() === catLower || catLower.includes(c.id.toLowerCase()))
        );
        if (matched?.id) {
          setCategory(matched.id as LocationCategory);
        } else {
          setCategory('Other');
        }
      } else {
        setCategory('Other');
      }

      if (initialPlace.photos && initialPlace.photos.length > 0) {
        setImageUrl(initialPlace.photos[0].url);
      } else {
        setImageUrl('');
      }

      // If we already have a rich name and address, we are set!
      if (pName && (initialPlace.address || initialPlace.formattedAddress)) {
        setIsLoadingReverseGeo(false);
        return;
      }
    } else {
      setName('');
      setCityRegion('');
      setAddress('');
      setImageUrl('');
      setCategory('Other');
      setTagsInput('');
      setNotes('');
    }

    // Reverse geocode via PlaceService
    setIsLoadingReverseGeo(true);
    placeService
      .reverseGeocode(coords.lat, coords.lng)
      .then((place) => {
        if (place) {
          setName((prev) => prev || place.name);
          const city = place.address?.city || place.address?.district || place.address?.state || '';
          const country = place.address?.country || '';
          const region = city ? (country ? `${city}, ${country}` : city) : country;
          setCityRegion((prev) => prev || region);
          setAddress(
            (prev) =>
              prev || place.formattedAddress || (region ? `${place.name}, ${region}` : place.name)
          );
          if (place.category) {
            setCategory((prev) => prev !== 'Other' ? prev : (place.category as LocationCategory));
          }
          if (place.photos && place.photos.length > 0) {
            setImageUrl((prev) => prev || place.photos![0].url);
          }
        }
      })
      .catch((err) => {
        console.warn('Reverse geocode error in modal:', err);
      })
      .finally(() => {
        setIsLoadingReverseGeo(false);
      });
  }, [isOpen, coords, initialPlace]);

  if (!isOpen || !coords) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError('Please enter a location name');
      return;
    }

    const tags = tagsInput
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      .map((t) => (t.startsWith('#') ? t : `#${t}`));

    onSave({
      name: cleanName,
      address: address.trim() || (cityRegion ? `${cleanName}, ${cityRegion}` : cleanName),
      cityRegion: cityRegion.trim() || 'Custom Place',
      lat: coords.lat,
      lng: coords.lng,
      category,
      imageUrl: imageUrl.trim(),
      tags,
      notes: notes.trim(),
      isFavorite,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg liquid-glass rounded-3xl border border-white/20 p-6 shadow-2xl relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Add New Place</h3>
              <p className="text-xs text-slate-400">Save this point to your personal Maply collection</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          {/* Geographic Coordinates Display */}
          <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-400" />
              <span className="text-slate-300 font-medium">Selected Coordinates</span>
            </div>
            <div className="flex items-center gap-3 font-mono text-slate-200">
              <span>Lat: {coords.lat.toFixed(5)}</span>
              <span>Lng: {coords.lng.toFixed(5)}</span>
            </div>
          </div>

          {/* Location Name */}
          <div>
            <label className="block font-semibold text-slate-300 mb-1">
              Location Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError('');
              }}
              placeholder={isLoadingReverseGeo ? 'Finding address details...' : 'e.g., Central Park, Blue Bottle Coffee'}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/15 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none text-sm text-white placeholder-slate-500 transition-all"
              autoFocus
            />
            {error && <p className="text-rose-400 text-[11px] mt-1 font-medium">{error}</p>}
          </div>

          {/* City / Region & Category Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">City / Region</label>
              <input
                type="text"
                value={cityRegion}
                onChange={(e) => setCityRegion(e.target.value)}
                placeholder="e.g. San Francisco, CA"
                className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/15 focus:border-blue-400 outline-none text-white text-xs placeholder-slate-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as LocationCategory)}
                className="w-full px-3 py-2 rounded-xl bg-[#141e28] border border-white/15 focus:border-blue-400 outline-none text-white text-xs cursor-pointer"
              >
                {CATEGORIES.filter((c) => c.id !== null).map((c) => (
                  <option key={c.label} value={c.id!}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block font-semibold text-slate-300 mb-1">Tags (optional, separated by space or comma)</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. #cafe #view #quiet"
              className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/15 focus:border-blue-400 outline-none text-white text-xs placeholder-slate-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block font-semibold text-slate-300 mb-1">Personal Notes (Optional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add personal notes or why you love this place..."
              className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/15 focus:border-blue-400 outline-none text-white text-xs resize-none placeholder-slate-500"
            />
          </div>

          {/* Image URL (Optional) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-300 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                Image URL (Optional)
              </label>
              <span className="text-[10px] text-slate-400">Add a custom photo link</span>
            </div>
            <div className="flex gap-2">
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                className="flex-1 px-3 py-1.5 rounded-xl bg-white/5 border border-white/15 focus:border-blue-400 outline-none text-white text-xs placeholder-slate-500"
              />
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="w-9 h-9 rounded-lg object-cover border border-white/20"
                  onError={() => setImageUrl('')}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-500">
                  <ImageIcon className="w-4 h-4" />
                </div>
              )}
            </div>
          </div>

          {/* Favorite Toggle */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/10">
            <div className="flex items-center gap-2">
              <Heart className={`w-4 h-4 ${isFavorite ? 'text-rose-400 fill-rose-400' : 'text-slate-400'}`} />
              <span className="text-slate-200 font-medium">Mark as Favorite</span>
            </div>
            <button
              type="button"
              onClick={() => setIsFavorite(!isFavorite)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer border ${
                isFavorite
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
              }`}
            >
              {isFavorite ? 'Favorited' : 'No'}
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
            >
              Save Place
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
