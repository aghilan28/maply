import React, { useState, useEffect, useMemo, useRef } from 'react';
import { PlaceImage } from '../../types/place';
import { PlaceVisual } from '../../types/visual';
import { Camera, ImageOff, X, Sparkles, Tag } from 'lucide-react';

export type PhotoState = 'idle' | 'loading' | 'loaded' | 'unavailable';

export interface PlaceHeroImageProps {
  visual?: PlaceVisual | null;
  photo?: PlaceImage | null;
  photos?: PlaceImage[];
  photoState?: PhotoState;
  // Backward compatibility props
  image?: PlaceImage | null;
  loading?: boolean;
  attribution?: string;
  alt: string;
  onClose?: () => void;
  className?: string;
  onCandidateSuccess?: (candidate: PlaceImage, index: number) => void;
}

export const PlaceHeroImage: React.FC<PlaceHeroImageProps> = ({
  visual,
  photo,
  photos,
  photoState,
  image,
  loading,
  attribution,
  alt,
  onClose,
  className = '',
  onCandidateSuccess,
}) => {
  // Build ordered candidate list
  const candidates: PlaceImage[] = useMemo(() => {
    if (visual && visual.url) {
      const primaryVisualImg: PlaceImage = {
        url: visual.url,
        thumbnailUrl: visual.thumbnailUrl || visual.url,
        attribution: visual.attribution,
        alt: visual.title || alt,
        source: visual.source === 'wikimedia' ? 'wikipedia' : visual.source,
        sourceTitle: visual.title,
        sourcePageUrl: visual.sourcePageUrl,
      };

      if (visual.gallery && visual.gallery.length > 0) {
        return visual.gallery.map((g) => ({
          url: g.url,
          thumbnailUrl: g.thumbnailUrl || g.url,
          attribution: g.attribution,
          alt: g.title || alt,
          source: g.source === 'wikimedia' ? 'wikipedia' : g.source,
          sourceTitle: g.title,
          sourcePageUrl: g.sourcePageUrl,
        }));
      }

      return [primaryVisualImg];
    }

    if (photos && photos.length > 0) {
      return photos.filter((p) => p && p.url && !p.url.startsWith('/assets/'));
    }
    const single = photo !== undefined ? photo : image;
    if (single && single.url && !single.url.startsWith('/assets/')) {
      return [single];
    }
    return [];
  }, [visual, photos, photo, image, alt]);

  const [candidateIndex, setCandidateIndex] = useState(0);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [allCandidatesFailed, setAllCandidatesFailed] = useState(false);

  // Reset candidate tracking when active place or visual candidate list changes
  const activePlaceKey = `${alt}_${visual?.url || ''}_${photo?.url || ''}_${candidates.length}`;
  const prevPlaceKeyRef = useRef(activePlaceKey);

  useEffect(() => {
    if (activePlaceKey !== prevPlaceKeyRef.current) {
      prevPlaceKeyRef.current = activePlaceKey;
      setCandidateIndex(0);
      setLoadedUrl(null);
      setAllCandidatesFailed(false);
    }
  }, [activePlaceKey]);

  const activeCandidate: PlaceImage | undefined = candidates[candidateIndex];

  // Preserve loaded state if active candidate URL is already successfully loaded in the browser
  const isBrowserLoaded = Boolean(activeCandidate && loadedUrl === activeCandidate.url);

  // Fallback timeout: if an active image candidate doesn't load within 4 seconds, advance to next
  useEffect(() => {
    if (!activeCandidate || isBrowserLoaded || allCandidatesFailed) return;

    const timer = setTimeout(() => {
      if (candidateIndex + 1 < candidates.length) {
        setCandidateIndex((prev) => prev + 1);
      } else {
        setAllCandidatesFailed(true);
      }
    }, 4000);

    return () => clearTimeout(timer);
  }, [activeCandidate?.url, candidateIndex, candidates.length, isBrowserLoaded, allCandidatesFailed]);

  const handleImageLoad = (candidateUrl?: string) => {
    const url = candidateUrl || activeCandidate?.url;
    if (url) {
      setLoadedUrl(url);
    }
    if (activeCandidate) {
      onCandidateSuccess?.(activeCandidate, candidateIndex);
    }
  };

  const handleImageError = () => {
    // Current candidate URL failed in the browser
    if (candidateIndex + 1 < candidates.length) {
      setCandidateIndex((prev) => prev + 1);
    } else {
      setAllCandidatesFailed(true);
    }
  };

  // Canonical state determination:
  // 1. Loaded: if candidate image tag has finished downloading in browser
  // 2. Unavailable: ONLY if all candidates failed OR photo lookup explicitly completed with 'unavailable' status
  // 3. Loading: ALWAYS default to loading animation while resolving or downloading
  const effectiveState: PhotoState = isBrowserLoaded
    ? 'loaded'
    : photoState === 'unavailable' || allCandidatesFailed
    ? 'unavailable'
    : 'loading';

  const activeAttribution =
    visual?.attribution ||
    activeCandidate?.attribution ||
    attribution ||
    activeCandidate?.author;

  const visualType = visual?.type || 'photo';

  return (
    <div
      id="place-hero-image-container"
      className={`relative w-full h-[150px] rounded-[18px] overflow-hidden bg-[#091322] border border-white/10 shadow-inner shrink-0 select-none ${className}`}
    >
      {/* 1. SKELETON / SHIMMER LOADING STATE (only displayed while browser is loading and not yet loaded) */}
      {effectiveState === 'loading' && (
        <div
          id="hero-skeleton-loading"
          className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#091424] via-[#0f213a] to-[#091424] animate-pulse z-10 select-none overflow-hidden"
        >
          <div className="w-10 h-10 rounded-full bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center mb-2 shadow-[0_0_15px_rgba(6,182,212,0.25)] relative">
            <Camera className="w-5 h-5 text-cyan-400 animate-pulse" />
          </div>
          <span className="text-[11.5px] font-medium tracking-wide text-cyan-200/90 drop-shadow">
            Loading photo...
          </span>
        </div>
      )}

      {/* Visual Badge indicator for Logo / Category Icon */}
      {isBrowserLoaded && visualType === 'logo' && (
        <div
          id="hero-logo-badge"
          className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/15 text-[10px] font-semibold text-slate-200 shadow-md"
        >
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>Brand Visual</span>
        </div>
      )}

      {isBrowserLoaded && visualType === 'icon' && (
        <div
          id="hero-icon-badge"
          className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/15 text-[10px] font-semibold text-slate-200 shadow-md"
        >
          <Tag className="w-3 h-3 text-cyan-400" />
          <span>Place Identity</span>
        </div>
      )}

      {/* 2. BROWSER LOADED IMAGE & ATTRIBUTION */}
      {activeCandidate && !allCandidatesFailed && (
        <>
          {visualType === 'logo' ? (
            /* BRAND LOGO TREATMENT: Centered in canvas with generous padding */
            <div className="w-full h-full flex items-center justify-center p-8 bg-gradient-to-b from-[#0b1728] to-[#060e1a]">
              <img
                key={activeCandidate.url}
                src={activeCandidate.url}
                alt={alt || activeCandidate.alt || 'Brand logo'}
                loading="eager"
                decoding="async"
                referrerPolicy="no-referrer"
                ref={(node) => {
                  if (node && node.complete && node.naturalWidth > 0 && loadedUrl !== activeCandidate.url) {
                    handleImageLoad(activeCandidate.url);
                  }
                }}
                onLoad={() => handleImageLoad(activeCandidate.url)}
                onError={handleImageError}
                className={`max-h-[75%] max-w-[75%] object-contain drop-shadow-xl transition-opacity duration-300 ${
                  isBrowserLoaded ? 'opacity-100' : 'opacity-0'
                }`}
              />
            </div>
          ) : visualType === 'icon' ? (
            /* ICON TREATMENT: SVG Canvas */
            <img
              key={activeCandidate.url}
              src={activeCandidate.url}
              alt={alt || activeCandidate.alt || 'Category icon'}
              loading="eager"
              decoding="async"
              referrerPolicy="no-referrer"
              ref={(node) => {
                if (node && node.complete && node.naturalWidth > 0 && loadedUrl !== activeCandidate.url) {
                  handleImageLoad(activeCandidate.url);
                }
              }}
              onLoad={() => handleImageLoad(activeCandidate.url)}
              onError={handleImageError}
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                isBrowserLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
          ) : (
            /* STANDARD PHOTOGRAPH TREATMENT */
            <img
              key={activeCandidate.url}
              src={activeCandidate.url}
              alt={alt || activeCandidate.alt || 'Place photograph'}
              loading="eager"
              decoding="async"
              referrerPolicy="no-referrer"
              ref={(node) => {
                if (node && node.complete && node.naturalWidth > 0 && loadedUrl !== activeCandidate.url) {
                  handleImageLoad(activeCandidate.url);
                }
              }}
              onLoad={() => handleImageLoad(activeCandidate.url)}
              onError={handleImageError}
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                isBrowserLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
          )}

          {/* Vignette Gradient Overlay - only visible once image has successfully loaded and for photos */}
          {isBrowserLoaded && visualType === 'photo' && (
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/85 via-black/20 to-black/35" />
          )}

          {/* Attribution Caption: ONLY shown once image has ACTUALLY loaded */}
          {isBrowserLoaded && activeAttribution && (
            <div
              id="hero-photo-attribution"
              className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-3 py-2 text-left pointer-events-auto"
              title={activeAttribution}
            >
              <p className="text-[10px] text-white/95 font-medium tracking-normal drop-shadow-md truncate">
                {activeAttribution}
              </p>
            </div>
          )}
        </>
      )}

      {/* 3. PHOTO UNAVAILABLE STATE (Honest fallback after all candidates fail) */}
      {effectiveState === 'unavailable' && (
        <div
          id="hero-photo-unavailable"
          className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-[#0e1929] to-[#07111e] p-4 text-center select-none"
        >
          <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/8 flex items-center justify-center mb-2">
            <ImageOff className="w-5 h-5 text-slate-500" />
          </div>
          <p className="text-xs font-semibold text-slate-300">
            Photo unavailable
          </p>
          <p className="text-[10.5px] text-slate-500 max-w-[210px] mt-0.5 line-clamp-1">
            {alt || 'No verified photograph available'}
          </p>
        </div>
      )}

      {/* Close button overlay */}
      {onClose && (
        <button
          id="hero-close-button"
          onClick={onClose}
          aria-label="Close details"
          className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/15 text-white/80 hover:text-white flex items-center justify-center transition-transform active:scale-90 cursor-pointer z-20 shadow-md"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
