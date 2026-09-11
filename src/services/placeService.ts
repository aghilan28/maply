import { Place, NearbyPlaceItem } from '../types/place';
import { SearchOptions, NearbyOptions } from './placeProvider';
import { MapboxPlaceProvider } from './mapboxPlaceProvider';

export class PlaceService {
  private mapboxProvider: MapboxPlaceProvider;
  private memoryCache = new Map<string, Place>();

  constructor() {
    this.mapboxProvider = new MapboxPlaceProvider();
  }

  getMapboxProvider(): MapboxPlaceProvider {
    return this.mapboxProvider;
  }

  /**
   * Search for places using Mapbox
   */
  async search(query: string, options?: SearchOptions): Promise<Place[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const mapboxResults = await this.mapboxProvider.search(trimmed, options);
    mapboxResults.forEach((p) => this.cachePlace(p));
    return mapboxResults;
  }

  /**
   * Reverse geocode a latitude & longitude using Mapbox
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<Place | null> {
    const cacheKey = `geo:${latitude.toFixed(5)}:${longitude.toFixed(5)}`;
    if (this.memoryCache.has(cacheKey)) {
      return this.memoryCache.get(cacheKey)!;
    }

    const place = await this.mapboxProvider.reverseGeocode(latitude, longitude);

    if (place) {
      this.memoryCache.set(cacheKey, place);
      this.cachePlace(place);
    }

    return place;
  }

  /**
   * Enrich and fetch complete place details using Mapbox
   */
  async getPlaceDetails(placeId: string, initialPlace?: Partial<Place>): Promise<Place | null> {
    const cacheKey = `place-details:${placeId}`;
    if (this.memoryCache.has(cacheKey)) {
      return this.memoryCache.get(cacheKey)!;
    }

    let enriched = await this.mapboxProvider.getPlaceDetails(placeId, initialPlace);

    if (!enriched && initialPlace && initialPlace.name && initialPlace.coordinates) {
      enriched = initialPlace as Place;
    }

    if (enriched) {
      this.memoryCache.set(cacheKey, enriched);
    }

    return enriched;
  }

  /**
   * Retrieve nearby places around coordinates using Mapbox
   */
  async getNearbyPlaces(
    latitude: number,
    longitude: number,
    options?: NearbyOptions
  ): Promise<NearbyPlaceItem[]> {
    const rawPlaces = await this.mapboxProvider.getNearbyPlaces(latitude, longitude, options);

    // Calculate distance and format
    return rawPlaces.map((place) => {
      const dist = this.calculateDistanceMeters(
        latitude,
        longitude,
        place.coordinates.latitude,
        place.coordinates.longitude
      );
      return {
        place,
        distanceMeters: dist,
        formattedDistance: this.formatDistance(dist),
      };
    });
  }

  private cachePlace(place: Place) {
    this.memoryCache.set(`place-details:${place.id}`, place);
    if (place.providerPlaceId) {
      this.memoryCache.set(`place-details:${place.provider}:${place.providerPlaceId}`, place);
    }
  }

  private calculateDistanceMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c);
  }

  private formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${meters} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
  }
}

export const placeService = new PlaceService();
