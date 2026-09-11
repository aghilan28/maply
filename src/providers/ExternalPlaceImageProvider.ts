import { Place, PlaceImage } from '../types/place';
import { PlaceImageProvider } from './PlaceImageProvider';

/**
 * Builds a clean, focused image search query from place name and geographic context.
 * Example: "Marina Beach Chennai Tamil Nadu India", "Eiffel Tower Paris France", "Mysore Palace Mysuru Karnataka India"
 */
export function buildImageQuery(place: Place): string {
  const parts: string[] = [];

  // Clean place name: remove leading/trailing noise and coordinate strings
  const cleanName = (place.name || '').trim();
  if (cleanName && !cleanName.match(/^-?\d+\.\d+,\s*-?\d+\.\d+$/)) {
    parts.push(cleanName);
  }

  // Geographic context hierarchy
  const city =
    place.address?.city ||
    place.address?.locality ||
    place.address?.district ||
    place.address?.neighborhood;

  const state = place.address?.state;
  const country = place.address?.country;

  if (city && !cleanName.toLowerCase().includes(city.toLowerCase())) {
    parts.push(city);
  }

  if (state && !cleanName.toLowerCase().includes(state.toLowerCase()) && parts.length < 3) {
    parts.push(state);
  }

  if (country && !cleanName.toLowerCase().includes(country.toLowerCase())) {
    parts.push(country);
  }

  // If parts is empty, fallback to formatted address or name
  if (parts.length === 0) {
    return (place.formattedAddress || place.name || '').split(',').slice(0, 3).join(' ').trim();
  }

  return parts.filter(Boolean).join(' ');
}

interface WikipediaPage {
  pageid: number;
  title: string;
  index?: number;
  description?: string;
  pageimage?: string;
  thumbnail?: {
    source: string;
    width: number;
    height: number;
  };
  original?: {
    source: string;
    width: number;
    height: number;
  };
}

interface WikipediaResponse {
  query?: {
    pages?: Record<string, WikipediaPage>;
  };
}

export class ExternalPlaceImageProvider implements PlaceImageProvider {
  readonly name = 'external-place-image-provider';

