/**
 * Maply — Provider-Agnostic Place Visual Enrichment Model
 * 
 * Defines the visual-enrichment data structures separate from canonical Maply Location.
 * 
 * CRITICAL ARCHITECTURAL RULES:
 * 1. Visual enrichment is derived data only.
 * 2. Visual providers MUST NEVER modify canonical coordinates (lat, lng), ID, or place name.
 * 3. Priority order:
 *    Priority 1: Wikimedia (Primary provider, never replaced by secondary if suitable)
 *    Priority 2: Secondary photo provider (Foursquare, if configured and Wikimedia failed)
 *    Priority 3: Verified official/brand visual (if exact match exists)
 *    Priority 4: Mapbox place/category/maki icon metadata
 *    Priority 5: Photo unavailable state
 */

export type PlaceVisualType = 'photo' | 'logo' | 'icon';

export type PlaceVisualSource =
  | 'wikimedia'
  | 'foursquare'
  | 'mapbox'
  | 'official';

export interface PlaceVisual {
  url: string;
  thumbnailUrl?: string;
  type: PlaceVisualType;
  source: PlaceVisualSource;
  confidence: number;
  title?: string;
  attribution?: string;
  providerPlaceId?: string;
  sourcePageUrl?: string;
  width?: number;
  height?: number;
  author?: string;
  license?: string;
  brandName?: string;
  categoryIconName?: string;
  // Additional candidates if available (e.g. article gallery)
  gallery?: PlaceVisual[];
}

export interface PlaceVisualContext {
  locationId?: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  region?: string;
  country?: string;
  category?: string;
  tags?: string[];
  mapboxPlaceId?: string;
  mapboxBrand?: string;
  mapboxBrandId?: string;
  mapboxCategory?: string[];
  maki?: string;
  featureType?: string;
  website?: string;
  phone?: string;
  rawProviderData?: unknown;
}

export interface PlaceVisualProvider {
  readonly name: string;
  readonly priority: number;
  canHandle(context: PlaceVisualContext): boolean;
  resolveVisual(
    context: PlaceVisualContext,
    signal?: AbortSignal
  ): Promise<PlaceVisual | null>;
}
