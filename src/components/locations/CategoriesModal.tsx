import React, { useState } from 'react';
import {
  X,
  LayoutGrid,
  Plane,
  Briefcase,
  Home as HomeIcon,
  Trees,
  Gem,
  Utensils,
  Cloud,
  ChevronRight,
  MapPin,
  ArrowLeft,
  Navigation,
} from 'lucide-react';
import { LocationItem } from '../../types/location';

interface CategoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  locations: LocationItem[];
  onSelectLocation: (id: string) => void;
}

interface CategoryCardDefinition {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  glassBg: string;
  borderColor: string;
  textColor: string;
  glowColor: string;
}

const CATEGORY_DEFINITIONS: CategoryCardDefinition[] = [
  {
    id: 'Travel',
    name: 'Travel & Exploration',
    description: 'Landmarks, airports, cities, vacation spots & scenic routes',
    icon: Plane,
    glassBg: 'from-blue-600/25 via-blue-900/15 to-slate-900/80',
    borderColor: 'border-blue-400/40 hover:border-blue-400/80',
    textColor: 'text-blue-400',
    glowColor: 'shadow-blue-500/20',
  },
  {
    id: 'Work',
    name: 'Work & Offices',
    description: 'Corporate headquarters, tech parks, client offices & workspaces',
    icon: Briefcase,
    glassBg: 'from-amber-600/25 via-amber-900/15 to-slate-900/80',
    borderColor: 'border-amber-400/40 hover:border-amber-400/80',
    textColor: 'text-amber-400',
    glowColor: 'shadow-amber-500/20',
  },
  {
    id: 'Home',
    name: 'Home & Living',
    description: 'Residences, apartments, family homes & personal sanctuaries',
    icon: HomeIcon,
    glassBg: 'from-purple-600/25 via-purple-900/15 to-slate-900/80',
    borderColor: 'border-purple-400/40 hover:border-purple-400/80',
    textColor: 'text-purple-400',
    glowColor: 'shadow-purple-500/20',
  },
  {
    id: 'Food',
    name: 'Food & Dining',
    description: 'Restaurants, cafes, bakeries, bars & culinary destinations',
    icon: Utensils,
    glassBg: 'from-rose-600/25 via-rose-900/15 to-slate-900/80',
    borderColor: 'border-rose-400/40 hover:border-rose-400/80',
    textColor: 'text-rose-400',
    glowColor: 'shadow-rose-500/20',
  },
  {
    id: 'Nature',
    name: 'Nature & Parks',
    description: 'Beaches, lakes, mountains, national parks & botanical gardens',
    icon: Trees,
    glassBg: 'from-emerald-600/25 via-emerald-900/15 to-slate-900/80',
    borderColor: 'border-emerald-400/40 hover:border-emerald-400/80',
    textColor: 'text-emerald-400',
    glowColor: 'shadow-emerald-500/20',
  },
  {
    id: 'History',
    name: 'History & Heritage',
    description: 'Ancient temples, palaces, monuments, forts & cultural sites',
    icon: Gem,
    glassBg: 'from-indigo-600/25 via-indigo-900/15 to-slate-900/80',
    borderColor: 'border-indigo-400/40 hover:border-indigo-400/80',
    textColor: 'text-indigo-400',
    glowColor: 'shadow-indigo-500/20',
  },
  {
    id: 'Other',
    name: 'Custom & Other',
    description: 'Uncategorized pins, meeting points & miscellaneous places',
    icon: Cloud,
    glassBg: 'from-cyan-600/25 via-cyan-900/15 to-slate-900/80',
    borderColor: 'border-cyan-400/40 hover:border-cyan-400/80',
    textColor: 'text-cyan-400',
    glowColor: 'shadow-cyan-500/20',
  },
];