  /**
   * Searches for verified, authentic external place photographs.
   * Uses Wikipedia & Wikimedia Commons as the primary worldwide knowledge engine,
   * with secondary support for API-keyed external providers (Unsplash, etc.).
   */
  async searchImages(place: Place, signal?: AbortSignal): Promise<PlaceImage[]> {
    if (!place || !place.name) {
      return [];
    }

    const query = buildImageQuery(place);
    if (!query) {
      return [];
    }

    // 1. Primary Image Provider: Wikipedia / Wikimedia Places Engine
    try {
      const primaryImages = await this.searchWikipediaPlaces(place, query, signal);
      if (primaryImages.length > 0) {
        return primaryImages;
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw err;
      console.warn('Primary image provider error, attempting secondary:', err);
    }

    // 2. Secondary Image Provider: Wikimedia Commons File Search & Unsplash (if key configured)
    try {
      const secondaryImages = await this.searchSecondaryProvider(place, query, signal);
      if (secondaryImages.length > 0) {
        return secondaryImages;
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw err;
      console.warn('Secondary image provider error:', err);
    }

    // 3. Fallback: No verified photograph found
    // Strictly return empty array — NEVER return random or unverified stock photos.
    return [];
  }

  /**
   * Primary Provider: Wikipedia / Wikimedia Real-World Places & Landmarks Engine
   * Queries Wikipedia for encyclopedic pages matching place keywords or coordinates,
   * then strictly validates and ranks photographic results.
   */
  private async searchWikipediaPlaces(
    place: Place,
    query: string,
    signal?: AbortSignal
  ): Promise<PlaceImage[]> {
    const candidates: WikipediaPage[] = [];
    const seenPageIds = new Set<number>();

    // Strategy A: Text search with buildImageQuery
    try {
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
        query
      )}&gsrlimit=6&prop=pageimages|description&piprop=thumbnail|original&pithumbsize=1280&format=json&origin=*`;

      const res = await fetch(searchUrl, { signal });
      if (res.ok) {
        const data: WikipediaResponse = await res.json();
        if (data.query?.pages) {
          for (const page of Object.values(data.query.pages)) {
            if (!seenPageIds.has(page.pageid)) {
              seenPageIds.add(page.pageid);
              candidates.push(page);
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw err;
    }

    // Strategy B: If place has coordinates and few candidates found, query coordinate geosearch
    if (
      candidates.length < 3 &&
      place.coordinates?.latitude &&
      place.coordinates?.longitude &&
      Math.abs(place.coordinates.latitude) > 0.0001
    ) {
      try {
        const { latitude, longitude } = place.coordinates;
        const geoUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=geosearch&ggscoord=${latitude}|${longitude}&ggsradius=8000&ggslimit=6&prop=pageimages|description&piprop=thumbnail|original&pithumbsize=1280&format=json&origin=*`;

        const res = await fetch(geoUrl, { signal });
        if (res.ok) {
          const data: WikipediaResponse = await res.json();
          if (data.query?.pages) {
            for (const page of Object.values(data.query.pages)) {
              if (!seenPageIds.has(page.pageid)) {
                seenPageIds.add(page.pageid);
                candidates.push(page);
              }
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') throw err;
      }
    }

    if (candidates.length === 0) {
      return [];
    }

    // Filter and score candidates against the selected place
    const scoredCandidates = candidates
      .filter((page) => this.isValidPlacePhotoCandidate(page))
      .map((page) => ({
        page,
        score: this.calculateRelevanceScore(page, place),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    const results: PlaceImage[] = [];

    for (const { page } of scoredCandidates) {
      const photoUrl = page.thumbnail?.source || page.original?.source;
      if (!photoUrl) continue;

      results.push({
        url: photoUrl,
        width: page.thumbnail?.width || page.original?.width,
        height: page.thumbnail?.height || page.original?.height,
        alt: `${page.title}${page.description ? ` — ${page.description}` : ''}`,
        credit: `Photo via Wikimedia Commons / Wikipedia (${page.title})`,
        source: 'Wikipedia',
      });

      // We only need top high-quality verified photos
      if (results.length >= 4) break;
    }

    return results;
  }

  /**
   * Secondary Provider:
   * 1. Unsplash Places API if an API key is provided via VITE_IMAGE_PROVIDER_API_KEY or VITE_UNSPLASH_ACCESS_KEY.
   * 2. Wikimedia Commons namespace 6 file search.
   */
  private async searchSecondaryProvider(
    place: Place,
    query: string,
    signal?: AbortSignal
  ): Promise<PlaceImage[]> {
    const unsplashKey =
      (import.meta.env.VITE_IMAGE_PROVIDER_API_KEY as string) ||
      (import.meta.env.VITE_UNSPLASH_ACCESS_KEY as string);

    // Option A: Unsplash API with strict place relevance validation
    if (unsplashKey && unsplashKey.trim() !== '') {
      try {
        const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
          query
        )}&per_page=4&orientation=landscape`;

        const res = await fetch(url, {
          headers: { Authorization: `Client-ID ${unsplashKey}` },
          signal,
        });

        if (res.ok) {
          const data = await res.json();
          if (data.results && Array.isArray(data.results)) {
            const verified: PlaceImage[] = [];
            const placeTokens = this.tokenize(place.name);

            for (const item of data.results) {
              const textToCheck = `${item.description || ''} ${item.alt_description || ''} ${
                item.tags?.map((t: any) => t.title).join(' ') || ''
              }`.toLowerCase();

              // Strict relevance: at least one core term of the place name must appear
              const hasTokenMatch = placeTokens.some((t) => t.length > 2 && textToCheck.includes(t));
              if (hasTokenMatch && item.urls?.regular) {
                verified.push({
                  url: item.urls.regular,
                  width: item.width,
                  height: item.height,
                  alt: item.alt_description || place.name,
                  credit: `Photo by ${item.user?.name || 'Unsplash Creator'} on Unsplash`,
                  source: 'Unsplash',
                });
              }
            }

            if (verified.length > 0) {
              return verified;
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') throw err;
      }
    }

    // Option B: Wikimedia Commons file search
    try {
      const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
        query
      )}&gsrnamespace=6&gsrlimit=5&prop=imageinfo&iiprop=url|size|extmetadata&format=json&origin=*`;

      const res = await fetch(commonsUrl, { signal });
      if (res.ok) {
        const data = await res.json();
        if (data.query?.pages) {
          const results: PlaceImage[] = [];
          const placeTokens = this.tokenize(place.name);

          for (const page of Object.values(data.query.pages) as any[]) {
            const info = page.imageinfo?.[0];
            if (!info?.url) continue;

            const filename = (page.title || '').toLowerCase();
            // Disqualify SVGs, flags, logos, maps
            if (this.isDisqualifiedFile(filename)) continue;

            // Relevance verification against place name
            const isRelevant = placeTokens.some((t) => t.length > 2 && filename.includes(t));
            if (isRelevant) {
              const artist = info.extmetadata?.Artist?.value?.replace(/<[^>]*>?/gm, '') || '';
              const license = info.extmetadata?.LicenseShortName?.value || 'CC';

              results.push({
                url: info.url,
                width: info.width,
                height: info.height,
                alt: page.title.replace(/^File:/i, '').replace(/\.[^.]+$/, '').replace(/_/g, ' '),
                credit: artist ? `Photo by ${artist} (${license})` : `Wikimedia Commons (${license})`,
                source: 'Wikimedia Commons',
              });

              if (results.length >= 3) break;
            }
          }

          if (results.length > 0) {
            return results;
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw err;
    }

    return [];
  }

  /**
   * Strictly filters out non-photographic assets:
   * SVGs, vector maps, flags, coats of arms, insignias, locator charts, user avatars.
   */
  private isValidPlacePhotoCandidate(page: WikipediaPage): boolean {
    const photoUrl = page.thumbnail?.source || page.original?.source || '';
    if (!photoUrl) return false;

    const lowerUrl = photoUrl.toLowerCase();
    const lowerTitle = (page.title || '').toLowerCase();
    const lowerImage = (page.pageimage || '').toLowerCase();

    // Check disqualified patterns
    if (
      this.isDisqualifiedFile(lowerUrl) ||
      this.isDisqualifiedFile(lowerImage) ||
      this.isDisqualifiedFile(lowerTitle)
    ) {
      return false;
    }

    // Must be at least 250px in width/height to be a respectable place photograph
    const w = page.thumbnail?.width || page.original?.width || 0;
    const h = page.thumbnail?.height || page.original?.height || 0;
    if (w > 0 && w < 220) return false;
    if (h > 0 && h < 140) return false;

    return true;
  }

  private isDisqualifiedFile(str: string): boolean {
    return (
      str.endsWith('.svg') ||
      str.includes('.svg.') ||
      str.includes('flag_of_') ||
      str.includes('flag of') ||
      str.includes('coat_of_arms') ||
      str.includes('coat of arms') ||
      str.includes('seal_of') ||
      str.includes('locator_map') ||
      str.includes('locator map') ||
      str.includes('location_map') ||
      str.includes('location map') ||
      str.includes('map_of') ||
      str.includes('route_map') ||
      str.includes('_logo.') ||
      str.includes('emblem') ||
      str.includes('insignia') ||
      str.includes('icon') ||
      str.includes('portrait') ||
      str.includes('disambiguation')
    );
  }

  /**
   * Calculates a relevance score between candidate page and the target place.
   * Ensures places like "Marina Beach" don't match arbitrary articles like "Miami Beach" or a biography.
   */
  private calculateRelevanceScore(page: WikipediaPage, place: Place): number {
    const placeName = (place.name || '').toLowerCase().trim();
    const candidateTitle = (page.title || '').toLowerCase().trim();
    const candidateDesc = (page.description || '').toLowerCase().trim();

    const placeTokens = this.tokenize(placeName);
    if (placeTokens.length === 0) return 0;

    let score = 0;

    // Exact title match gets massive score
    if (candidateTitle === placeName) {
      score += 100;
    } else if (candidateTitle.includes(placeName) || placeName.includes(candidateTitle)) {
      score += 60;
    }

    // Token match in candidate title
    let matchedTitleTokens = 0;
    for (const token of placeTokens) {
      if (token.length > 2 && candidateTitle.includes(token)) {
        matchedTitleTokens++;
        score += 20;
      }
    }

    // Token match in candidate description
    for (const token of placeTokens) {
      if (token.length > 2 && candidateDesc.includes(token)) {
        score += 10;
      }
    }

    // Geographic verification: city / state / country matching
    const city = (place.address?.city || place.address?.locality || '').toLowerCase();
    const country = (place.address?.country || '').toLowerCase();

    if (city && (candidateDesc.includes(city) || candidateTitle.includes(city))) {
      score += 15;
    }
    if (country && (candidateDesc.includes(country) || candidateTitle.includes(country))) {
      score += 10;
    }

    // Category / place type reinforcement
    const category = (place.category || '').toLowerCase();
    if (
      (category.includes('nature') && candidateDesc.includes('beach')) ||
      (category.includes('history') && (candidateDesc.includes('palace') || candidateDesc.includes('monument')))
    ) {
      score += 10;
    }

    // Penalty if no title tokens matched at all (rejects unrelated articles)
    if (matchedTitleTokens === 0 && !candidateTitle.includes(placeName)) {
      score -= 50;
    }

    return Math.max(0, score);
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1 && !['the', 'and', 'for', 'near', 'san', 'del', 'los'].includes(w));
  }
}
