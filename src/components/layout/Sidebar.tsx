import React, { useState, useRef, useEffect } from 'react';
import {
  Compass,
  Bookmark,
  LayoutGrid,
  Settings,
  Plus,
  Search,
  Heart,
  MoreVertical,
  MoreHorizontal,
  ChevronRight,
  Plane,
  Briefcase,
  Home,
  Trees,
  Gem,
  MapPin,
  Trash2,
  Navigation,
  Pencil,
  Share2,
  Utensils,
  Layers,
  Sparkles
} from 'lucide-react';
import { LocationItem, locationItemToPlace, LocationCategory } from '../../types/location';
import { placeImageService } from '../../services/placeImageService';
import { wikimediaImageService, CanonicalLocation } from '../../services/wikimediaImageService';
import { MaplyCubeIcon } from '../ui/MaplyCubeIcon';

interface SidebarProps {
  locations: LocationItem[];
  selectedLocationId: string | null;
  onSelectLocation: (id: string) => void;
  onAddNewPlaceClick: () => void;
  isAddingMode: boolean;
  activeNavTab: string;
  setActiveNavTab: (tab: string) => void;
  onDeleteLocation?: (id: string) => void;
  onEditLocation?: (location: LocationItem) => void;
  onDirectionsLocation?: (location: LocationItem) => void;
  onShareLocation?: (location: LocationItem) => void;
  onToggleFavorite?: (id: string) => void;
  onCycleMapStyle?: () => void;
  currentMapStyle?: string;
}

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'Travel':
      return <Plane className="w-2.5 h-2.5 text-blue-400" />;
    case 'Work':
      return <Briefcase className="w-2.5 h-2.5 text-amber-400" />;
    case 'Home':
      return <Home className="w-2.5 h-2.5 text-purple-400" />;
    case 'Nature':
      return <Trees className="w-2.5 h-2.5 text-emerald-400" />;
    case 'History':
      return <Gem className="w-2.5 h-2.5 text-indigo-400" />;
    case 'Food':
      return <Utensils className="w-2.5 h-2.5 text-rose-400" />;
    default:
      return <MapPin className="w-2.5 h-2.5 text-slate-400" />;
  }
};

