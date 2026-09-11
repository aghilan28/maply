import { DiscoveredPlace } from '../types/place';
import { normalizeMapboxFeature } from './normalizeMapboxFeature';

export interface MapboxSearchSuggestion {
  mapbox_id: string;
  name: string;
  full_address?: string;
  place_formatted?: string;
  feature_type?: string;
  maki?: string;
  distance?: number;
}

export class MapboxPlaceService {
  private token: string;
  private currentSessionToken: string | null = null;
  private detailsCache = new Map<string, DiscoveredPlace>();

  constructor(token?: string) {
    this.token = token || (import.meta.env.VITE_MAPBOX_TOKEN as string) || '';
  }

  setToken(token: string) {
    this.token = token;
  }

  /**
   * Generates a standard UUID v4 session token for Search Box suggest & retrieve pairing
   */
  generateSessionToken(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      this.currentSessionToken = crypto.randomUUID();
    } else {
      this.currentSessionToken = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    }
    return this.currentSessionToken;
  }

  getActiveSessionToken(): string {
    if (!this.currentSessionToken) {
      return this.generateSessionToken();
    }
    return this.currentSessionToken;
  }

  clearSessionToken() {
    this.currentSessionToken = null;
  }

  /**
   * GET https://api.mapbox.com/search/searchbox/v1/retrieve/{mapbox_id}
   * with attribute_sets=photos,venue,visit
   */
  async getPlaceDetails(
    mapboxId: string,
    sessionToken?: string
  ): Promise<DiscoveredPlace | null> {
    if (!mapboxId) return null;

    const cacheKey = `details:${mapboxId}`;
    if (this.detailsCache.has(cacheKey)) {
      return this.detailsCache.get(cacheKey)!;
    }

    if (!this.token) {
      console.warn('Mapbox token not available for getPlaceDetails');
      return null;
    }

    try {
      const activeSession = sessionToken || this.getActiveSessionToken();
      const url = `https://api.mapbox.com/search/searchbox/v1/retrieve/${encodeURIComponent(
        mapboxId
      )}?attribute_sets=photos,venue,visit&access_token=${this.token}&session_token=${encodeURIComponent(
        activeSession
      )}`;

      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`Mapbox retrieve returned ${res.status} for ${mapboxId}`);
        return null;
      }

      const data = await res.json();
      const feature = data.features?.[0];
      if (!feature) return null;

      const normalized = this.normalizeMapboxFeature(feature);
      if (normalized) {
        this.detailsCache.set(cacheKey, normalized);
      }
      return normalized;
    } catch (err) {
      console.error('Failed to get Mapbox place details:', err);
      return null;
    }
  }

  /**
   * Search places with Mapbox Search Box suggest endpoint
   */
  async searchSuggestions(
    query: string,
    sessionToken: string,
    options?: {
      proximity?: { latitude: number; longitude: number };
      limit?: number;
      types?: string[];
    }
  ): Promise<MapboxSearchSuggestion[]> {
    const trimmed = query.trim();
    if (!trimmed || !this.token) return [];

    try {
      let url = `https://api.mapbox.com/search/searchbox/v1/suggest?q=${encodeURIComponent(
        trimmed
      )}&access_token=${this.token}&session_token=${encodeURIComponent(sessionToken)}&limit=${
        options?.limit || 7
      }`;

      if (options?.proximity) {
        url += `&proximity=${options.proximity.longitude},${options.proximity.latitude}`;
      }
      if (options?.types && options.types.length > 0) {
        url += `&types=${options.types.join(',')}`;
      }

      const res = await fetch(url);
      if (!res.ok) return [];

      const data = await res.json();
      return (data.suggestions || []).map((s: any) => ({
        mapbox_id: s.mapbox_id,
        name: s.name,
        full_address: s.full_address || s.place_formatted,
        place_formatted: s.place_formatted,
        feature_type: s.feature_type,
        maki: s.maki,
        distance: s.distance,
      }));
    } catch (err) {
      console.warn('Mapbox suggest search failed:', err);
      return [];
    }
  }

  /**
   * Full search places, converting suggestions to initial DiscoveredPlace objects
   */
  async searchPlaces(
    query: string,
    options?: {
      proximity?: { latitude: number; longitude: number };
      sessionToken?: string;
      limit?: number;
    }
  ): Promise<DiscoveredPlace[]> {
    const trimmed = query.trim();
    if (!trimmed || !this.token) return [];

    const session = options?.sessionToken || this.getActiveSessionToken();
    const suggestions = await this.searchSuggestions(trimmed, session, options);

    // Convert top suggestions to DiscoveredPlace using normalizeMapboxFeature
    return suggestions.map((s) =>
      normalizeMapboxFeature(
        {
          ...s,
          latitude: options?.proximity?.latitude || 0,
          longitude: options?.proximity?.longitude || 0,
          address: s.full_address,
        },
        'mapbox-search'
      )
    );
  }

  /**
   * Reverse lookup coordinates with Mapbox Search Box reverse endpoint
   * Used exclusively when clicking plain streets or addresses (never for POIs)
   * GET https://api.mapbox.com/search/searchbox/v1/reverse
   */
  async reverseLookup(
    longitude: number,
    latitude: number
  ): Promise<DiscoveredPlace | null> {
    if (!this.token) return null;

    try {
      // Step 4: Address/street only — never attempt to snap to distant POIs for empty map clicks
      const url = `https://api.mapbox.com/search/searchbox/v1/reverse?longitude=${longitude}&latitude=${latitude}&access_token=${this.token}&types=address,street&limit=1`;
      const res = await fetch(url);
      if (!res.ok) return null;

      const data = await res.json();
      const feature = data.features?.[0];
      if (!feature) return null;

      // Normalize the reverse geocode result directly as address/street
      const normalized = this.normalizeMapboxFeature(feature);
      if (normalized) {
        normalized.featureType = normalized.featureType === 'street' ? 'street' : 'address';
      }
      return normalized;
    } catch (err) {
      console.warn('Mapbox reverse lookup failed:', err);
      return null;
    }
  }

  /**
   * Normalizes a Mapbox Search Box feature into the requested DiscoveredPlace model
   */
  private normalizeMapboxFeature(feature: any): DiscoveredPlace {
    return normalizeMapboxFeature(feature, 'mapbox-search');
  }
}

export const mapboxPlaceService = new MapboxPlaceService();
