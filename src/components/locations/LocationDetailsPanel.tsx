import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Heart,
  MapPin,
  Copy,
  Check,
  Pencil,
  Plus,
  Share2,
  Navigation,
  Trash2,
  Bookmark,
  Calendar,
  Compass,
  Landmark,
  Trees,
  Utensils,
  Briefcase,
  ShoppingBag,
  Camera,
  Globe,
  Phone,
  Star,
  ExternalLink,
  Hash,
} from 'lucide-react';
import { LocationItem } from '../../types/location';
import { NormalizedPlace, PlaceImage } from '../../types/place';
import { PlaceVisual } from '../../types/visual';
import { wikimediaImageService, CanonicalLocation } from '../../services/wikimediaImageService';
import { placeVisualResolver } from '../../services/visuals/PlaceVisualResolver';
import { buildPlaceVisualContext } from '../../services/visuals/visualContextHelper';
import { locationRepo } from '../../services/locationRepository';
import { PlaceHeroImage, PhotoState } from './PlaceHeroImage';
import { UserLocation, computeDistanceMeters } from '../../hooks/useUserLocation';

interface LocationDetailsPanelProps {
  place: NormalizedPlace | null;
  savedLocation: LocationItem | null;
  userLocation?: UserLocation | null;
  isLoading?: boolean;
  onClose: () => void;
  onSavePlace: (place: NormalizedPlace) => void;
  onEditSaved: (location: LocationItem) => void;
  onDeleteSaved: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onShowToast: (message: string, type?: 'success' | 'info' | 'error') => void;
  onSelectNearbyPlace?: (place: NormalizedPlace) => void;
  onSetAsCurrentLocation?: (place: NormalizedPlace) => void;
  isCurrentLocationCalibrated?: boolean;
  onResetLocationCalibration?: () => void;
  onOpenAddModal?: (place: NormalizedPlace) => void;
}

type TabType = 'overview' | 'photos' | 'notes';

function getCategoryIcon(category?: string) {
  const cat = (category || '').toLowerCase();
  if (cat.includes('current') || cat.includes('my location') || cat.includes('gps') || cat.includes('position')) {
    return <Navigation className="w-3.5 h-3.5 text-cyan-400" />;
  }
  if (
    cat.includes('nature') ||
    cat.includes('park') ||
    cat.includes('beach') ||
    cat.includes('outdoor')
  ) {
    return <Trees className="w-3.5 h-3.5" />;
  }
  if (
    cat.includes('history') ||
    cat.includes('heritage') ||
    cat.includes('museum') ||
    cat.includes('palace') ||
    cat.includes('attraction')
  ) {
    return <Landmark className="w-3.5 h-3.5" />;
  }
  if (cat.includes('food') || cat.includes('restaurant') || cat.includes('cafe')) {
    return <Utensils className="w-3.5 h-3.5" />;
  }
  if (cat.includes('work') || cat.includes('office')) {
    return <Briefcase className="w-3.5 h-3.5" />;
  }
  if (cat.includes('shopping') || cat.includes('mall') || cat.includes('market') || cat.includes('store')) {
    return <ShoppingBag className="w-3.5 h-3.5" />;
  }
  return <Compass className="w-3.5 h-3.5" />;
}

