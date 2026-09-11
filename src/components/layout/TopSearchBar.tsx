import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, MapPin, X, Bookmark, Loader2, Sparkles } from 'lucide-react';
import { LocationItem } from '../../types/location';
import { DiscoveredPlace, Place, discoveredPlaceToPlace } from '../../types/place';
import { mapboxPlaceService, MapboxSearchSuggestion } from '../../services/mapboxPlaceService';
import { normalizeMapboxFeature } from '../../services/normalizeMapboxFeature';

interface TopSearchBarProps {
  locations: LocationItem[];
  onSelectSavedLocation: (id: string) => void;
  onSelectDiscoveredPlace: (place: DiscoveredPlace) => void;
  onSelectPlace?: (place: Place) => void;
  getCurrentCenter?: () => { latitude: number; longitude: number } | undefined;
}

export const TopSearchBar: React.FC<TopSearchBarProps> = ({
  locations,
  onSelectSavedLocation,
  onSelectDiscoveredPlace,
  onSelectPlace,
  getCurrentCenter,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<MapboxSearchSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const searchSessionTokenRef = useRef<string>(mapboxPlaceService.generateSessionToken());

  // Keyboard shortcut ⌘K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter local saved locations first
  const matchingSaved = query.trim()
    ? locations.filter(
        (loc) =>
          loc.name.toLowerCase().includes(query.toLowerCase()) ||
          loc.cityRegion.toLowerCase().includes(query.toLowerCase()) ||
          loc.address.toLowerCase().includes(query.toLowerCase()) ||
          loc.tags.some((t) => t.toLowerCase().includes(query.toLowerCase())) ||
          loc.category.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  // Search Box suggestions with session token
  const performSearch = useCallback(
    async (q: string) => {
      const trimmed = q.trim();
      if (!trimmed || trimmed.length < 2) {
        setSuggestions([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        const center = getCurrentCenter ? getCurrentCenter() : undefined;
        const results = await mapboxPlaceService.searchSuggestions(
          trimmed,
          searchSessionTokenRef.current,
          {
            limit: 7,
            ...(center ? { proximity: center } : {}),
          }
        );
        setSuggestions(results);
      } catch (err) {
        console.warn('Location discovery error:', err);
      } finally {
        setIsSearching(false);
      }
    },
    [getCurrentCenter]
  );

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (query.trim().length >= 2) {
      setIsSearching(true);
      debounceTimerRef.current = setTimeout(() => {
        performSearch(query);
      }, 260);
    } else {
      setSuggestions([]);
      setIsSearching(false);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, performSearch]);

  const handleSelectSaved = (id: string) => {
    onSelectSavedLocation(id);
    setQuery('');
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  const handleSelectSuggestion = async (sug: MapboxSearchSuggestion) => {
    setQuery('');
    setIsOpen(false);
    setSelectedIndex(-1);

    const tokenUsed = searchSessionTokenRef.current;
    // Rotate session token for next search session
    searchSessionTokenRef.current = mapboxPlaceService.generateSessionToken();

    if (sug.mapbox_id) {
      const details = await mapboxPlaceService.getPlaceDetails(sug.mapbox_id, tokenUsed);
      if (details) {
        onSelectDiscoveredPlace(details);
        if (onSelectPlace) {
          onSelectPlace(discoveredPlaceToPlace(details));
        }
        return;
      }
    }

    // Fallback if details could not be retrieved
    const fallbackPlace: DiscoveredPlace = normalizeMapboxFeature({
      ...sug,
      coordinates: getCurrentCenter?.()
        ? [getCurrentCenter()!.longitude, getCurrentCenter()!.latitude]
        : undefined,
      latitude: getCurrentCenter?.()?.latitude || 0,
      longitude: getCurrentCenter?.()?.longitude || 0,
      address: sug.full_address,
    }, 'mapbox-search');
    onSelectDiscoveredPlace(fallbackPlace);
    if (onSelectPlace) {
      onSelectPlace(discoveredPlaceToPlace(fallbackPlace));
    }
  };

  const allItemsCount = matchingSaved.length + suggestions.length;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < allItemsCount ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : allItemsCount - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < matchingSaved.length) {
        handleSelectSaved(matchingSaved[selectedIndex].id);
      } else if (selectedIndex >= matchingSaved.length && selectedIndex < allItemsCount) {
        const sugIdx = selectedIndex - matchingSaved.length;
        handleSelectSuggestion(suggestions[sugIdx]);
      } else if (matchingSaved.length > 0) {
        handleSelectSaved(matchingSaved[0].id);
      } else if (suggestions.length > 0) {
        handleSelectSuggestion(suggestions[0]);
      }
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-[490px] select-none box-border shrink-0">
      <div className="relative flex items-center w-full h-[50px] rounded-full liquid-glass border border-white/16 px-4 shadow-[0_14px_36px_rgba(0,0,0,0.35)] transition-all duration-200 focus-within:border-blue-400/60 focus-within:ring-2 focus-within:ring-blue-500/20 box-border">
        <Search className="w-4 h-4 text-slate-300 mr-3 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setSelectedIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search locations, cities, or addresses..."
          className="w-full bg-transparent border-none outline-none text-[13px] text-slate-100 placeholder-slate-400 font-medium"
        />

        {isSearching && (
          <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin mr-1.5 shrink-0" />
        )}

        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setSuggestions([]);
              inputRef.current?.focus();
            }}
            className="p-1 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors cursor-pointer mr-1.5"
            aria-label="Clear search"
          >
            <X className="w-3 h-3" />
          </button>
        )}

        {/* ⌘K Badge */}
        <div className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-[10px] text-slate-400 font-mono">
          <span>⌘</span>
          <span>K</span>
        </div>
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && query.trim().length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl liquid-glass border border-white/15 p-2 shadow-2xl z-50 max-h-[380px] overflow-y-auto custom-scrollbar">
          {/* Saved Places Section */}
          {matchingSaved.length > 0 && (
            <div className="mb-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold text-blue-400 uppercase tracking-wider">
                <Bookmark className="w-3 h-3" />
                <span>Saved in Maply</span>
              </div>
              {matchingSaved.map((loc, idx) => {
                const isSelected = selectedIndex === idx;
                return (
                  <button
                    key={`saved-${loc.id}`}
                    onClick={() => handleSelectSaved(loc.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                      isSelected ? 'bg-blue-600/30 text-white' : 'hover:bg-white/10 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0 bg-slate-800 border border-white/10">
                        <img
                          src={loc.imageUrl}
                          alt={loc.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-medium truncate text-white">{loc.name}</div>
                        <div className="text-[10px] text-slate-400 truncate">{loc.cityRegion}</div>
                      </div>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-slate-300 shrink-0 ml-2 font-medium">
                      {loc.category}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Real Discovered Places Section */}
          {suggestions.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold text-cyan-400 uppercase tracking-wider">
                <Sparkles className="w-3 h-3" />
                <span>Mapbox Places & POIs</span>
              </div>
              {suggestions.map((sug, idx) => {
                const globalIdx = matchingSaved.length + idx;
                const isSelected = selectedIndex === globalIdx;
                return (
                  <button
                    key={`sug-${sug.mapbox_id || idx}`}
                    onClick={() => handleSelectSuggestion(sug)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                      isSelected ? 'bg-cyan-600/30 text-white' : 'hover:bg-white/10 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center shrink-0 text-cyan-300">
                        <MapPin className="w-3.5 h-3.5" />
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-medium truncate text-white">{sug.name}</div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {sug.full_address || sug.place_formatted}
                        </div>
                      </div>
                    </div>
                    {sug.maki && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-900/40 text-cyan-300 border border-cyan-600/30 shrink-0 ml-2 capitalize">
                        {sug.maki}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {matchingSaved.length === 0 && suggestions.length === 0 && !isSearching && (
            <div className="px-3 py-6 text-center text-xs text-slate-400">
              <MapPin className="w-5 h-5 mx-auto mb-1.5 text-slate-500 opacity-60" />
              No places found for &ldquo;{query}&rdquo;
              <p className="text-[10px] text-slate-500 mt-1">Try a landmark, address, beach, or city name</p>
            </div>
          )}

          {isSearching && suggestions.length === 0 && (
            <div className="px-3 py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
              <span>Searching real location data...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
