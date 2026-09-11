/**
 * Maply — Wikimedia Visual Provider (PRIORITY 1: PRIMARY)
 * 
 * High-confidence Wikimedia / Wikipedia / Commons photograph resolution.
 * This is the PRIMARY source in Maply and is always attempted first.
 * Secondary providers NEVER replace a suitable, valid Wikimedia result.
 */

import { PlaceVisual, PlaceVisualContext, PlaceVisualProvider } from '../../../types/visual';
import {
  wikimediaImageService,
  CanonicalLocation,
  PlaceImage,
} from '../../wikimediaImageService';

export class WikimediaVisualProvider implements PlaceVisualProvider {
  readonly name = 'Wikimedia';
  readonly priority = 1;

  canHandle(context: PlaceVisualContext): boolean {
    return Boolean(context && context.name && context.name.trim().length > 0);
  }

  async resolveVisual(
    context: PlaceVisualContext,
    signal?: AbortSignal
  ): Promise<PlaceVisual | null> {
    return this.resolveVisualProgressive(context, undefined, signal);
  }

  /**
   * Progressive resolution with fast path callback.
   */
  async resolveVisualProgressive(
    context: PlaceVisualContext,
    onProgressiveVisual?: (visual: PlaceVisual) => void,
    signal?: AbortSignal
  ): Promise<PlaceVisual | null> {
    if (!this.canHandle(context)) return null;

    const canonicalLoc: CanonicalLocation = {
      id: context.locationId || `${context.latitude}_${context.longitude}`,
      name: context.name,
      latitude: context.latitude,
      longitude: context.longitude,
      address: context.address,
      city: context.city,
      region: context.region,
      country: context.country,
      category: context.category,
      mapboxId: context.mapboxPlaceId,
    };

    try {
      const result = await wikimediaImageService.resolveImagesProgressive(
        canonicalLoc,
        (fastCandidate, fastTitle) => {
          if (signal?.aborted) return;
          if (onProgressiveVisual && fastCandidate?.url) {
            onProgressiveVisual({
              url: fastCandidate.url,
              thumbnailUrl: fastCandidate.thumbnailUrl || fastCandidate.url,
              type: 'photo',
              source: 'wikimedia',
              confidence: 0.95,
              title: fastTitle || fastCandidate.sourceTitle,
              attribution: fastCandidate.attribution || `Photo via Wikipedia — "${fastTitle || fastCandidate.sourceTitle || 'Verified'}"`,
              sourcePageUrl: fastCandidate.sourcePageUrl,
            });
          }
        },
        signal
      );

      if (signal?.aborted || !result || result.images.length === 0 || result.confidence < 0.65) {
        return null;
      }

      const topCandidate = result.images[0];
      if (!topCandidate || !topCandidate.url) {
        return null;
      }

      const gallery: PlaceVisual[] = result.images.map((img: PlaceImage) => ({
        url: img.url,
        thumbnailUrl: img.thumbnailUrl || img.url,
        type: 'photo' as const,
        source: 'wikimedia' as const,
        confidence: result.confidence,
        title: img.sourceTitle || result.matchedPageTitle,
        attribution: img.attribution || (img.sourceTitle ? `Photo via Wikipedia — "${img.sourceTitle}"` : 'Photo via Wikipedia'),
        sourcePageUrl: img.sourcePageUrl || result.matchedPageUrl,
        width: img.width,
        height: img.height,
        author: img.author,
        license: img.license,
      }));

      return {
        url: topCandidate.url,
        thumbnailUrl: topCandidate.thumbnailUrl || topCandidate.url,
        type: 'photo',
        source: 'wikimedia',
        confidence: result.confidence,
        title: topCandidate.sourceTitle || result.matchedPageTitle,
        attribution: topCandidate.attribution || (topCandidate.sourceTitle ? `Photo via Wikipedia — "${topCandidate.sourceTitle}"` : 'Photo via Wikipedia'),
        sourcePageUrl: topCandidate.sourcePageUrl || result.matchedPageUrl,
        width: topCandidate.width,
        height: topCandidate.height,
        author: topCandidate.author,
        license: topCandidate.license,
        gallery,
      };
    } catch (err: any) {
      if (err?.name === 'AbortError') return null;
      return null;
    }
  }
}

export const wikimediaVisualProvider = new WikimediaVisualProvider();