function SidebarItemThumbnail({ place }: { place: LocationItem }) {
  const initialUrl =
    place.imageUrl && !place.imageUrl.startsWith('/assets/') ? place.imageUrl : null;
  const [photoUrl, setPhotoUrl] = useState<string | null>(initialUrl);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (place.imageUrl && !place.imageUrl.startsWith('/assets/')) {
      setPhotoUrl(place.imageUrl);
      setFailed(false);
      return;
    }

    const p = locationItemToPlace(place);
    const cached = placeImageService.getCachedImages(p);
    if (cached && cached.length > 0) {
      setPhotoUrl(cached[0].url);
      setFailed(false);
      return;
    }

    let mounted = true;
    const canonicalLoc: CanonicalLocation = {
      id: place.id,
      name: place.name,
      latitude: place.lat,
      longitude: place.lng,
      address: place.address,
      city: place.cityRegion?.split(',')[0]?.trim(),
      region: place.cityRegion?.split(',')[1]?.trim(),
      category: place.category,
    };

    wikimediaImageService
      .resolveImages(canonicalLoc)
      .then((res) => {
        if (mounted && res.images.length > 0) {
          const img = res.images[0];
          setPhotoUrl(img.url);
          setFailed(false);
        }
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [place.id, place.name, place.imageUrl, place.lat, place.lng, place.address, place.category]);

  if (photoUrl && !failed) {
    return (
      <img
        src={photoUrl}
        alt={place.name}
        onError={() => setFailed(true)}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-blue-500/10 text-blue-400">
      {getCategoryIcon(place.category)}
    </div>
  );
}

export const Sidebar: React.FC<SidebarProps> = ({
  locations,
  selectedLocationId,
  onSelectLocation,
  onAddNewPlaceClick,
  isAddingMode,
  activeNavTab,
  setActiveNavTab,
  onDeleteLocation,
  onEditLocation,
  onDirectionsLocation,
  onShareLocation,
  onToggleFavorite,
  onCycleMapStyle,
  currentMapStyle = 'satellite',
}) => {
  const [listSearch, setListSearch] = useState('');
  const [myPlacesFilter, setMyPlacesFilter] = useState<'all' | 'favorites'>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [openMenuLocationId, setOpenMenuLocationId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown menu if user clicks anywhere outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuLocationId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter places based on active search and sub-tab selection
  const filteredPlaces = locations.filter((loc) => {
    // 1. Search text filter
    if (listSearch.trim()) {
      const q = listSearch.toLowerCase();
      const match =
        loc.name.toLowerCase().includes(q) ||
        loc.cityRegion.toLowerCase().includes(q) ||
        loc.category.toLowerCase().includes(q);
      if (!match) return false;
    }

    // 2. Tab-specific filtering
    if (activeNavTab === 'myplaces' && myPlacesFilter === 'favorites') {
      if (!loc.isFavorite) return false;
    }

    if (activeNavTab === 'categories' && selectedCategoryFilter) {
      if (loc.category !== selectedCategoryFilter) return false;
    }

    return true;
  });

  const favoritesCount = locations.filter((l) => l.isFavorite).length;

  const categoriesList: LocationCategory[] = [
    'Travel',
    'Work',
    'Home',
    'Nature',
    'History',
    'Food',
    'Other',
  ];

  return (
    <aside className="w-[280px] min-w-[280px] max-w-[280px] h-full flex flex-col liquid-glass rounded-[28px] border border-white/14 p-[14px] shadow-[0_20px_50px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.15)] select-none z-20 shrink-0 box-border">
      {/* Header: 3D Cube Logo & Maply Branding */}
      <div className="flex items-center gap-2 mb-3.5 px-0.5">
        <div className="w-9 h-9 rounded-2xl bg-white/[0.06] border border-white/14 shadow-md shadow-blue-500/10 shrink-0 flex items-center justify-center p-1.5">
          <MaplyCubeIcon size={24} />
        </div>

        <div className="flex flex-col text-left">
          <h1 className="text-[22px] font-bold tracking-tight text-white leading-none">
            Maply
          </h1>
          <p className="text-[11.5px] text-slate-400 font-normal tracking-tight mt-1">
            Your world, saved beautifully
          </p>
        </div>
      </div>

      {/* Main Navigation pills */}
      <nav className="space-y-1.5 mb-3" aria-label="Main Navigation">
        <button
          onClick={() => {
            setActiveNavTab('explore');
            setSelectedCategoryFilter(null);
          }}
          className={`w-full h-[42px] flex items-center gap-2.5 px-3.5 rounded-[14px] text-[13.5px] font-semibold transition-all duration-200 cursor-pointer ${
            activeNavTab === 'explore'
              ? 'bg-blue-600/30 text-white border border-blue-400/40 shadow-[0_0_15px_rgba(59,130,246,0.22)]'
              : 'text-slate-300 hover:text-white hover:bg-white/5'
          }`}
        >
          <Compass className={`w-[18px] h-[18px] ${activeNavTab === 'explore' ? 'text-blue-300' : 'text-slate-400'}`} />
          <span>Explore</span>
        </button>

        <button
          onClick={() => {
            setActiveNavTab('myplaces');
            setSelectedCategoryFilter(null);
          }}
          className={`w-full h-[42px] flex items-center justify-between px-3.5 rounded-[14px] text-[13.5px] font-semibold transition-all duration-200 cursor-pointer ${
            activeNavTab === 'myplaces'
              ? 'bg-blue-600/30 text-white border border-blue-400/40 shadow-[0_0_15px_rgba(59,130,246,0.22)]'
              : 'text-slate-300 hover:text-white hover:bg-white/5'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Bookmark className={`w-[18px] h-[18px] ${activeNavTab === 'myplaces' ? 'text-blue-300' : 'text-slate-400'}`} />
            <span>My Places</span>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-slate-300 border border-white/10">
            {locations.length}
          </span>
        </button>

        <button
          onClick={() => setActiveNavTab('categories')}
          className={`w-full h-[42px] flex items-center gap-2.5 px-3.5 rounded-[14px] text-[13.5px] font-semibold transition-all duration-200 cursor-pointer ${
            activeNavTab === 'categories'
              ? 'bg-blue-600/30 text-white border border-blue-400/40 shadow-[0_0_15px_rgba(59,130,246,0.22)]'
              : 'text-slate-300 hover:text-white hover:bg-white/5'
          }`}
        >
          <LayoutGrid className={`w-[18px] h-[18px] ${activeNavTab === 'categories' ? 'text-blue-300' : 'text-slate-400'}`} />
          <span>Categories</span>
        </button>

        <button
          onClick={() => setActiveNavTab('settings')}
          className={`w-full h-[42px] flex items-center gap-2.5 px-3.5 rounded-[14px] text-[13.5px] font-semibold transition-all duration-200 cursor-pointer ${
            activeNavTab === 'settings'
              ? 'bg-blue-600/30 text-white border border-blue-400/40 shadow-[0_0_15px_rgba(59,130,246,0.22)]'
              : 'text-slate-300 hover:text-white hover:bg-white/5'
          }`}
        >
          <Settings className={`w-[18px] h-[18px] ${activeNavTab === 'settings' ? 'text-blue-300' : 'text-slate-400'}`} />
          <span>Settings</span>
        </button>
      </nav>

      {/* Action Card: Add New Place */}
      <button
        onClick={onAddNewPlaceClick}
        className={`w-full h-[70px] text-left px-3 py-2.5 rounded-[18px] border transition-all duration-200 group cursor-pointer mb-3 ${
          isAddingMode
            ? 'bg-blue-600/25 border-blue-400/50 shadow-md shadow-blue-500/20 ring-1 ring-blue-400'
            : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 hover:border-white/20'
        }`}
      >
        <div className="flex items-center justify-between h-full">
          <div className="flex items-center gap-3">
            <div className="w-[40px] h-[40px] rounded-[14px] bg-blue-600 text-white flex items-center justify-center shadow-[0_0_14px_rgba(59,130,246,0.4)] group-hover:scale-105 transition-transform shrink-0">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[13.5px] font-semibold text-white group-hover:text-blue-200 leading-tight">
                Add New Place
              </p>
              <p className="text-[10.5px] text-slate-400 leading-tight mt-0.5">
                Click on the map or use search
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
        </div>
      </button>

      {/* Sub-view: Settings */}
      {activeNavTab === 'settings' && (
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5 text-left text-xs animate-in fade-in duration-150">
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-2">
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">
              Map Style View
            </span>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                <span className="text-white capitalize font-medium">{currentMapStyle} Aerial</span>
              </div>
              {onCycleMapStyle && (
                <button
                  type="button"
                  onClick={onCycleMapStyle}
                  className="px-2 py-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-[10.5px] font-medium border border-blue-400/30 cursor-pointer"
                >
                  Change
                </button>
              )}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-1.5">
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">
              Saved Statistics
            </span>
            <div className="flex justify-between text-slate-300 text-[11px]">
              <span>Total Places:</span>
              <span className="font-bold text-white">{locations.length}</span>
            </div>
            <div className="flex justify-between text-slate-300 text-[11px]">
              <span>Favorite Places:</span>
              <span className="font-bold text-rose-400">{favoritesCount}</span>
            </div>
          </div>
        </div>
      )}

      {/* Sub-view: Categories Filter Bar */}
      {activeNavTab === 'categories' && (
        <div className="mb-2 flex flex-wrap gap-1">
          <button
            onClick={() => setSelectedCategoryFilter(null)}
            className={`px-2 py-0.5 rounded-lg text-[10px] font-medium transition-colors cursor-pointer ${
              selectedCategoryFilter === null
                ? 'bg-blue-600 text-white'
                : 'bg-white/5 text-slate-400 hover:text-white'
            }`}
          >
            All
          </button>
          {categoriesList.map((cat) => {
            const count = locations.filter((l) => l.category === cat).length;
            if (count === 0 && selectedCategoryFilter !== cat) return null;
            return (
              <button
                key={cat}
                onClick={() =>
                  setSelectedCategoryFilter(selectedCategoryFilter === cat ? null : cat)
                }
                className={`px-2 py-0.5 rounded-lg text-[10px] font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                  selectedCategoryFilter === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                {getCategoryIcon(cat)}
                <span>{cat}</span>
                <span className="opacity-70 text-[9px]">({count})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Sub-view: My Places Filter Pills */}
      {activeNavTab === 'myplaces' && (
        <div className="grid grid-cols-2 gap-1 mb-2 bg-[#050b14]/60 p-0.5 rounded-lg border border-white/8">
          <button
            onClick={() => setMyPlacesFilter('all')}
            className={`py-1 text-[10.5px] font-semibold rounded-md transition-all cursor-pointer ${
              myPlacesFilter === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All ({locations.length})
          </button>
          <button
            onClick={() => setMyPlacesFilter('favorites')}
            className={`py-1 text-[10.5px] font-semibold rounded-md flex items-center justify-center gap-1 transition-all cursor-pointer ${
              myPlacesFilter === 'favorites'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Heart className="w-3 h-3 fill-current" />
            <span>Favorites ({favoritesCount})</span>
          </button>
        </div>
      )}

      {/* List Search Header */}
      {activeNavTab !== 'settings' && (
        <>
          <div className="flex items-center justify-between px-0.5 mb-1.5">
            <span className="text-[11px] font-semibold text-white tracking-tight">
              {activeNavTab === 'myplaces'
                ? myPlacesFilter === 'favorites'
                  ? 'Favorite Places'
                  : 'All Saved Places'
                : activeNavTab === 'categories'
                ? selectedCategoryFilter
                  ? `${selectedCategoryFilter} Places`
                  : 'All Categories'
                : 'Saved Places'}
            </span>
            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-white/10 text-slate-300">
              {filteredPlaces.length}
            </span>
          </div>

          {/* Inner search filter for places */}
          <div className="relative mb-2">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              placeholder="Search your places..."
              className="w-full h-9 pl-8 pr-3 bg-white/[0.04] hover:bg-white/[0.07] focus:bg-white/[0.07] rounded-xl border border-white/10 focus:border-blue-400/50 outline-none text-[11px] text-white placeholder-slate-400 transition-all"
            />
          </div>

          {/* Scrollable Saved Places List with Clean Floating Actions */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5 scrollbar-thin relative">
            {filteredPlaces.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-[11px] space-y-2.5">
                <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-slate-400">
                  <MapPin className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <p className="font-medium text-slate-200 text-[11.5px]">No saved places yet</p>
                  <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                    Click anywhere on the map or click <span className="text-blue-400 font-semibold">"Add New Place"</span> to start pinning your locations.
                  </p>
                </div>
              </div>
            ) : (
              filteredPlaces.map((place) => {
                const isSelected = place.id === selectedLocationId;
                const isMenuOpen = openMenuLocationId === place.id;

                return (
                  <div
                    key={place.id}
                    onClick={() => onSelectLocation(place.id)}
                    className={`relative flex items-center justify-between min-h-[68px] p-2 rounded-2xl border transition-all duration-200 group cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600/25 border-blue-400/60 shadow-[0_0_18px_rgba(59,130,246,0.22)] ring-1 ring-blue-400/40'
                        : 'bg-white/[0.03] hover:bg-white/[0.07] border-white/8 hover:border-white/16'
                    }`}
                  >
                    {/* Left Thumbnail & Info */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="relative w-[52px] h-[52px] rounded-xl overflow-hidden shrink-0 border border-white/15 bg-[#0a1422] shadow-inner">
                        <SidebarItemThumbnail place={place} />
                      </div>
                      <div className="min-w-0 flex flex-col text-left">
                        <p
                          className={`text-[13px] font-semibold truncate leading-tight ${
                            isSelected ? 'text-white' : 'text-slate-200 group-hover:text-white'
                          }`}
                        >
                          {place.name}
                        </p>
                        <p className="text-[10.5px] text-slate-400 truncate leading-tight mt-0.5">
                          {place.cityRegion || `${place.lat.toFixed(3)}, ${place.lng.toFixed(3)}`}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-md bg-white/10 text-slate-300 font-medium border border-white/8">
                            {getCategoryIcon(place.category)}
                            {place.category}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right Interactive Actions - Clean single-slot matching reference */}
                    <div
                      className="flex items-center gap-1 shrink-0 ml-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* If favorite, show heart; if not favorite or on hover, allow options */}
                      {place.isFavorite ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorite?.(place.id);
                          }}
                          title="Remove from favorites"
                          className="p-1 rounded-md text-rose-500 fill-rose-500 hover:scale-110 transition-transform cursor-pointer"
                        >
                          <Heart className="w-4 h-4 fill-rose-500 text-rose-500 drop-shadow-sm" />
                        </button>
                      ) : null}

                      {/* Three Dots Menu Button (Always available or reveals on hover if favorite) */}
                      <div className={`relative ${place.isFavorite ? 'opacity-0 group-hover:opacity-100 transition-opacity' : ''}`}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuLocationId(isMenuOpen ? null : place.id);
                          }}
                          title="More options"
                          className="p-1 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>

                        {/* Floating Action Menu for this location */}
                        {isMenuOpen && (
                          <div
                            ref={menuRef}
                            className="absolute right-0 top-6 w-36 bg-[#091322]/95 backdrop-blur-xl border border-white/15 rounded-xl shadow-2xl p-1 z-50 text-left space-y-0.5 animate-in fade-in duration-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuLocationId(null);
                                onDirectionsLocation?.(place);
                              }}
                              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 text-[10.5px] text-slate-200 hover:text-white transition-colors cursor-pointer"
                            >
                              <Navigation className="w-3 h-3 text-blue-400" />
                              <span>Directions</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuLocationId(null);
                                onEditLocation?.(place);
                              }}
                              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 text-[10.5px] text-slate-200 hover:text-white transition-colors cursor-pointer"
                            >
                              <Pencil className="w-3 h-3 text-amber-400" />
                              <span>Edit Place</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuLocationId(null);
                                onShareLocation?.(place);
                              }}
                              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 text-[10.5px] text-slate-200 hover:text-white transition-colors cursor-pointer"
                            >
                              <Share2 className="w-3 h-3 text-cyan-400" />
                              <span>Share Link</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuLocationId(null);
                                onToggleFavorite?.(place.id);
                              }}
                              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 text-[10.5px] text-slate-200 hover:text-white transition-colors cursor-pointer"
                            >
                              <Heart
                                className={`w-3 h-3 ${
                                  place.isFavorite ? 'text-rose-500 fill-rose-500' : 'text-slate-400'
                                }`}
                              />
                              <span>{place.isFavorite ? 'Unfavorite' : 'Favorite'}</span>
                            </button>

                            <div className="my-0.5 border-t border-white/10" />

                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuLocationId(null);
                                onDeleteLocation?.(place.id);
                              }}
                              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-red-500/20 text-[10.5px] text-red-400 hover:text-red-300 transition-colors cursor-pointer font-medium"
                            >
                              <Trash2 className="w-3 h-3 text-red-400" />
                              <span>Delete Place</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Profile Card at bottom */}
      <div className="mt-auto pt-2.5 border-t border-white/10">
        <div className="flex items-center justify-between p-2 rounded-2xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/8 transition-colors cursor-pointer">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-700 to-slate-600 border border-white/20 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-md">
              AR
            </div>
            <div className="min-w-0 text-left">
              <p className="text-xs font-semibold text-white truncate leading-tight">Arjun R</p>
              <p className="text-[10px] text-slate-400 truncate leading-tight mt-0.5">arjun@example.com</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </div>
      </div>
    </aside>
  );
};
