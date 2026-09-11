import { Place } from '../types/place';

export interface SearchOptions {
  proximity?: {
    latitude: number;
    longitude: number;
  };
  types?: string[];
  limit?: number;
  language?: string;
}

export interface NearbyOptions {
  category?: string;
  radiusMeters?: number;
  limit?: number;
}

export interface PlaceProvider {
  readonly name: string;

  search(query: string, options?: SearchOptions): Promise<Place[]>;

  reverseGeocode(
    latitude: number,
    longitude: number
  ): Promise<Place | null>;

  getPlaceDetails(
    placeId: string,
    fallbackPlace?: Partial<Place>
  ): Promise<Place | null>;

  getNearbyPlaces(
    latitude: number,
    longitude: number,
    options?: NearbyOptions
  ): Promise<Place[]>;
}
