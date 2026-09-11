import { NormalizedPlace, Place, PlacePhoto } from '../types/place';
import { resolvePlaceImages } from './placeImages/resolvePlaceImages';

export interface PlaceImageProvider {
  getImages(place: NormalizedPlace, signal?: AbortSignal): Promise<PlacePhoto[]>;
}

export class PlaceImageService {
  private cache = new Map<string, PlacePhoto[]>();

  private getCacheKey(place: NormalizedPlace): string {
    return (
      place.providerId ||
      place.mapboxId ||
      `${place.latitude.toFixed(4)}_${place.longitude.toFixed(4)}_${place.name}`
    ).toLowerCase();
  }

  getCachedPhotos(place: NormalizedPlace): PlacePhoto[] | null {
    const key = this.getCacheKey(place);
    return this.cache.get(key) || null;
  }

  async resolvePlacePhotos(
    place: NormalizedPlace,
    signal?: AbortSignal
  ): Promise<PlacePhoto[]> {
    if (!place) return [];

    if (place.photos && place.photos.length > 0) {
      return place.photos;
    }

    const key = this.getCacheKey(place);
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }

    const controller = signal ? null : new AbortController();
    const activeSignal = signal || controller!.signal;

    try {
      const photos = await resolvePlaceImages(place, activeSignal);
      if (!activeSignal.aborted) {
        this.cache.set(key, photos);
        return photos;
      }
      return [];
    } catch (err) {
      if (activeSignal.aborted) return [];
      console.warn('PlaceImageService: error resolving photos:', err);
      return [];
    }
  }

  async resolvePlaceImage(
    place: NormalizedPlace,
    signal?: AbortSignal
  ): Promise<PlacePhoto | null> {
    const photos = await this.resolvePlacePhotos(place, signal);
    return photos.length > 0 ? photos[0] : null;
  }

  async getPlaceImages(place: NormalizedPlace | Place, signal?: AbortSignal): Promise<PlacePhoto[]> {
    if (!place) return [];
    const np: NormalizedPlace =
      'latitude' in place
        ? place
        : {
            providerId: place.providerPlaceId || place.id,
            mapboxId: place.providerPlaceId || place.id,
            featureType: (place.mapboxFeatureType as any) || 'poi',
            name: place.name,
            latitude: place.coordinates.latitude,
            longitude: place.coordinates.longitude,
            photos: place.photos,
            source: 'mapbox',
          };
    return this.resolvePlacePhotos(np, signal);
  }

  getCachedImages(place: NormalizedPlace | Place): PlacePhoto[] | null {
    if (!place) return null;
    const np: NormalizedPlace =
      'latitude' in place
        ? place
        : {
            providerId: place.providerPlaceId || place.id,
            mapboxId: place.providerPlaceId || place.id,
            featureType: (place.mapboxFeatureType as any) || 'poi',
            name: place.name,
            latitude: place.coordinates.latitude,
            longitude: place.coordinates.longitude,
            photos: place.photos,
            source: 'mapbox',
          };
    return this.getCachedPhotos(np);
  }
}

export const placeImageService = new PlaceImageService();
