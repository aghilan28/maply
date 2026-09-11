import { Place, SavedLocation, PlaceCoordinates, DiscoveredPlace, discoveredPlaceToPlace, FeatureType } from './place';

export * from './place';

export type LocationCategory = 
  | 'All'
  | 'Travel'
  | 'Work'
  | 'Home'
  | 'Food'
  | 'Nature'
  | 'History'
  | 'Shopping'
  | 'Other';

export interface LocationItem {
  id: string;
  placeId?: string;
  providerId?: string;
  featureType?: FeatureType;
  name: string;
  address: string;
  cityRegion: string;
  lat: number;
  lng: number;
  latitude?: number;
  longitude?: number;
  category: string;
  imageUrl?: string;
  imageAlt?: string;
  imageCredit?: string;
  createdAt: string;
  updatedAt?: string;
  tags: string[];
  notes?: string;
  isFavorite?: boolean;
  placeSnapshot?: Place;
}

export type Location = LocationItem;

export type MapStyleType = 'satellite' | 'standard' | 'satellite-streets' | 'dark' | 'terrain';

export type ActiveTab = 'overview' | 'about' | 'photos' | 'reviews' | 'nearby';

export type SortOption = 'recent' | 'updated' | 'name-asc' | 'name-desc';

export function discoveredPlaceToLocationItem(
  dp: DiscoveredPlace,
  category?: string,
  notes = '',
  tags: string[] = []
): LocationItem {
  const cityRegion =
    [dp.city, dp.region || dp.country].filter(Boolean).join(', ') ||
    dp.address?.split(',').slice(-2).join(', ').trim() ||
    'Worldwide';
  const now = new Date();
  const dateFormatted = now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return {
    id: dp.id || `loc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    placeId: dp.mapboxId || dp.providerId,
    providerId: dp.providerId || dp.mapboxId,
    featureType: dp.featureType || 'poi',
    name: dp.name,
    address: dp.address || `${dp.latitude.toFixed(4)}, ${dp.longitude.toFixed(4)}`,
    cityRegion,
    lat: dp.latitude,
    lng: dp.longitude,
    latitude: dp.latitude,
    longitude: dp.longitude,
    category: category || dp.category || 'Landmark',
    imageUrl: dp.photos?.[0]?.url || '',
    imageAlt: dp.name,
    imageCredit: dp.photos?.[0]?.attribution,
    createdAt: dateFormatted,
    updatedAt: dateFormatted,
    tags: tags.length > 0 ? tags : [dp.category?.toLowerCase() || 'landmark', 'travel'],
    notes,
    isFavorite: false,
    placeSnapshot: discoveredPlaceToPlace(dp),
  };
}

export function placeToLocationItem(place: Place, category = 'Travel', notes = '', tags: string[] = []): LocationItem {
  const city = place.address?.city || place.address?.district || place.address?.state || '';
  const stateOrCountry = place.address?.state || place.address?.country || '';
  const cityRegion = [city, stateOrCountry].filter(Boolean).join(', ') || place.formattedAddress?.split(',').slice(-2).join(', ').trim() || 'Location';

  const defaultPhoto = place.photos?.[0]?.url || '';
  const imageAlt = place.name;
  const imageCredit = place.photos?.[0]?.attribution;

  const now = new Date();
  const dateFormatted = now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return {
    id: `loc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    placeId: place.id,
    name: place.name,
    address: place.formattedAddress || `${place.coordinates.latitude.toFixed(4)}, ${place.coordinates.longitude.toFixed(4)}`,
    cityRegion,
    lat: place.coordinates.latitude,
    lng: place.coordinates.longitude,
    category: place.category || category,
    imageUrl: defaultPhoto,
    imageAlt,
    imageCredit,
    createdAt: dateFormatted,
    updatedAt: dateFormatted,
    tags,
    notes: notes || place.description || '',
    isFavorite: false,
    placeSnapshot: place,
  };
}

export function locationItemToPlace(item: LocationItem): Place {
  const photoList = item.imageUrl
    ? [{ url: item.imageUrl, attribution: item.imageCredit }]
    : undefined;

  if (item.placeSnapshot) {
    return {
      ...item.placeSnapshot,
      name: item.name,
      category: item.category,
      coordinates: { latitude: item.lat, longitude: item.lng },
      photos: photoList || item.placeSnapshot.photos,
      mapboxFeatureType: item.featureType || item.placeSnapshot.mapboxFeatureType || 'poi',
    };
  }

  return {
    id: item.placeId || item.id,
    provider: 'mapbox',
    name: item.name,
    coordinates: { latitude: item.lat, longitude: item.lng },
    formattedAddress: item.address,
    category: item.category,
    description: item.notes,
    photos: photoList,
    mapboxFeatureType: item.featureType || 'poi',
  };
}