function formatDMS(lat: number, lng: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lng).toFixed(4)}° ${lngDir}`;
}

export const LocationDetailsPanel: React.FC<LocationDetailsPanelProps> = ({
  place,
  savedLocation,
  userLocation,
  isLoading = false,
  onClose,
  onSavePlace,
  onEditSaved,
  onDeleteSaved,
  onToggleFavorite,
  onShowToast,
  onSetAsCurrentLocation,
  isCurrentLocationCalibrated,
  onResetLocationCalibration,
  onOpenAddModal,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [copiedCoords, setCopiedCoords] = useState(false);
  const [visual, setVisual] = useState<PlaceVisual | null>(null);
  const [photo, setPhoto] = useState<PlaceImage | null>(null);
  const [allPhotos, setAllPhotos] = useState<PlaceImage[]>([]);
  const [photoState, setPhotoState] = useState<PhotoState>('idle');
  const [matchedSourceTitle, setMatchedSourceTitle] = useState<string | null>(null);
  const [matchedPageUrl, setMatchedPageUrl] = useState<string | null>(null);
  const [matchedExtract, setMatchedExtract] = useState<string | null>(null);
  const requestIdRef = useRef<number>(0);
  const activeLocationKeyRef = useRef<string>('');

  // Normalize current active location representation
  const activePlace: NormalizedPlace | null = place
    ? place
    : savedLocation
    ? {
        id: savedLocation.id,
        providerId: savedLocation.providerId || savedLocation.placeId,
        mapboxId: savedLocation.providerId || savedLocation.placeId,
        featureType: savedLocation.featureType || 'poi',
        name: savedLocation.name,
        latitude: savedLocation.latitude ?? savedLocation.lat,
        longitude: savedLocation.longitude ?? savedLocation.lng,
        address: savedLocation.address || savedLocation.cityRegion,
        city: savedLocation.cityRegion?.split(',')[0]?.trim(),
        category: savedLocation.category,
        photos:
          savedLocation.imageUrl && !savedLocation.imageUrl.startsWith('/assets/')
            ? [
                {
                  url: savedLocation.imageUrl,
                  alt: savedLocation.imageAlt || savedLocation.name,
                  attribution:
                    savedLocation.imageCredit ||
                    `Photo via Wikipedia — "${savedLocation.name}"`,
                  source: 'wikimedia' as const,
                },
              ]
            : undefined,
        source: 'saved-location',
      }
    : null;

  // Calculate distance from user's current GPS position to this place
  const distanceFromUserMeters = useMemo(() => {
    if (
      !userLocation ||
      !activePlace ||
      activePlace.latitude == null ||
      activePlace.longitude == null
    ) {
      return null;
    }
    return computeDistanceMeters(
      userLocation.latitude,
      userLocation.longitude,
      activePlace.latitude,
      activePlace.longitude
    );
  }, [userLocation, activePlace]);

  // Calibration is strictly limited to places within immediate proximity (<= 250 meters)
  // so customers are not bombarded with "Set as My Location" buttons across distant map places
  const isWithinProximity =
    distanceFromUserMeters !== null && distanceFromUserMeters <= 250;

  // Multi-Provider Place Visual Enrichment Pipeline (Wikimedia -> Foursquare -> Brand Logo -> Mapbox Icon)
  // Enforces strict separation: Visual lookup NEVER mutates canonical coordinates or place identity
  useEffect(() => {
    if (!activePlace) {
      setVisual(null);
      setPhoto(null);
      setAllPhotos([]);
      setPhotoState('idle');
      setMatchedSourceTitle(null);
      setMatchedPageUrl(null);
      setMatchedExtract(null);
      return;
    }

    setCopiedCoords(false);
    setActiveTab('overview');

    // 1. Clear previous visual immediately to prevent mismatch during transition
    setVisual(null);
    setPhoto(null);
    setAllPhotos([]);
    setPhotoState('loading');
    setMatchedSourceTitle(null);
    setMatchedPageUrl(null);
    setMatchedExtract(null);

    // If activePlace already has a pre-attached verified photo that is not a placeholder
    if (
      activePlace.photos &&
      activePlace.photos.length > 0 &&
      !activePlace.photos[0].url.startsWith('/assets/')
    ) {
      const p = activePlace.photos[0];
      const preVisual: PlaceVisual = {
        url: p.url,
        thumbnailUrl: p.thumbnailUrl || p.url,
        type: 'photo',
        source: 'wikimedia',
        confidence: 1.0,
        title: p.sourceTitle || activePlace.name,
        attribution: p.attribution,
        sourcePageUrl: p.sourcePageUrl,
      };
      setVisual(preVisual);
      setPhoto(p);
      setAllPhotos(activePlace.photos);
      setPhotoState('loaded');
      return;
    }

    // Monotonic request ID & active key protection to discard stale async completions
    const thisRequestId = ++requestIdRef.current;
    const activeKey = `${savedLocation?.id || activePlace.id || ''}_${activePlace.latitude}_${activePlace.longitude}_${activePlace.name}`;
    activeLocationKeyRef.current = activeKey;
    const controller = new AbortController();

    const visualContext = buildPlaceVisualContext(activePlace, savedLocation);

    // 1. FAST CACHE CHECK: If visual was previously resolved, render instantly with zero network delay
    const cached = placeVisualResolver.getCachedVisual(visualContext);
    if (cached) {
      setVisual(cached);
      const cachePhoto: PlaceImage = {
        url: cached.url,
        thumbnailUrl: cached.thumbnailUrl || cached.url,
        attribution: cached.attribution,
        alt: cached.title || activePlace.name,
        source: cached.source === 'wikimedia' ? 'wikipedia' : cached.source,
        sourceTitle: cached.title,
        sourcePageUrl: cached.sourcePageUrl,
      };
      setPhoto(cachePhoto);
      setAllPhotos(
        cached.gallery && cached.gallery.length > 0
          ? cached.gallery.map((g) => ({
              url: g.url,
              thumbnailUrl: g.thumbnailUrl || g.url,
              attribution: g.attribution,
              alt: g.title || activePlace.name,
              source: g.source === 'wikimedia' ? 'wikipedia' : g.source,
              sourceTitle: g.title,
              sourcePageUrl: g.sourcePageUrl,
            }))
          : [cachePhoto]
      );
      setPhotoState('loaded');
      setMatchedSourceTitle(cached.title || null);
      setMatchedPageUrl(cached.sourcePageUrl || null);
      return;
    }

    // 2. MULTI-PROVIDER RESOLUTION: Wikimedia (Primary) -> Foursquare (if configured) -> Brand Visual -> Mapbox Icon
    placeVisualResolver
      .resolvePlaceVisual(visualContext, {
        signal: controller.signal,
        onProgressiveVisual: (progressive) => {
          if (
            requestIdRef.current !== thisRequestId ||
            activeLocationKeyRef.current !== activeKey
          ) {
            return; // Discard stale response
          }
          // Emit fast candidate immediately so browser begins loading without waiting!
          setVisual(progressive);
          const progressivePhoto: PlaceImage = {
            url: progressive.url,
            thumbnailUrl: progressive.thumbnailUrl || progressive.url,
            attribution: progressive.attribution,
            alt: progressive.title || activePlace.name,
            source: progressive.source === 'wikimedia' ? 'wikipedia' : progressive.source,
            sourceTitle: progressive.title,
            sourcePageUrl: progressive.sourcePageUrl,
          };
          setPhoto(progressivePhoto);
          setAllPhotos([progressivePhoto]);
          setPhotoState('loaded');
          if (progressive.title) setMatchedSourceTitle(progressive.title);
          if (progressive.sourcePageUrl) setMatchedPageUrl(progressive.sourcePageUrl);
        },
      })
      .then((resolvedVisual) => {
        if (
          requestIdRef.current !== thisRequestId ||
          activeLocationKeyRef.current !== activeKey
        ) {
          return; // Discard stale response
        }

        if (resolvedVisual) {
          setVisual(resolvedVisual);
          const finalPhoto: PlaceImage = {
            url: resolvedVisual.url,
            thumbnailUrl: resolvedVisual.thumbnailUrl || resolvedVisual.url,
            attribution: resolvedVisual.attribution,
            alt: resolvedVisual.title || activePlace.name,
            source: resolvedVisual.source === 'wikimedia' ? 'wikipedia' : resolvedVisual.source,
            sourceTitle: resolvedVisual.title,
            sourcePageUrl: resolvedVisual.sourcePageUrl,
          };
          setPhoto(finalPhoto);
          setAllPhotos(
            resolvedVisual.gallery && resolvedVisual.gallery.length > 0
              ? resolvedVisual.gallery.map((g) => ({
                  url: g.url,
                  thumbnailUrl: g.thumbnailUrl || g.url,
                  attribution: g.attribution,
                  alt: g.title || activePlace.name,
                  source: g.source === 'wikimedia' ? 'wikipedia' : g.source,
                  sourceTitle: g.title,
                  sourcePageUrl: g.sourcePageUrl,
                }))
              : [finalPhoto]
          );
          setPhotoState('loaded');
          if (resolvedVisual.title) setMatchedSourceTitle(resolvedVisual.title);
          if (resolvedVisual.sourcePageUrl) setMatchedPageUrl(resolvedVisual.sourcePageUrl);
        } else {
          setVisual(null);
          setPhoto(null);
          setAllPhotos([]);
          setPhotoState('unavailable');
          setMatchedSourceTitle(null);
          setMatchedPageUrl(null);
          setMatchedExtract(null);
        }
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        if (
          requestIdRef.current !== thisRequestId ||
          activeLocationKeyRef.current !== activeKey
        ) {
          return;
        }
        console.warn('Place visual lookup error', err);
        setVisual(null);
        setPhoto(null);
        setAllPhotos([]);
        setPhotoState('unavailable');
      });

    return () => {
      controller.abort();
    };
  }, [
    activePlace?.providerId,
    activePlace?.mapboxId,
    activePlace?.name,
    activePlace?.latitude,
    activePlace?.longitude,
    savedLocation?.id,
    savedLocation?.name,
    savedLocation?.imageUrl,
  ]);

  if (!activePlace) {
    return null;
  }

  const isSaved = Boolean(savedLocation);
  const isFavorite = savedLocation?.isFavorite ?? false;
  const lat = activePlace.latitude;
  const lng = activePlace.longitude;
  const coordsFormatted = formatDMS(lat, lng);

  // CANONICAL DISPLAY NAME: The selected Maply location is ALWAYS the source of truth!
  // It NEVER comes from the Wikimedia image search candidate title.
  const displayName = savedLocation?.name || activePlace.name;

  const subtitleAddress =
    savedLocation?.address ||
    activePlace.address ||
    savedLocation?.cityRegion ||
    `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

  const categoryName = savedLocation?.category || activePlace.category || 'Landmark';

  const creationDate =
    savedLocation?.createdAt ||
    new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const tagsList =
    savedLocation?.tags && savedLocation.tags.length > 0
      ? savedLocation.tags
      : ['#travel', '#location'];

  const notesText = savedLocation?.notes || '';

  const handleCopyCoordinates = () => {
    navigator.clipboard.writeText(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    setCopiedCoords(true);
    onShowToast('Coordinates copied to clipboard', 'info');
    setTimeout(() => setCopiedCoords(false), 2000);
  };

  const handleShare = async () => {
    const shareUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    const shareText = `Explore "${displayName}" on Maply: ${shareUrl}`;

    if (typeof navigator !== 'undefined' && navigator.share && window.isSecureContext) {
      try {
        await navigator.share({
          title: displayName,
          text: shareText,
          url: shareUrl,
        });
        onShowToast('Shared location successfully!', 'success');
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }

    let copied = false;
    try {
      await navigator.clipboard.writeText(shareUrl);
      copied = true;
    } catch {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = shareUrl;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        copied = document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch {
        copied = false;
      }
    }

    if (copied) {
      onShowToast('Location share link copied to clipboard', 'success');
    } else {
      onShowToast(`Share URL: ${shareUrl}`, 'info');
    }
  };

  const handleDirections = () => {
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    try {
      const a = document.createElement('a');
      a.href = mapsUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      window.open(mapsUrl, '_blank', 'noopener,noreferrer');
    }
    onShowToast(`Opening Google Maps directions for "${displayName}"...`, 'info');
  };

  const handleDeleteOrDismiss = () => {
    if (isSaved && savedLocation) {
      onDeleteSaved(savedLocation.id);
    } else {
      onClose();
      onShowToast('Location dismissed', 'info');
    }
  };

  const handleEdit = () => {
    if (isSaved && savedLocation) {
      onEditSaved(savedLocation);
    } else if (onOpenAddModal) {
      onOpenAddModal(activePlace);
    } else {
      onSavePlace(activePlace);
    }
  };

  const handleToggleFav = () => {
    if (isSaved && savedLocation) {
      onToggleFavorite(savedLocation.id);
    } else {
      onSavePlace(activePlace);
    }
  };

  return (
    <div
      id="location-details-panel"
      key={activePlace.providerId || activePlace.mapboxId || `${lat}_${lng}`}
      className="details-panel fixed top-[115px] bottom-[115px] max-h-[calc(100vh-230px)] right-[28px] w-[calc(100vw-32px)] sm:w-[320px] sm:min-w-[320px] sm:max-w-[320px] flex flex-col min-h-0 liquid-glass border border-white/16 rounded-[28px] p-[16px] shadow-[0_25px_60px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.15)] z-20 select-none pointer-events-auto overflow-hidden transition-all animate-in fade-in slide-in-from-right-3 duration-300 box-border shrink-0"
    >
      {/* Mobile Drag Handle Indicator */}
      <div className="sm:hidden w-10 h-1 rounded-full bg-white/25 mx-auto mb-2 shrink-0" />

      {/* 1. PHOTO HERO (fixed aspect-ratio hero, does not scroll) */}
      <div className="shrink-0">
        <PlaceHeroImage
          visual={visual}
          photo={photo}
          photos={allPhotos}
          photoState={photoState}
          alt={activePlace.name}
          onClose={onClose}
          className="relative w-full h-[120px] rounded-[18px] overflow-hidden bg-[#0d151f] shadow-inner mb-3 shrink-0"
          onCandidateSuccess={(cand) => {
            if (cand.sourceTitle) {
              setMatchedSourceTitle(cand.sourceTitle);
            }
            if (activePlace) {
              const visualContext = buildPlaceVisualContext(activePlace, savedLocation);
              placeVisualResolver.cacheVisual(visualContext, {
                url: cand.url,
                thumbnailUrl: cand.thumbnailUrl || cand.url,
                type: 'photo',
                source: cand.source === 'wikipedia' ? 'wikimedia' : (cand.source as any) || 'wikimedia',
                confidence: 1.0,
                title: cand.sourceTitle || activePlace.name,
                attribution: cand.attribution,
                sourcePageUrl: cand.sourcePageUrl,
              });
            }
          }}
        />
      </div>

      {/* 2. PANEL HEADER (name, address, favorite toggle, category chip) */}
      <div className="mt-3 px-0.5 text-left shrink-0">
        <div className="flex items-center justify-between gap-2.5">
          <h2
            className="text-[22px] font-bold text-white tracking-tight leading-tight truncate"
            title={displayName}
          >
            {displayName}
          </h2>
          <button
            id="toggle-favorite-btn"
            onClick={handleToggleFav}
            aria-label="Toggle favorite"
            className="p-1 -mr-1 rounded-full hover:bg-white/10 transition-transform active:scale-90 cursor-pointer shrink-0"
          >
            <Heart
              className={`w-6 h-6 transition-colors ${
                isFavorite
                  ? 'fill-[#ef4444] text-[#ef4444]'
                  : 'text-slate-400 hover:text-rose-400'
              }`}
            />
          </button>
        </div>

        {/* Address subtitle */}
        <div className="flex items-center gap-1.5 text-slate-300 text-xs mt-1 line-clamp-1">
          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="truncate">{subtitleAddress}</span>
        </div>

        {/* Category pill */}
        <div className="mt-2 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/20 text-blue-300 border border-blue-400/30 shadow-[0_0_10px_rgba(59,130,246,0.15)] shrink-0">
            <Briefcase className="w-3.5 h-3.5 text-blue-400" />
            <span className="capitalize">{categoryName}</span>
          </span>
        </div>
      </div>

      {/* 3. PANEL TABS (Overview / Photos / Notes) */}
      <div className="mt-3 flex items-center bg-[#07111c]/60 p-1 rounded-full border border-white/10 shrink-0 backdrop-blur-md h-[40px]">
        <button
          id="tab-overview"
          onClick={() => setActiveTab('overview')}
          className={`flex-1 py-1.5 rounded-full text-xs font-semibold transition-all text-center cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-blue-600/35 text-white shadow-[0_0_12px_rgba(59,130,246,0.3)] border border-blue-400/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Overview
        </button>

        <button
          id="tab-photos"
          onClick={() => setActiveTab('photos')}
          className={`flex-1 py-1.5 rounded-full text-xs font-semibold transition-all text-center cursor-pointer ${
            activeTab === 'photos'
              ? 'bg-blue-600/35 text-white shadow-[0_0_12px_rgba(59,130,246,0.3)] border border-blue-400/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Photos
        </button>

        <button
          id="tab-notes"
          onClick={() => setActiveTab('notes')}
          className={`flex-1 py-1.5 rounded-full text-xs font-semibold transition-all text-center cursor-pointer ${
            activeTab === 'notes'
              ? 'bg-blue-600/35 text-white shadow-[0_0_12px_rgba(59,130,246,0.3)] border border-blue-400/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Notes
        </button>
      </div>

      {/* 4. DETAILS-PANEL__SCROLL-REGION (flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain;) */}
      <div className="details-panel__scroll-region flex-[1_1_auto] min-h-0 overflow-y-auto overscroll-contain space-y-2.5 my-2.5 pr-1 -mr-1 custom-scrollbar">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-2 text-left animate-in fade-in duration-200">
            {/* Calibration Card: Current Location status vs Set as Current Location */}
            {activePlace.category === 'Current Location' || activePlace.name?.toLowerCase().includes('current location') ? (
              <div className="p-3 rounded-xl bg-[#071322] border border-cyan-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-300">
                    <Navigation className="w-3.5 h-3.5 text-cyan-400 -rotate-45" />
                    <span>Current Device Location</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[9.5px] font-bold border ${
                      isCurrentLocationCalibrated
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-blue-500/20 text-blue-300 border-blue-400/30'
                    }`}
                  >
                    {isCurrentLocationCalibrated ? '✓ Calibrated (Accurate)' : 'Device Sensor'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-snug">
                  {isCurrentLocationCalibrated
                    ? 'Your location is manually calibrated to this exact building. Inaccurate Wi-Fi guesses are suppressed.'
                    : 'Location is derived from your browser GPS/Wi-Fi. You can drag the blue dot on the map or click any building to calibrate your exact spot.'}
                </p>
                {isCurrentLocationCalibrated && onResetLocationCalibration && (
                  <button
                    onClick={onResetLocationCalibration}
                    className="w-full py-1.5 px-3 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-medium border border-white/10 transition-colors cursor-pointer"
                  >
                    Reset to Device GPS
                  </button>
                )}
              </div>
            ) : (
              isWithinProximity && onSetAsCurrentLocation && (
                <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-950/40 via-[#0a1828] to-blue-950/30 border border-cyan-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-cyan-300 font-semibold text-xs">
                      <Navigation className="w-3.5 h-3.5 text-cyan-400 -rotate-45" />
                      <span>Nearby Building</span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                      {Math.round(distanceFromUserMeters!)}m from GPS
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-snug">
                    Are you at this building? You can calibrate your blue location marker to this spot.
                  </p>
                  <button
                    id="calibrate-to-this-place-btn"
                    onClick={() => onSetAsCurrentLocation(activePlace)}
                    className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white font-semibold text-xs shadow-md transition-all cursor-pointer active:scale-[0.98]"
                  >
                    <Navigation className="w-3.5 h-3.5 -rotate-45" />
                    <span>Set as My Current Location</span>
                  </button>
                </div>
              )
            )}

            {/* Coordinates Card with 1-click copy */}
            <div className="flex items-center justify-between py-2.5 px-3 rounded-2xl bg-white/[0.04] border border-white/[0.06] hover:border-white/10 transition-colors">
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-[11px] text-slate-400 font-normal">
                    Coordinates
                  </span>
                  <span className="text-sm font-medium text-slate-100 font-mono">
                    {lat.toFixed(4)}, {lng.toFixed(4)}
                  </span>
                </div>
              </div>
              <button
                onClick={handleCopyCoordinates}
                aria-label="Copy coordinates"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white bg-white/[0.06] border border-white/[0.08] transition-colors cursor-pointer"
                title="Copy coordinates"
              >
                {copiedCoords ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {/* Added on Card */}
            <div className="flex items-center gap-3 py-2.5 px-3 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[11px] text-slate-400 font-normal">
                  Added on
                </span>
                <span className="text-sm font-medium text-slate-100">
                  {creationDate}
                </span>
              </div>
            </div>

            {/* Tags Card */}
            <div className="flex items-start gap-3 py-2.5 px-3 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
              <Hash className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div className="flex flex-col flex-1">
                <span className="text-[11px] text-slate-400 font-normal mb-1.5">
                  Tags
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {tagsList.map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md bg-white/[0.07] border border-white/10 text-xs text-slate-300 font-mono"
                    >
                      {tag.startsWith('#') ? tag : `#${tag}`}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Notes if present */}
            {notesText && (
              <div className="py-2.5 px-3 rounded-2xl bg-white/[0.04] border border-white/[0.06] space-y-1">
                <span className="text-[11px] text-slate-400 font-normal">Notes</span>
                <p className="text-xs text-slate-200 leading-relaxed">{notesText}</p>
              </div>
            )}

            {/* Wikipedia Historical Extract / Summary if present */}
            {matchedExtract && (
              <div className="py-2.5 px-3 rounded-2xl bg-white/[0.04] border border-cyan-500/20 space-y-1 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-semibold text-cyan-400 tracking-wider">
                    Context & History
                  </span>
                  {matchedSourceTitle && (
                    <span className="text-[9.5px] text-slate-400 font-medium">
                      via Wikipedia
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">{matchedExtract}</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PHOTOS GALLERY */}
        {activeTab === 'photos' && (
          <div className="space-y-2.5 text-left animate-in fade-in duration-200">
            {photoState === 'loading' && (
              <div className="rounded-xl overflow-hidden bg-[#07111f]/80 border border-white/8 p-6 flex flex-col items-center justify-center space-y-2 animate-pulse min-h-[160px]">
                <Camera className="w-6 h-6 text-cyan-400/80 animate-pulse" />
                <p className="text-xs text-slate-400 font-medium">Resolving verified photography...</p>
              </div>
            )}

            {photoState === 'loaded' && allPhotos.length > 0 && (
              <div className="space-y-2">
                {allPhotos.map((item, idx) => (
                  <div
                    key={idx}
                    className="group/photo rounded-xl overflow-hidden bg-[#07111f]/80 border border-white/8 space-y-1.5"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden bg-[#0a1424]">
                      <img
                        src={item.url}
                        alt={item.alt || activePlace.name}
                        className="w-full h-full object-cover group-hover/photo:scale-105 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/85 via-black/20 to-black/35" />
                    </div>
                    {item.attribution && (
                      <div className="px-2.5 pb-2 flex items-center justify-between text-[10px] text-slate-300">
                        <span className="truncate">{item.attribution}</span>
                        {item.sourcePageUrl && (
                          <a
                            href={item.sourcePageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-400 hover:underline shrink-0 ml-2"
                          >
                            Source
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {(photoState === 'unavailable' || (photoState === 'loaded' && allPhotos.length === 0)) && (
              <div className="p-5 rounded-xl bg-white/[0.03] border border-white/6 text-center space-y-1.5">
                <Camera className="w-6 h-6 text-slate-500 mx-auto" />
                <p className="text-xs text-slate-300 font-medium">Photo unavailable</p>
                <p className="text-[10.5px] text-slate-500 max-w-[240px] mx-auto">
                  No verified external photographs were found for this immediate location.
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: NOTES */}
        {activeTab === 'notes' && (
          <div className="space-y-2 animate-in fade-in duration-200 text-left">
            <div className="p-3 rounded-xl bg-[#07111f]/80 border border-white/6 space-y-1.5">
              <span className="block text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                Personal Notes
              </span>
              {notesText ? (
                <p className="text-xs text-slate-200 leading-relaxed italic">
                  &ldquo;{notesText}&rdquo;
                </p>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  No personal notes added for this location yet.
                </p>
              )}
            </div>

            {/* Tags */}
            {tagsList.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tagsList.map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded-md bg-white/5 text-[10.5px] text-slate-300 font-mono"
                  >
                    {tag.startsWith('#') ? tag : `#${tag}`}
                  </span>
                ))}
              </div>
            )}

            {isSaved && savedLocation && (
              <button
                onClick={() => onEditSaved(savedLocation)}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium cursor-pointer rounded-lg hover:bg-blue-500/10 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Edit notes & tags</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 5. PANEL-ACTION-BAR (flex-shrink: 0, ALWAYS VISIBLE, NEVER SCROLLS AWAY) */}
      <div className="panel-action-bar flex-shrink-0 pt-3 border-t border-white/10 grid grid-cols-4 gap-2 select-none mt-auto">
        {/* Button 1: Edit Location */}
        <button
          id="action-edit-btn"
          onClick={handleEdit}
          title="Edit location details and save to account"
          className="h-[56px] flex flex-col items-center justify-center gap-1 rounded-2xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/10 text-slate-200 hover:text-white transition-all active:scale-95 cursor-pointer shadow-sm"
        >
          <Pencil className="w-4 h-4 text-blue-400" />
          <span className="text-[10.5px] font-medium text-slate-300">
            Edit
          </span>
        </button>

        {/* Button 2: Share */}
        <button
          id="action-share-btn"
          onClick={handleShare}
          title="Share location"
          className="h-[56px] flex flex-col items-center justify-center gap-1 rounded-2xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/10 text-slate-200 hover:text-white transition-all active:scale-95 cursor-pointer shadow-sm"
        >
          <Share2 className="w-4 h-4 text-blue-400" />
          <span className="text-[10.5px] font-medium text-slate-300">Share</span>
        </button>

        {/* Button 3: Directions */}
        <button
          id="action-directions-btn"
          onClick={handleDirections}
          title="Get directions in Google Maps"
          className="h-[56px] flex flex-col items-center justify-center gap-1 rounded-2xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/10 text-slate-200 hover:text-white transition-all active:scale-95 cursor-pointer shadow-sm"
        >
          <Navigation className="w-4 h-4 text-slate-300" />
          <span className="text-[10.5px] font-medium text-slate-300">Directions</span>
        </button>

        {/* Button 4: Delete / Dismiss */}
        <button
          id="action-delete-btn"
          onClick={handleDeleteOrDismiss}
          title={isSaved ? 'Delete location' : 'Dismiss'}
          className="h-[56px] flex flex-col items-center justify-center gap-1 rounded-2xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/25 text-rose-300 hover:text-rose-200 transition-all active:scale-95 cursor-pointer shadow-sm"
        >
          <Trash2 className="w-4 h-4 text-rose-400" />
          <span className="text-[10.5px] font-medium text-rose-400">
            {isSaved ? 'Delete' : 'Dismiss'}
          </span>
        </button>
      </div>
    </div>
  );
};
