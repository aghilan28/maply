import { FeatureType, NormalizedPlace } from '../types/place';
import { LocationItem } from '../types/location';

/**
 * Maps raw Mapbox feature type / class / layer to one of the 5 canonical types:
 * 'poi' | 'address' | 'street' | 'place' | 'other'
 */
export function mapToCanonicalFeatureType(
  rawFeatureType?: string,
  layerId?: string,
  makiOrClass?: string,
  categories?: string[]
): FeatureType {
  const ft = (rawFeatureType || '').toLowerCase();
  const lyr = (layerId || '').toLowerCase();
  const cls = (makiOrClass || '').toLowerCase();
  const cats = (categories || []).map((c) => c.toLowerCase());

  // 1. POI checks
  if (
    ft === 'poi' ||
    ft === 'point_of_interest' ||
    lyr.includes('poi') ||
    cls.includes('poi') ||
    cats.some((c) => c.includes('poi') || c.includes('restaurant') || c.includes('hotel') || c.includes('attraction'))
  ) {
    return 'poi';
  }

  // Common POI classes & maki icons
  const commonPoiClasses = [
    'restaurant', 'cafe', 'bar', 'hotel', 'lodging', 'museum', 'park',
    'monument', 'landmark', 'hospital', 'pharmacy', 'school', 'university',
    'bank', 'atm', 'shop', 'store', 'mall', 'supermarket', 'gym', 'cinema',
    'theatre', 'beach', 'zoo', 'airport', 'station', 'transit', 'church',
    'temple', 'mosque', 'fuel', 'gas_station', 'bakery', 'fast_food', 'pub'
  ];
  if (commonPoiClasses.some((c) => cls.includes(c) || cats.some((cat) => cat.includes(c)))) {
    return 'poi';
  }

  // 2. Address checks
  if (ft === 'address' || ft === 'postcode' || lyr.includes('address')) {
    return 'address';
  }

  // 3. Street checks
  if (ft === 'street' || ft === 'road' || lyr.includes('road') || lyr.includes('street') || cls === 'street') {
    return 'street';
  }

  // 4. Place / locality checks
  if (
    ft === 'place' ||
    ft === 'locality' ||
    ft === 'neighborhood' ||
    ft === 'district' ||
    ft === 'region' ||
    ft === 'country' ||
    lyr.includes('place') ||
    cls === 'place' ||
    cls === 'city' ||
    cls === 'town' ||
    cls === 'village'
  ) {
    return 'place';
  }

  return 'other';
}

/**
 * Unified feature normalizer:
 * Both Search Box selections and Mapbox GL POI clicks converge on this single function.
 */
export function normalizeMapboxFeature(feature: any, source = 'mapbox'): NormalizedPlace {
  const p = feature.properties || feature;
  const geometry = feature.geometry;

  let lat = 0;
  let lng = 0;

  // 1. Prioritize explicit WGS84 coordinates passed on feature or properties
  if (typeof feature.latitude === 'number' && typeof feature.longitude === 'number') {
    lat = feature.latitude;
    lng = feature.longitude;
  } else if (typeof p.latitude === 'number' && typeof p.longitude === 'number') {
    lat = p.latitude;
    lng = p.longitude;
  } else if (typeof feature.lat === 'number' && typeof feature.lng === 'number') {
    lat = feature.lat;
    lng = feature.lng;
  } else if (typeof p.lat === 'number' && typeof p.lng === 'number') {
    lat = p.lat;
    lng = p.lng;
  } else if (p.coordinates) {
    const rawLat = typeof p.coordinates.latitude === 'number' ? p.coordinates.latitude : p.coordinates[1];
    const rawLng = typeof p.coordinates.longitude === 'number' ? p.coordinates.longitude : p.coordinates[0];
    if (typeof rawLat === 'number' && typeof rawLng === 'number' && Math.abs(rawLat) <= 90 && Math.abs(rawLng) <= 180) {
      lat = rawLat;
      lng = rawLng;
    }
  } else if (
    geometry?.type === 'Point' &&
    Array.isArray(geometry.coordinates) &&
    typeof geometry.coordinates[0] === 'number' &&
    typeof geometry.coordinates[1] === 'number'
  ) {
    const geomLng = geometry.coordinates[0];
    const geomLat = geometry.coordinates[1];
    // Vector tiles use tile units (e.g. 0-4096). Only accept if valid WGS84 geographic coordinates!
    if (Math.abs(geomLng) <= 180 && Math.abs(geomLat) <= 90) {
      lng = geomLng;
      lat = geomLat;
    }
  }

  const name =
    p.name ||
    p.name_en ||
    p['name:latin'] ||
    p.name_preferred ||
    p.place_name?.split(',')[0] ||
    'Selected Location';

  const rawFeatureType = p.feature_type || p.featureType || p.type;
  const layerId = feature.layer?.id;
  const makiOrClass = p.class || p.maki || p.category;
  const categoriesList = Array.isArray(p.poi_category)
    ? p.poi_category
    : Array.isArray(p.categories)
    ? p.categories
    : p.category
    ? [p.category]
    : [];

  const featureType = mapToCanonicalFeatureType(rawFeatureType, layerId, makiOrClass, categoriesList);

  const address =
    p.full_address ||
    p.place_formatted ||
    p.address ||
    p.place_name ||
    (lat && lng ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : undefined);

  const city =
    p.context?.place?.name ||
    p.context?.locality?.name ||
    p.city ||
    p.address?.city;

  const region =
    p.context?.region?.name ||
    p.region ||
    p.address?.state;

  const country =
    p.context?.country?.name ||
    p.country ||
    p.address?.country;

  const mapboxId = p.mapbox_id || (typeof feature.id === 'string' ? feature.id : undefined);

  const brand = p.brand || p.brand_name || p.context?.brand?.name;
  const brandId = p.brand_id || p.context?.brand?.id;
  const maki = p.maki || p.maki_icon || (typeof makiOrClass === 'string' ? makiOrClass : undefined);

  return {
    id: p.id,
    providerId: mapboxId,
    mapboxId,
    featureType,
    name: String(name),
    latitude: lat,
    longitude: lng,
    address: address ? String(address) : undefined,
    city: city ? String(city) : undefined,
    region: region ? String(region) : undefined,
    country: country ? String(country) : undefined,
    category: categoriesList[0] || (featureType === 'poi' ? 'Point of Interest' : 'Location'),
    categories: categoriesList,
    brand: brand ? String(brand) : undefined,
    brandId: brandId ? String(brandId) : undefined,
    maki: maki ? String(maki) : undefined,
    poiCategory: categoriesList,
    website: p.website,
    phone: p.phone,
    source,
    rawProviderData: p,
  };
}

/**
 * Normalizes a saved location into a NormalizedPlace for display and photo resolution.
 */
export function normalizeSavedLocation(location: LocationItem): NormalizedPlace {
  return {
    id: location.id,
    providerId: location.providerId || location.placeId,
    mapboxId: location.providerId || location.placeId,
    featureType: location.featureType || 'poi',
    name: location.name,
    latitude: location.latitude ?? location.lat,
    longitude: location.longitude ?? location.lng,
    address: location.address,
    city: location.cityRegion?.split(',')[0]?.trim(),
    category: location.category,
    photos: location.imageUrl
      ? [
          {
            url: location.imageUrl,
            attribution: location.imageCredit,
            alt: location.imageAlt || location.name,
          },
        ]
      : undefined,
    source: 'saved-location',
    rawProviderData: location,
  };
}
