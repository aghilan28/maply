import { NormalizedPlace, PlaceImage } from '../../types/place';
import { PlaceImageProvider } from './types';

export class MapboxPlacesProvider implements PlaceImageProvider {
  name = 'mapbox';
  private sessionCache = new Map<string, PlaceImage[] | null>();

  private getToken(): string {
    return (import.meta.env.VITE_MAPBOX_TOKEN as string) || '';
  }

  async getImages(place: NormalizedPlace, signal: AbortSignal): Promise<PlaceImage[]> {
    // Only applies when place.featureType === 'poi' and place.providerId (the Mapbox mapbox_id) is present.
    // Addresses/streets/places must skip this provider entirely.
    if (place.featureType !== 'poi') {
      return [];
    }

    const mapboxId = place.providerId || place.mapboxId;
    if (!mapboxId) {
      return [];
    }

    // Check in-memory session cache
    if (this.sessionCache.has(mapboxId)) {
      const cached = this.sessionCache.get(mapboxId);
      return cached ? [...cached] : [];
    }

    const token = this.getToken();
    if (!token) {
      return [];
    }

    // Check if signal is already aborted
    if (signal.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    try {
      // 1. Call Mapbox Places API Details endpoint
      const placesUrl = `https://api.mapbox.com/places/v1/details/retrieve/${encodeURIComponent(
        mapboxId
      )}?access_token=${token}`;

      const res = await fetch(placesUrl, { signal });

      if (res.status === 429) {
        console.warn(`[MapboxPlacesProvider] Quota/Rate-limit (429) for ${mapboxId}`);
        this.sessionCache.set(mapboxId, []);
        return [];
      }

      let rawPhotos: any[] = [];

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.photos)) {
          rawPhotos = data.photos;
        } else if (Array.isArray(data.attributes?.photos)) {
          rawPhotos = data.attributes.photos;
        } else if (Array.isArray(data.attributes?.venue?.photos)) {
          rawPhotos = data.attributes.venue.photos;
        }
      }

      // If no photos from Places Details endpoint, check Search Box retrieve endpoint with attribute_sets=photos
      if (rawPhotos.length === 0 && !signal.aborted) {
        try {
          const sbUrl = `https://api.mapbox.com/search/searchbox/v1/retrieve/${encodeURIComponent(
            mapboxId
          )}?attribute_sets=photos,venue,visit&access_token=${token}`;
          const sbRes = await fetch(sbUrl, { signal });
          if (sbRes.ok) {
            const sbData = await sbRes.json();
            const feat = sbData.features?.[0];
            const meta = feat?.properties?.metadata;
            if (Array.isArray(meta?.photos)) {
              rawPhotos = meta.photos;
            } else if (Array.isArray(feat?.properties?.photos)) {
              rawPhotos = feat.properties.photos;
            } else if (meta?.primary_photo?.url) {
              rawPhotos = [meta.primary_photo];
            }
          }
        } catch {
          // Ignore secondary fallback errors
        }
      }

      if (rawPhotos.length === 0) {
        this.sessionCache.set(mapboxId, []);
        return [];
      }

      const images: PlaceImage[] = [];
      for (const p of rawPhotos) {
        const url = typeof p === 'string' ? p : p?.url || p?.href;
        if (url) {
          images.push({
            url,
            width: typeof p?.width === 'number' ? p.width : undefined,
            height: typeof p?.height === 'number' ? p.height : undefined,
            alt: place.name,
            source: 'mapbox',
          });
        }
      }

      this.sessionCache.set(mapboxId, images);
      return images;
    } catch (err: any) {
      if (err?.name === 'AbortError' || signal.aborted) {
        throw err;
      }
      console.warn('[MapboxPlacesProvider] Error fetching place photos:', err);
      this.sessionCache.set(mapboxId, []);
      return [];
    }
  }
}

export const mapboxPlacesProvider = new MapboxPlacesProvider();
