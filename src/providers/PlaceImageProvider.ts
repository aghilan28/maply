import { Place, PlaceImage } from '../types/place';

export interface PlaceImageProvider {
  readonly name: string;
  searchImages(place: Place, signal?: AbortSignal): Promise<PlaceImage[]>;
}
