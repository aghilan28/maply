import { NormalizedPlace, PlaceImage } from '../../types/place';

export interface PlaceImageProvider {
  name: string;
  getImages(place: NormalizedPlace, signal: AbortSignal): Promise<PlaceImage[]>;
}
