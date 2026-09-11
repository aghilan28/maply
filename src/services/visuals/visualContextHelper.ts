/**
 * Maply — Visual Context Helper
 * 
 * Maps NormalizedPlace and LocationItem into PlaceVisualContext
 * without altering canonical location data.
 */

import { NormalizedPlace } from '../../types/place';
import { LocationItem } from '../../types/location';
import { PlaceVisualContext } from '../../types/visual';

export function buildPlaceVisualContext(
  place: NormalizedPlace,
  savedLocation?: LocationItem | null
): PlaceVisualContext {
  return {
    locationId: savedLocation?.id || place.id,
    name: place.name || savedLocation?.name || 'Selected Location',
    latitude: place.latitude ?? savedLocation?.latitude ?? 0,
    longitude: place.longitude ?? savedLocation?.longitude ?? 0,
    address: place.address || savedLocation?.address,
    city: place.city || savedLocation?.cityRegion?.split(',')[0]?.trim(),
    region: place.region,
    country: place.country,
    category: place.category || savedLocation?.category,
    tags: savedLocation?.tags,
    mapboxPlaceId: place.mapboxId || place.providerId || savedLocation?.placeId,
    mapboxBrand: place.brand,
    mapboxBrandId: place.brandId,
    mapboxCategory: place.categories || place.poiCategory,
    maki: place.maki,
    featureType: place.featureType,
    website: place.website,
    phone: place.phone,
    rawProviderData: place.rawProviderData,
  };
}
