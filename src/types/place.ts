export type PlaceProviderType = 'mapbox' | 'nominatim';

export interface PlaceCoordinates {
  latitude: number;
  longitude: number;
}

export interface PlaceAddress {
  houseNumber?: string;
  street?: string;
  neighborhood?: string;
  locality?: string;
  district?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  countryCode?: string;
}

export type PlaceImage = {
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  alt?: string;
  attribution?: string; // always required for Wikipedia-sourced images
  source?: 'wikipedia' | string;
  sourcePageUrl?: string;
  sourceTitle?: string;
  author?: string;
  license?: string;
  credit?: string;
};

export type PlacePhoto = PlaceImage;

export type FeatureType = 'poi' | 'address' | 'street' | 'place' | 'other';

export type NormalizedPlace = {
  id?: string;                 // Maply's own saved-location id, if this is a saved location
  providerId?: string;         // Mapbox mapbox_id, when the place came from Mapbox
  mapboxId?: string;           // Alias for Mapbox mapbox_id
  featureType?: FeatureType;
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  region?: string;
  country?: string;
  category?: string;
  categories?: string[];
  brand?: string;
  brandId?: string;
  maki?: string;
  poiCategory?: string[];
  website?: string;
  phone?: string;
  rating?: number;
  photos?: PlaceImage[];
  description?: string;
  notes?: string;
  source: string;               // 'mapbox-search' | 'mapbox-poi-click' | 'saved-location'
  rawProviderData?: unknown;
};

export type DiscoveredPlace = NormalizedPlace;

export interface PlaceReview {
  authorName?: string;
  authorPhoto?: string;
  rating?: number;
  text?: string;
  relativeTime?: string;
}

export interface PlaceOpeningHours {
  openNow?: boolean;
  weekdayDescriptions?: string[];
}

export interface PlaceViewport {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface Place {
  id: string;
  provider: PlaceProviderType;
  providerPlaceId?: string;

  name: string;

  coordinates: PlaceCoordinates;

  formattedAddress?: string;
  address?: PlaceAddress;

  category?: string;
  categories?: string[];

  description?: string;

  phoneNumber?: string;
  website?: string;

  rating?: number;
  ratingCount?: number;

  priceLevel?: string;

  openingHours?: PlaceOpeningHours;

  photos?: PlacePhoto[];

  reviews?: PlaceReview[];

  viewport?: PlaceViewport;

  mapboxFeatureType?: string;

  sourceMetadata?: unknown;
}

export function discoveredPlaceToPlace(dp: NormalizedPlace): Place {
  return {
    id: dp.id || dp.providerId || dp.mapboxId || `place:${dp.latitude.toFixed(5)}_${dp.longitude.toFixed(5)}`,
    provider: 'mapbox',
    providerPlaceId: dp.providerId || dp.mapboxId,
    name: dp.name,
    coordinates: {
      latitude: dp.latitude,
      longitude: dp.longitude,
    },
    formattedAddress: dp.address,
    category: dp.category || 'Travel',
    categories: dp.categories || (dp.category ? [dp.category] : undefined),
    photos: dp.photos,
    rating: dp.rating,
    phoneNumber: dp.phone,
    website: dp.website,
    mapboxFeatureType: dp.featureType,
    sourceMetadata: {
      source: dp.source,
      raw: dp.rawProviderData,
    },
  };
}

export interface SavedLocation {
  id: string;
  placeId?: string;
  providerId?: string;
  featureType?: FeatureType;
  name: string;
  coordinates: PlaceCoordinates;
  category: string;
  tags: string[];
  notes?: string;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
  placeSnapshot?: Place;
}

export interface NearbyPlaceItem {
  place: Place;
  distanceMeters?: number;
  formattedDistance?: string;
}