export const CategoriesModal: React.FC<CategoriesModalProps> = ({
  isOpen,
  onClose,
  locations,
  onSelectLocation,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  if (!isOpen) return null;

  const categoryPlaces = selectedCategory
    ? locations.filter((loc) => (loc.category || 'Other').toLowerCase() === selectedCategory.toLowerCase())
    : [];

  const activeCategoryDef = CATEGORY_DEFINITIONS.find(
    (c) => c.id.toLowerCase() === (selectedCategory || '').toLowerCase()
  );

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
            {selectedCategory ? (
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className="w-10 h-10 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/12 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer mr-1"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : null}

            <div className="w-11 h-11 rounded-2xl bg-indigo-600/20 border border-indigo-400/40 flex items-center justify-center text-indigo-400 shadow-lg shadow-indigo-500/15">
              <LayoutGrid className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white tracking-tight">
                  {selectedCategory ? `${activeCategoryDef?.name || selectedCategory} Places` : 'Categories Directory'}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-600/30 text-indigo-300 border border-indigo-400/40">
                  {selectedCategory ? `${categoryPlaces.length} Places` : '7 Categories'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {selectedCategory
                  ? `Viewing all saved places categorized under ${selectedCategory}`
                  : 'Filter and explore your saved places organized by category'}
              </p>
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

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto pt-4 pr-1 scrollbar-thin space-y-4 min-h-0">
          {!selectedCategory ? (
            /* ALL CATEGORIES GRID VIEW */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {CATEGORY_DEFINITIONS.map((cat) => {
                const count = locations.filter(
                  (l) => (l.category || 'Other').toLowerCase() === cat.id.toLowerCase()
                ).length;
                const Icon = cat.icon;

                return (
                  <div
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`group relative flex flex-col justify-between p-5 rounded-2xl border bg-gradient-to-br ${cat.glassBg} ${cat.borderColor} ${cat.glowColor} shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer overflow-hidden backdrop-blur-md`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className={`w-12 h-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center ${cat.textColor} group-hover:scale-110 transition-transform shadow-md`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-white/10 text-white border border-white/15 backdrop-blur-md">
                          {count} {count === 1 ? 'Place' : 'Places'}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-white group-hover:text-slate-100 transition-colors">
                        {cat.name}
                      </h3>
                      <p className="text-xs text-slate-300 leading-relaxed mt-1.5 line-clamp-2">
                        {cat.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/10 text-xs font-semibold text-white group-hover:text-indigo-300">
                      <span>View Locations</span>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* SELECTED CATEGORY PLACES LIST VIEW */
            <div>
              {categoryPlaces.length === 0 ? (
                <div className="p-12 text-center text-slate-400 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-slate-400">
                    <MapPin className="w-5 h-5 text-indigo-400" />
                  </div>
                  <p className="text-sm font-semibold text-slate-200">No places saved under {selectedCategory}</p>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Click "Add New Place" on the map and choose "{selectedCategory}" as the category to populate this folder.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {categoryPlaces.map((place) => {
                    const Icon = activeCategoryDef?.icon || MapPin;

                    return (
                      <div
                        key={place.id}
                        onClick={() => {
                          onSelectLocation(place.id);
                          onClose();
                        }}
                        className="group relative flex flex-col p-3 rounded-2xl border border-white/12 bg-slate-900/60 hover:bg-slate-900/90 hover:border-white/25 shadow-lg transition-all duration-200 cursor-pointer overflow-hidden"
                      >
                        {/* Place Thumbnail */}
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
                              <Icon className={`w-8 h-8 ${activeCategoryDef?.textColor || 'text-indigo-400'}`} />
                              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                                {place.category}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Content Details */}
                        <div className="flex-1 flex flex-col justify-between">
                          <div>
                            <h3 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-1">
                              {place.name}
                            </h3>
                            <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                              {place.cityRegion || `${place.lat.toFixed(3)}, ${place.lng.toFixed(3)}`}
                            </p>
                          </div>

                          <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/8 text-xs font-semibold text-indigo-400">
                            <span className="flex items-center gap-1">
                              <Navigation className="w-3.5 h-3.5" />
                              <span>View on Map</span>
                            </span>
                            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
