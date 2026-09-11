import React, { useState } from 'react';
import {
  X,
  Search,
  Bookmark,
  Heart,
  MapPin,
  Navigation,
  Trash2,
  Pencil,
  ExternalLink,
  Plane,
  Briefcase,
  Home as HomeIcon,
  Trees,
  Gem,
  Utensils,
  Cloud,
} from 'lucide-react';
import { LocationItem } from '../../types/location';

interface MyPlacesModalProps {
  isOpen: boolean;
  onClose: () => void;
  locations: LocationItem[];
  selectedLocationId: string | null;
  onSelectLocation: (id: string) => void;
  onDeleteLocation?: (id: string) => void;
  onEditLocation?: (location: LocationItem) => void;
  onDirectionsLocation?: (location: LocationItem) => void;
  onToggleFavorite?: (id: string) => void;
}

const getCategoryBadge = (category: string) => {
  switch (category) {
    case 'Travel':
      return { icon: Plane, bg: 'bg-blue-500/15 border-blue-400/30 text-blue-300' };
    case 'Work':
      return { icon: Briefcase, bg: 'bg-amber-500/15 border-amber-400/30 text-amber-300' };
    case 'Home':
      return { icon: HomeIcon, bg: 'bg-purple-500/15 border-purple-400/30 text-purple-300' };
    case 'Nature':
      return { icon: Trees, bg: 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300' };
    case 'History':
      return { icon: Gem, bg: 'bg-indigo-500/15 border-indigo-400/30 text-indigo-300' };
    case 'Food':
      return { icon: Utensils, bg: 'bg-rose-500/15 border-rose-400/30 text-rose-300' };
    default:
      return { icon: Cloud, bg: 'bg-cyan-500/15 border-cyan-400/30 text-cyan-300' };
  }
};

export const MyPlacesModal: React.FC<MyPlacesModalProps> = ({
  isOpen,
  onClose,
  locations,
  selectedLocationId,
  onSelectLocation,
  onDeleteLocation,
  onEditLocation,
  onDirectionsLocation,
  onToggleFavorite,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'favorites'>('all');

  if (!isOpen) return null;

  const filteredLocations = locations.filter((loc) => {
    if (filterType === 'favorites' && !loc.isFavorite) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = loc.name.toLowerCase().includes(q);
      const matchCity = (loc.cityRegion || '').toLowerCase().includes(q);
      const matchCategory = (loc.category || '').toLowerCase().includes(q);
      return matchName || matchCity || matchCategory;
    }
    return true;
  });

  const favoritesCount = locations.filter((l) => l.isFavorite).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-4xl max-h-[88vh] flex flex-col liquid-glass border border-white/16 rounded-[28px] p-6 shadow-[0_25px_60px_rgba(0,0,0,0.65)] relative overflow-hidden select-none">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-600/20 border border-blue-400/40 flex items-center justify-center text-blue-400 shadow-lg shadow-blue-500/15">
              <Bookmark className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white tracking-tight">My Places Collection</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-600/30 text-blue-300 border border-blue-400/40">
                  {locations.length} Places
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Explore, search, and manage all your saved locations</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/12 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toolbar: Search & Favorite Filter Pills */}
        <div className="py-4 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          {/* Search Box */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search places by name, city, or category..."
              className="w-full h-10 pl-9 pr-4 rounded-xl bg-slate-900/80 border border-white/15 focus:border-blue-400 text-xs text-white placeholder-slate-400 outline-none transition-all shadow-inner"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                filterType === 'all'
                  ? 'bg-blue-600/40 text-white border-blue-400/60 shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                  : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
              }`}
            >
              All Places ({locations.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('favorites')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                filterType === 'favorites'
                  ? 'bg-rose-600/40 text-white border-rose-400/60 shadow-[0_0_15px_rgba(225,29,72,0.3)]'
                  : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${filterType === 'favorites' ? 'fill-current' : ''}`} />
              <span>Favorites ({favoritesCount})</span>
            </button>
          </div>
        </div>

        {/* Scrollable Places Grid */}
        <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin space-y-3 min-h-0">
          {filteredLocations.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-3">
              <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-slate-400">
                <MapPin className="w-5 h-5 text-blue-400" />
              </div>
              <p className="text-sm font-semibold text-slate-200">No matching locations found</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {searchQuery
                  ? `No saved places match "${searchQuery}". Try a different keyword or category.`
                  : 'You have no favorite locations saved yet.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredLocations.map((place) => {
                const isSelected = place.id === selectedLocationId;
                const badge = getCategoryBadge(place.category);
                const BadgeIcon = badge.icon;

                return (
                  <div
                    key={place.id}
                    onClick={() => {
                      onSelectLocation(place.id);
                      onClose();
                    }}
                    className={`group relative flex flex-col p-3 rounded-2xl border transition-all duration-200 cursor-pointer overflow-hidden ${
                      isSelected
                        ? 'bg-blue-600/20 border-blue-400/60 shadow-[0_0_20px_rgba(59,130,246,0.3)] ring-1 ring-blue-400/40'
                        : 'bg-slate-900/60 hover:bg-slate-900/90 border-white/12 hover:border-white/25 shadow-lg'
                    }`}
                  >
                    {/* Place Hero Image Preview */}
                    <div className="relative w-full h-32 rounded-xl overflow-hidden bg-slate-950 border border-white/10 mb-3 shrink-0">
                      {place.imageUrl && !place.imageUrl.startsWith('/assets/') ? (
                        <img
                          src={place.imageUrl}
                          alt={place.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-[#0c1829] via-[#07111e] to-[#040912] flex flex-col items-center justify-center space-y-1">
                          <BadgeIcon className="w-8 h-8 text-blue-400/80" />
                          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                            {place.category}
                          </span>
                        </div>
                      )}

                      {/* Favorite Button Overlay */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite?.(place.id);
                        }}
                        className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white hover:scale-110 transition-transform shadow-lg cursor-pointer"
                      >
                        <Heart
                          className={`w-3.5 h-3.5 ${
                            place.isFavorite ? 'text-rose-500 fill-rose-500' : 'text-slate-300'
                          }`}
                        />
                      </button>

                      {/* Category Badge Chip Overlay */}
                      <div className="absolute bottom-2.5 left-2.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold border backdrop-blur-md ${badge.bg}`}>
                          <BadgeIcon className="w-3 h-3" />
                          <span>{place.category}</span>
                        </span>
                      </div>
                    </div>

                    {/* Content Details */}
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-white group-hover:text-blue-300 transition-colors line-clamp-1">
                          {place.name}
                        </h3>
                        <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                          {place.cityRegion || `${place.lat.toFixed(3)}, ${place.lng.toFixed(3)}`}
                        </p>
                      </div>

                      {/* Actions Footer */}
                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/8 text-xs">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDirectionsLocation?.(place);
                            onClose();
                          }}
                          className="flex items-center gap-1 text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          <span>Directions</span>
                        </button>

                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {onEditLocation && (
                            <button
                              type="button"
                              onClick={() => {
                                onEditLocation(place);
                                onClose();
                              }}
                              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                              title="Edit place details"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {onDeleteLocation && (
                            <button
                              type="button"
                              onClick={() => onDeleteLocation(place.id)}
                              className="p-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Delete location"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
