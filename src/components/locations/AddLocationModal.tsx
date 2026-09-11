import React, { useState, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import {
  X,
  MapPin,
  Sparkles,
  Image as ImageIcon,
  Heart,
  Tag,
  FileText,
  Plus,
  Maximize2,
  Camera,
  ArrowRight,
  Utensils,
  Plane,
  Briefcase,
  Home,
  Trees,
  Gem,
  Layers,
} from 'lucide-react';
import { LocationCategory, LocationItem } from '../../types/location';
import { DiscoveredPlace, NormalizedPlace, PlaceImage } from '../../types/place';
import { PlaceVisual } from '../../types/visual';
import { CATEGORIES } from '../ui/CategoryPills';
import { placeService } from '../../services/placeService';
import { placeVisualResolver } from '../../services/visuals/PlaceVisualResolver';
import { buildPlaceVisualContext } from '../../services/visuals/visualContextHelper';
import { PlaceHeroImage, PhotoState } from './PlaceHeroImage';

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
  const [category, setCategory] = useState<LocationCategory>('Travel');
  const [tags, setTags] = useState<string[]>(['temple', 'culture', 'chennai']);
  const [newTagInput, setNewTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [notes, setNotes] = useState('');
  const [showPhotoUrlInput, setShowPhotoUrlInput] = useState(false);
  const [customPhotoUrl, setCustomPhotoUrl] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [isLoadingReverseGeo, setIsLoadingReverseGeo] = useState(false);
  const [error, setError] = useState('');

  // 100% Identical Visual Resolution State matching LocationDetailsPanel (Right Sidebar)
  const [visual, setVisual] = useState<PlaceVisual | null>(null);
  const [photo, setPhoto] = useState<PlaceImage | null>(null);
  const [photos, setPhotos] = useState<PlaceImage[]>([]);
  const [photoState, setPhotoState] = useState<PhotoState>('idle');

  const miniMapContainerRef = useRef<HTMLDivElement | null>(null);
  const miniMapRef = useRef<mapboxgl.Map | null>(null);
  const activeLocationKeyRef = useRef<string>('');
  const requestIdRef = useRef<number>(0);

  // Run place visual resolution pipeline 100% identical to LocationDetailsPanel right sidebar
  useEffect(() => {
    if (!isOpen || !coords) {
      setVisual(null);
      setPhoto(null);
      setPhotos([]);
      setPhotoState('idle');
      setCustomPhotoUrl('');
      activeLocationKeyRef.current = '';
      return;
    }

    const activeKey = `${coords.lat.toFixed(5)}_${coords.lng.toFixed(5)}_${initialPlace?.id || initialPlace?.name || ''}`;
    if (activeLocationKeyRef.current === activeKey) {
      return;
    }
    activeLocationKeyRef.current = activeKey;

    setError('');
    setIsFavorite(false);
    setShowPhotoUrlInput(false);
    setCustomPhotoUrl('');

    // Initial Modal Reset & Reverse Geocoding
    if (initialPlace) {
      const pName =
        initialPlace.name && !initialPlace.name.includes('° N') && !initialPlace.name.includes('° S')
          ? initialPlace.name
          : '';
      setName(pName);
      const city = initialPlace.city || '';
      const country = initialPlace.country || '';
      const region = city ? (country ? `${city}, ${country}` : city) : country;
      setCityRegion(region || 'Chennai, India');
      setAddress(
        initialPlace.address ||
          initialPlace.formattedAddress ||
          (region && pName ? `${pName}, ${region}` : pName)
      );

      let initCategory: LocationCategory = 'Travel';
      if (initialPlace.category) {
        const catLower = initialPlace.category.toLowerCase();
        const matched = CATEGORIES.find(
          (c) => c.id && (c.id.toLowerCase() === catLower || catLower.includes(c.id.toLowerCase()))
        );
        if (matched?.id) {
          initCategory = matched.id as LocationCategory;
        }
      }
      setCategory(initCategory);

      if (pName) {
        const autoTags = pName
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 3)
          .slice(0, 3);
        setTags(autoTags.length > 0 ? autoTags : ['location', 'place', 'maply']);
      }
    } else {
      setName('');
      setCityRegion('Chennai, India');
      setAddress('');
      setCategory('Travel');
      setTags(['location', 'place', 'maply']);
      setNotes('');

      setIsLoadingReverseGeo(true);
      placeService
        .reverseGeocode(coords.lat, coords.lng)
        .then((place) => {
          if (place) {
            const resolvedName = place.name || '';
            setName((prev) => prev || resolvedName);
            const city = place.address?.city || place.address?.district || place.address?.state || '';
            const country = place.address?.country || '';
            const region = city ? (country ? `${city}, ${country}` : city) : country;
            setCityRegion((prev) => prev || region || 'Chennai, India');
            setAddress(
              (prev) =>
                prev || place.formattedAddress || (region && resolvedName ? `${resolvedName}, ${region}` : resolvedName)
            );
          }
        })
        .catch(() => {})
        .finally(() => {
          setIsLoadingReverseGeo(false);
        });
    }
  }, [isOpen, coords?.lat, coords?.lng, initialPlace]);

  // Dedicated Live Place Visual Resolution Effect (Runs whenever typed name, category, or coords change)
  useEffect(() => {
    if (!isOpen || !coords) return;

    const targetName = name.trim();
    if (!targetName) {
      setVisual(null);
      setPhoto(null);
      setPhotos([]);
      setPhotoState('idle');
      return;
    }

    const activeKey = `${coords.lat.toFixed(4)}_${coords.lng.toFixed(4)}_${targetName.toLowerCase()}_${category}`;
    if (activeLocationKeyRef.current === activeKey) {
      return;
    }
    activeLocationKeyRef.current = activeKey;

    const thisRequestId = ++requestIdRef.current;
    const controller = new AbortController();

    setPhotoState('loading');

    const timer = setTimeout(() => {
      const normPlace: NormalizedPlace = {
        id: initialPlace?.id || `temp-${coords.lat}-${coords.lng}`,
        providerId: initialPlace?.providerId,
        mapboxId: initialPlace?.mapboxId,
        name: targetName,
        latitude: coords.lat,
        longitude: coords.lng,
        address: address,
        city: cityRegion.split(',')[0]?.trim(),
        category: category,
        photos: initialPlace?.photos,
        source: initialPlace?.source || 'user',
      };

      const visualContext = buildPlaceVisualContext(normPlace);

      // 1. Fast Cache Check
      const cached = placeVisualResolver.getCachedVisual(visualContext);
      if (cached) {
        if (requestIdRef.current !== thisRequestId) return;
        setVisual(cached);
        const p: PlaceImage = {
          url: cached.url,
          thumbnailUrl: cached.thumbnailUrl || cached.url,
          attribution: cached.attribution,
          alt: cached.title || targetName,
          source: cached.source === 'wikimedia' ? 'wikipedia' : cached.source,
          sourceTitle: cached.title,
          sourcePageUrl: cached.sourcePageUrl,
        };
        setPhoto(p);
        setPhotos(cached.gallery ? cached.gallery.map((g) => ({ ...g, source: 'wikipedia' })) : [p]);
        setPhotoState('loaded');
        return;
      }

      // 2. Resolve place visual (100% identical engine to right sidebar)
      placeVisualResolver
        .resolvePlaceVisual(visualContext, {
          signal: controller.signal,
          onProgressiveVisual: (progressive) => {
            if (requestIdRef.current !== thisRequestId) return;
            setVisual(progressive);
            const p: PlaceImage = {
              url: progressive.url,
              thumbnailUrl: progressive.thumbnailUrl || progressive.url,
              attribution: progressive.attribution,
              alt: progressive.title || targetName,
              source: progressive.source === 'wikimedia' ? 'wikipedia' : progressive.source,
              sourceTitle: progressive.title,
              sourcePageUrl: progressive.sourcePageUrl,
            };
            setPhoto(p);
            setPhotos([p]);
            setPhotoState('loaded');
          },
        })
        .then((resolvedVisual) => {
          if (requestIdRef.current !== thisRequestId) return;
          if (resolvedVisual) {
            setVisual(resolvedVisual);
            const p: PlaceImage = {
              url: resolvedVisual.url,
              thumbnailUrl: resolvedVisual.thumbnailUrl || resolvedVisual.url,
              attribution: resolvedVisual.attribution,
              alt: resolvedVisual.title || targetName,
              source: resolvedVisual.source === 'wikimedia' ? 'wikipedia' : resolvedVisual.source,
              sourceTitle: resolvedVisual.title,
              sourcePageUrl: resolvedVisual.sourcePageUrl,
            };
            setPhoto(p);
            setPhotos(
              resolvedVisual.gallery
                ? resolvedVisual.gallery.map((g) => ({ ...g, source: 'wikipedia' }))
                : [p]
            );
            setPhotoState('loaded');
          } else {
            setVisual(null);
            setPhoto(null);
            setPhotos([]);
            setPhotoState('unavailable');
          }
        })
        .catch((err) => {
          if (err?.name === 'AbortError') return;
          if (requestIdRef.current !== thisRequestId) return;
          setVisual(null);
          setPhoto(null);
          setPhotos([]);
          setPhotoState('unavailable');
        });
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [isOpen, name, category, coords?.lat, coords?.lng]);

  // Live Mapbox Map Instance for Mini Map preview card (Reuses existing map instance)
  useEffect(() => {
    if (!isOpen || !coords || !miniMapContainerRef.current) return;

    if (miniMapRef.current) {
      miniMapRef.current.setCenter([coords.lng, coords.lat]);
      return;
    }

    const FALLBACK_SATELLITE_STYLE: any = {
      version: 8,
      sources: {
        'esri-imagery': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          attribution: '',
          maxzoom: 19,
        },
        'carto-labels': {
          type: 'raster',
          tiles: [
            'https://cartodb-basemaps-a.global.ssl.fastly.net/dark_only_labels/{z}/{x}/{y}.png',
          ],
          tileSize: 256,
          maxzoom: 19,
        },
      },
      layers: [
        {
          id: 'satellite-tiles',
          type: 'raster',
          source: 'esri-imagery',
          minzoom: 0,
          maxzoom: 22,
        },
        {
          id: 'labels-tiles',
          type: 'raster',
          source: 'carto-labels',
          minzoom: 3,
          maxzoom: 22,
        },
      ],
    };

    try {
      const map = new mapboxgl.Map({
        container: miniMapContainerRef.current,
        style: FALLBACK_SATELLITE_STYLE,
        center: [coords.lng, coords.lat],
        zoom: 15,
        interactive: false,
        attributionControl: false,
      });

      miniMapRef.current = map;

      const timer = setTimeout(() => {
        map.resize();
      }, 100);

      return () => {
        clearTimeout(timer);
        if (miniMapRef.current) {
          miniMapRef.current.remove();
          miniMapRef.current = null;
        }
      };
    } catch (err) {
      console.warn('Mini map initialization warning:', err);
    }
  }, [isOpen, coords?.lat, coords?.lng]);

  if (!isOpen || !coords) return null;

  const handleAddTag = () => {
    const clean = newTagInput.trim().toLowerCase().replace(/^#/, '');
    if (clean && !tags.includes(clean)) {
      setTags((prev) => [...prev, clean]);
    }
    setNewTagInput('');
    setShowTagInput(false);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError('Please enter a place name');
      return;
    }

    const formattedTags = tags.map((t) => (t.startsWith('#') ? t : `#${t}`));

    onSave({
      name: cleanName,
      address: address.trim() || (cityRegion ? `${cleanName}, ${cityRegion}` : cleanName),
      cityRegion: cityRegion.trim() || 'Chennai, India',
      lat: coords.lat,
      lng: coords.lng,
      category,
      imageUrl: customPhotoUrl?.trim() || photo?.url || '',
      tags: formattedTags,
      notes: notes.trim(),
      isFavorite,
    });

    onClose();
  };

  const getCategoryIcon = (cat: LocationCategory) => {
    switch (cat) {
      case 'Travel':
        return <Plane className="w-3.5 h-3.5 text-blue-400" />;
      case 'Work':
        return <Briefcase className="w-3.5 h-3.5 text-amber-400" />;
      case 'Home':
        return <Home className="w-3.5 h-3.5 text-purple-400" />;
      case 'Food':
        return <Utensils className="w-3.5 h-3.5 text-rose-400" />;
      case 'Nature':
        return <Trees className="w-3.5 h-3.5 text-emerald-400" />;
      case 'History':
        return <Gem className="w-3.5 h-3.5 text-indigo-400" />;
      default:
        return <MapPin className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      {/* Liquid Glass Modal Box matching the second reference image */}
      <div className="w-full max-w-4xl bg-[#091322]/85 backdrop-blur-3xl border border-blue-400/35 rounded-[32px] p-6 sm:p-8 shadow-[0_0_60px_rgba(59,130,246,0.22)] relative text-white overflow-hidden">
        {/* Ambient Top Glow Accent */}
        <div className="absolute -top-24 left-1/3 w-96 h-40 bg-blue-500/20 blur-3xl pointer-events-none rounded-full" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-5 border-b border-white/10 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-400 shadow-md">
              <MapPin className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white tracking-tight leading-none">Add New Place</h3>
              <p className="text-xs text-slate-400 font-normal mt-1">
                Save this place to your personal Maply collection.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mt-3 p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs font-medium">
            {error}
          </div>
        )}

        {/* Form Body - Two-Column Split Layout */}
        <form onSubmit={handleSubmit} className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-7 relative z-10">
          {/* LEFT COLUMN: Form Inputs */}
          <div className="lg:col-span-7 flex flex-col space-y-4 text-xs">
            {/* Place Name */}
            <div>
              <label className="block font-semibold text-slate-300 mb-1.5">
                Place Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError('');
                }}
                placeholder={isLoadingReverseGeo ? 'Finding location name...' : 'Gangaiamman Koil Street'}
                className="w-full px-4 py-3 rounded-2xl bg-[#050C16]/70 border border-white/14 focus:border-blue-400/80 focus:ring-2 focus:ring-blue-500/20 text-sm text-white placeholder-slate-500 outline-none transition-all"
                autoFocus
              />
            </div>

            {/* City / Region & Category Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-300 mb-1.5">
                  City / Region <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={cityRegion}
                    onChange={(e) => setCityRegion(e.target.value)}
                    placeholder="Chennai, India"
                    className="w-full pl-10 pr-3 py-2.5 rounded-2xl bg-[#050C16]/70 border border-white/14 focus:border-blue-400 outline-none text-xs text-white placeholder-slate-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1.5">Category</label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    {getCategoryIcon(category)}
                  </div>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as LocationCategory)}
                    className="w-full pl-10 pr-8 py-2.5 rounded-2xl bg-[#050C16]/70 border border-white/14 focus:border-blue-400 outline-none text-xs text-white cursor-pointer appearance-none"
                  >
                    {CATEGORIES.filter((c) => c.id !== null).map((c) => (
                      <option key={c.label} value={c.id!} className="bg-[#091322] text-white">
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">
                    ▼
                  </div>
                </div>
              </div>
            </div>

            {/* Tags (optional) with Tag Pills */}
            <div>
              <label className="block font-semibold text-slate-300 mb-1.5">Tags (optional)</label>
              <div className="w-full p-2.5 rounded-2xl bg-[#050C16]/70 border border-white/14 flex flex-wrap items-center gap-2 min-h-[46px]">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 rounded-xl bg-slate-800/80 border border-white/15 text-xs text-slate-200 font-medium flex items-center gap-1.5 shadow-sm"
                  >
                    <Tag className="w-3 h-3 text-slate-400" />
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}

                {showTagInput ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                      placeholder="tag..."
                      className="w-20 px-2 py-1 rounded-lg bg-slate-900 border border-blue-400 text-xs text-white outline-none"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleAddTag}
                      className="px-2 py-1 rounded-lg bg-blue-600 text-white text-[10px] font-bold"
                    >
                      Add
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowTagInput(true)}
                    className="px-3 py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add tag</span>
                  </button>
                )}
              </div>
            </div>

            {/* Notes (optional) */}
            <div>
              <label className="font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>Notes (optional)</span>
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Famous temple street with vibrant local shops."
                className="w-full px-4 py-3 rounded-2xl bg-[#050C16]/70 border border-white/14 focus:border-blue-400 outline-none text-xs text-white placeholder-slate-500 resize-none"
              />
            </div>

            {/* Add to Favorites Toggle Row */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-[#050C16]/70 border border-white/14">
              <div className="flex items-center gap-2.5">
                <Heart className={`w-4 h-4 ${isFavorite ? 'text-rose-500 fill-rose-500' : 'text-slate-400'}`} />
                <span className="text-xs font-semibold text-slate-200">Add to Favorites</span>
              </div>

              {/* Animated iOS Toggle Switch */}
              <button
                type="button"
                onClick={() => setIsFavorite(!isFavorite)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isFavorite ? 'bg-blue-600' : 'bg-slate-700'
                }`}
                role="switch"
                aria-checked={isFavorite}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    isFavorite ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN: Visual Media Photo & Interactive Map Coordinates Card */}
          <div className="lg:col-span-5 flex flex-col space-y-4 justify-between">
            {/* Top Card: Feature Photo Preview OR Category Logo Identity Card (100% sidebar parity) */}
            <div className="relative w-full h-[190px] rounded-2xl overflow-hidden border border-white/15 shadow-xl bg-slate-900 group shrink-0">
              <PlaceHeroImage
                visual={visual}
                photo={photo}
                photos={photos}
                photoState={photoState}
                alt={name || 'Place preview'}
                className="w-full h-full object-cover"
                onCandidateSuccess={(cand) => {
                  if (coords) {
                    const normPlace: NormalizedPlace = {
                      id: initialPlace?.id || `temp-${coords.lat}-${coords.lng}`,
                      name: name || 'Selected Location',
                      latitude: coords.lat,
                      longitude: coords.lng,
                      category,
                      source: initialPlace?.source || 'user',
                    };
                    const visualContext = buildPlaceVisualContext(normPlace);
                    placeVisualResolver.cacheVisual(visualContext, {
                      url: cand.url,
                      thumbnailUrl: cand.thumbnailUrl || cand.url,
                      type: 'photo',
                      source: cand.source === 'wikipedia' ? 'wikimedia' : (cand.source as any) || 'wikimedia',
                      confidence: 1.0,
                      title: cand.sourceTitle || name,
                      attribution: cand.attribution,
                      sourcePageUrl: cand.sourcePageUrl,
                    });
                  }
                }}
              />

              {/* Bottom Right Floating Button */}
              <button
                type="button"
                onClick={() => setShowPhotoUrlInput(!showPhotoUrlInput)}
                className="absolute bottom-3 right-3 px-3 py-1.5 rounded-xl bg-black/65 backdrop-blur-md border border-white/20 text-xs font-semibold text-white hover:bg-black/85 cursor-pointer flex items-center gap-1.5 shadow-lg transition-transform hover:scale-105 z-10"
              >
                <Camera className="w-3.5 h-3.5 text-blue-400" />
                <span>Change Photo</span>
              </button>
            </div>

            {/* Popover Custom Photo URL Input */}
            {showPhotoUrlInput && (
              <div className="p-3 rounded-2xl bg-[#050C16] border border-white/15 space-y-2 animate-in fade-in duration-150">
                <span className="text-[10.5px] font-semibold text-slate-300">Custom Photo Link</span>
                <input
                  type="url"
                  value={customPhotoUrl}
                  onChange={(e) => {
                    const url = e.target.value;
                    setCustomPhotoUrl(url);
                    if (url.trim()) {
                      const customP: PlaceImage = {
                        url: url.trim(),
                        thumbnailUrl: url.trim(),
                        alt: name || 'Custom Photo',
                        source: 'user',
                      };
                      setPhoto(customP);
                      setPhotos([customP]);
                      setPhotoState('loaded');
                    }
                  }}
                  placeholder="Paste image URL (https://...)"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-xs text-white outline-none focus:border-blue-400"
                />
              </div>
            )}

            {/* Bottom Card: Mini Map Coordinates Preview Card */}
            <div className="relative w-full h-[155px] rounded-2xl overflow-hidden border border-white/15 shadow-xl bg-[#070e17]">
              {/* Dynamic Live Satellite Mapbox Container for exact selected location */}
              <div ref={miniMapContainerRef} className="absolute inset-0 w-full h-full" />

              {/* Center Glowing Location Blue Pin Marker - Pinned at exact center (50%, 50%) */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none flex flex-col items-center justify-center">
                <div className="relative w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-[0_0_25px_rgba(59,130,246,0.9)] border-2 border-white animate-bounce">
                  <MapPin className="w-4 h-4 fill-white text-blue-600" />
                </div>
                <div className="w-10 h-10 rounded-full bg-blue-500/30 border border-blue-400/50 animate-ping absolute -bottom-1 pointer-events-none" />
              </div>

              {/* Top-Right Expand Icon Button */}
              <div className="absolute top-2.5 right-2.5 z-20 w-7 h-7 rounded-lg bg-black/60 backdrop-blur-md text-white flex items-center justify-center border border-white/20 pointer-events-none">
                <Maximize2 className="w-3.5 h-3.5 text-slate-300" />
              </div>

              {/* Bottom Dark Banner with Coordinates */}
              <div className="absolute bottom-0 inset-x-0 bg-black/80 backdrop-blur-md border-t border-white/12 px-3 py-2 flex items-center justify-between text-[11px] font-mono text-slate-200 z-20">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-blue-400" />
                  <span>Selected Coordinates</span>
                </div>
                <span>
                  Lat: {coords.lat.toFixed(5)} &nbsp; Lng: {coords.lng.toFixed(5)}
                </span>
              </div>
            </div>
          </div>

          {/* FOOTER ACTIONS BAR */}
          <div className="lg:col-span-12 flex items-center justify-end gap-3.5 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-full border border-white/15 text-slate-300 hover:text-white hover:bg-white/10 text-sm font-semibold transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-7 py-2.5 rounded-full text-sm font-bold shadow-[0_0_25px_rgba(59,130,246,0.5)] flex items-center space-x-2 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
            >
              <span>Save Place</span>
              <ArrowRight className="w-4 h-4 text-white" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
