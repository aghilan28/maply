import { NormalizedPlace, PlaceImage } from '../../types/place';
import { mapboxPlacesProvider } from './mapboxPlacesProvider';
import { wikipediaProvider } from './wikipediaProvider';

export async function resolvePlaceImages(
  place: NormalizedPlace,
  signal: AbortSignal
): Promise<PlaceImage[]> {
  // 1. Try Mapbox Places API if it has a mapboxId and is a POI
  if (place.featureType === 'poi' && place.providerId) {
    try {
      const mapboxPhotos = await mapboxPlacesProvider.getImages(place, signal);
      if (mapboxPhotos.length > 0) {
        return mapboxPhotos;
      }
    } catch {
      // Continue to Wikipedia fallback
    }
  }

  // 2. Wikipedia MediaWiki resolution (geosearch + name search)
  return await wikipediaProvider.getImages(place, signal);
}

export * from './types';
export * from './mapboxPlacesProvider';
export * from './wikipediaProvider';
