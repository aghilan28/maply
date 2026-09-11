/**
 * Maply — Foursquare Visual Provider (PRIORITY 2: SECONDARY PHOTO & VENUE PROVIDER)
 * 
 * Invoked when Wikimedia Commons does not produce a suitable photograph.
 * Utilizes Foursquare's Places API with server-side proxying (/api/foursquare)
 * and direct fallback to https://places-api.foursquare.com.
 * 
 * Enforces strict exact-place identity matching (name token similarity + coordinate distance check).
 * Rejects unrelated nearby venues.
 */

import { PlaceVisual, PlaceVisualContext, PlaceVisualProvider } from '../../../types/visual';
import {
  normalizePlaceName,
  normalizeTransliteration,
  calculateDistanceMeters,
} from '../../wikimediaImageService';
import { validateBrowserImage } from '../utils/imageValidator';

const FSQ_PLACES_API_BASE = 'https://places-api.foursquare.com/places';
const FSQ_API_VERSION = '2025-06-17';

export class FoursquareVisualProvider implements PlaceVisualProvider {
  readonly name = 'Foursquare';
  readonly priority = 2;

  private getClientApiKey(): string | null {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      if (import.meta.env.VITE_ENABLE_FOURSQUARE_VISUALS === 'false') {
        return null;
      }
      const key = import.meta.env.VITE_FOURSQUARE_API_KEY;
      if (key && typeof key === 'string' && key.trim().length > 0) {
        return key.trim();
      }
    }
    return null;
  }

  canHandle(context: PlaceVisualContext): boolean {
    if (!context.name || isNaN(context.latitude) || isNaN(context.longitude)) {
      return false;
    }
    return true;
  }

  async resolveVisual(
    context: PlaceVisualContext,
    signal?: AbortSignal
  ): Promise<PlaceVisual | null> {
    if (!this.canHandle(context)) {
      return null;
    }

    try {
      const cleanName = context.name.replace(/[,\-_–—/\\()\[\]|:]/g, ' ').trim();
      let results: any[] = [];

      // 1. First attempt: Server-side proxy (bypasses CORS, keeps keys hidden)
      try {
        const proxyUrl = new URL('/api/foursquare/search', window.location.origin);
        proxyUrl.searchParams.set('ll', `${context.latitude},${context.longitude}`);
        proxyUrl.searchParams.set('query', cleanName);
        proxyUrl.searchParams.set('radius', '700');
        proxyUrl.searchParams.set('limit', '5');

        const proxyRes = await fetch(proxyUrl.toString(), {
          headers: { Accept: 'application/json' },
          signal,
        });

        if (proxyRes.ok) {
          const proxyData = await proxyRes.json();
          if (Array.isArray(proxyData?.results)) {
            results = proxyData.results;
          } else if (Array.isArray(proxyData)) {
            results = proxyData;
          }
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return null;
      }

      // 2. Second attempt: Direct Places API fallback if client key configured
      const clientKey = this.getClientApiKey();
      if (results.length === 0 && clientKey) {
        try {
          const directUrl = new URL(`${FSQ_PLACES_API_BASE}/search`);
          directUrl.searchParams.set('ll', `${context.latitude},${context.longitude}`);
          directUrl.searchParams.set('query', cleanName);
          directUrl.searchParams.set('radius', '700');
          directUrl.searchParams.set('limit', '5');

          const directRes = await fetch(directUrl.toString(), {
            headers: {
              Authorization: `Bearer ${clientKey}`,
              'X-Places-Api-Version': FSQ_API_VERSION,
              Accept: 'application/json',
            },
            signal,
          });

          if (directRes.ok) {
            const directData = await directRes.json();
            if (Array.isArray(directData?.results)) {
              results = directData.results;
            } else if (Array.isArray(directData)) {
              results = directData;
            }
          }
        } catch (err: any) {
          if (err?.name === 'AbortError') return null;
        }
      }

      if (signal?.aborted || results.length === 0) {
        return null;
      }

      const normContext = normalizePlaceName(context.name);
      const translitContext = normalizeTransliteration(context.name);

      // Score and rank candidates by strict identity match
      for (const venue of results) {
        if (!venue || !venue.name) continue;

        const normVenue = normalizePlaceName(venue.name);
        const translitVenue = normalizeTransliteration(venue.name);

        // 1. Strict Name Similarity Check
        let nameSimilarity = 0;
        if (normVenue === normContext || translitVenue === translitContext) {
          nameSimilarity = 1.0;
        } else if (normVenue.includes(normContext) || normContext.includes(normVenue)) {
          nameSimilarity = 0.90;
        } else if (translitVenue.includes(translitContext) || translitContext.includes(translitVenue)) {
          nameSimilarity = 0.85;
        } else {
          // Token overlap
          const ctxTokens = normContext.split(' ').filter((t) => t.length > 2);
          const venTokens = normVenue.split(' ').filter((t) => t.length > 2);
          if (ctxTokens.length > 0 && venTokens.length > 0) {
            const matches = ctxTokens.filter((ct) =>
              venTokens.some((vt) => vt.includes(ct) || ct.includes(vt))
            );
            nameSimilarity = matches.length / ctxTokens.length;
          }
        }

        // STRICT IDENTITY: Reject if name does not strongly match
        if (nameSimilarity < 0.60) {
          continue;
        }

        // 2. Distance Verification
        let distanceMeters = venue.distance;
        const venueLat = venue.latitude || venue.location?.latitude;
        const venueLng = venue.longitude || venue.location?.longitude;
        if (typeof distanceMeters !== 'number' && venueLat && venueLng) {
          distanceMeters = calculateDistanceMeters(
            context.latitude,
            context.longitude,
            venueLat,
            venueLng
          );
        }

        if (typeof distanceMeters === 'number' && distanceMeters > 800) {
          continue; // Too far to be the same place
        }

        const placeId = venue.fsq_place_id || venue.fsq_id;

        // 3. Photo Resolution
        let photos = venue.photos || [];
        if (photos.length === 0 && placeId) {
          // A. Try proxy photo fetch
          try {
            const proxyPhotoRes = await fetch(
              `/api/foursquare/photos?id=${encodeURIComponent(placeId)}&limit=5`,
              { signal }
            );
            if (proxyPhotoRes.ok) {
              const photoData = await proxyPhotoRes.json();
              if (Array.isArray(photoData)) {
                photos = photoData;
              }
            }
          } catch {
            // Ignore error and fall through
          }

          // B. Direct photo fetch fallback if proxy failed and client key exists
          if (photos.length === 0 && clientKey) {
            try {
              const directPhotoRes = await fetch(
                `${FSQ_PLACES_API_BASE}/${encodeURIComponent(placeId)}/photos?limit=5`,
                {
                  headers: {
                    Authorization: `Bearer ${clientKey}`,
                    'X-Places-Api-Version': FSQ_API_VERSION,
                    Accept: 'application/json',
                  },
                  signal,
                }
              );
              if (directPhotoRes.ok) {
                const photoData = await directPhotoRes.json();
                if (Array.isArray(photoData)) {
                  photos = photoData;
                }
              }
            } catch {
              // Ignore error
            }
          }
        }

        // 4. Try candidate photos and validate browser renderability
        if (photos.length > 0) {
          for (const p of photos) {
            if (!p.prefix || !p.suffix) continue;
            const photoUrl = `${p.prefix}800x600${p.suffix}`;
            const thumbUrl = `${p.prefix}400x300${p.suffix}`;

            const isLoaded = await validateBrowserImage(photoUrl, { signal, timeoutMs: 5000 });
            if (isLoaded) {
              const confidence = Math.min(
                0.95,
                nameSimilarity * 0.85 + (distanceMeters && distanceMeters < 200 ? 0.10 : 0)
              );

              return {
                url: photoUrl,
                thumbnailUrl: thumbUrl,
                type: 'photo',
                source: 'foursquare',
                confidence,
                title: venue.name,
                attribution: 'Photo via Foursquare',
                providerPlaceId: placeId,
                sourcePageUrl: venue.placemaker_url || (placeId ? `https://foursquare.com/v/${placeId}` : undefined),
                width: p.width || 800,
                height: p.height || 600,
              };
            }
          }
        }

        // 5. If photos unavailable, check if venue has verified category icon
        if (Array.isArray(venue.categories) && venue.categories.length > 0) {
          const primaryCat = venue.categories[0];
          if (primaryCat?.icon?.prefix && primaryCat?.icon?.suffix) {
            const iconUrl = `${primaryCat.icon.prefix}bg_88${primaryCat.icon.suffix}`;
            const isLoaded = await validateBrowserImage(iconUrl, { signal, timeoutMs: 3000 });
            if (isLoaded) {
              return {
                url: iconUrl,
                thumbnailUrl: iconUrl,
                type: 'icon',
                source: 'foursquare',
                confidence: 0.85,
                title: venue.name,
                attribution: `Foursquare Verified (${primaryCat.name || 'Venue'})`,
                providerPlaceId: placeId,
                sourcePageUrl: venue.placemaker_url || (placeId ? `https://foursquare.com/v/${placeId}` : undefined),
                width: 88,
                height: 88,
              };
            }
          }
        }
      }

      return null;
    } catch (err: any) {
      if (err?.name === 'AbortError') return null;
      return null;
    }
  }
}

export const foursquareVisualProvider = new FoursquareVisualProvider();
