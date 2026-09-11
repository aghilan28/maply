import { PlaceImage, NormalizedPlace } from '../../types/place';
import { PlaceImageProvider } from './types';

const WIKIPEDIA_ENDPOINT = 'https://en.wikipedia.org/w/api.php';
const WIKIPEDIA_HEADERS: Record<string, string> = {
  'Api-User-Agent': 'MaplyApp/1.0 (https://maply.app; contact@maply.app)',
};

export const EARTH_RADIUS_KM = 6371;

/**
 * Calculates the great-circle distance between two coordinates in kilometers using Haversine formula.
 */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface CanonicalAlias {
  pattern: RegExp;
  canonicalTitle: string;
  nearLat?: number;
  nearLon?: number;
  maxDistKm?: number;
}

export const CANONICAL_WIKIPEDIA_ALIASES: CanonicalAlias[] = [
  { pattern: /bangalore palace|bengaluru palace/i, canonicalTitle: 'Bengaluru Palace' },
  { pattern: /pondicherry beach|rock beach|promenade beach/i, canonicalTitle: 'Promenade Beach' },
  { pattern: /pratyagara|prathyangira|pratyangira|prathyagara/i, canonicalTitle: 'Prathyangira Devi Temple, Shollinganallur' },
  { pattern: /vgp/i, canonicalTitle: 'VGP Universal Kingdom' },
  {
    pattern: /\biskcon\b/i,
    canonicalTitle: 'ISKCON Temple, Chennai',
    nearLat: 12.9048,
    nearLon: 80.2505,
    maxDistKm: 25,
  },
  { pattern: /brihadisvara|thanjavur temple|tanjore temple/i, canonicalTitle: 'Brihadisvara Temple, Thanjavur' },
  { pattern: /meenakshi/i, canonicalTitle: 'Meenakshi Temple' },
  { pattern: /marina beach/i, canonicalTitle: 'Marina Beach' },
  { pattern: /mysore palace/i, canonicalTitle: 'Mysore Palace' },
  { pattern: /ooty/i, canonicalTitle: 'Ooty' },
];

export function getCanonicalWikipediaName(name: string, lat?: number, lon?: number): string | null {
  if (!name) return null;
  for (const alias of CANONICAL_WIKIPEDIA_ALIASES) {
    if (alias.pattern.test(name)) {
      if (alias.nearLat !== undefined && alias.nearLon !== undefined && lat !== undefined && lon !== undefined) {
        if (distanceKm(lat, lon, alias.nearLat, alias.nearLon) <= (alias.maxDistKm || 35)) {
          return alias.canonicalTitle;
        }
      } else {
        return alias.canonicalTitle;
      }
    }
  }
  return null;
}

export interface WikipediaResolutionResult {
  title: string;
  extract?: string;
  image: PlaceImage | null;
  coordinates?: { lat: number; lon: number };
  distanceKm: number;
}

// In-memory cache keyed by rounded lat,lon + name so re-selecting in one session doesn't re-fetch
const placeResolutionCache = new Map<string, WikipediaResolutionResult | null>();

function getCacheKey(lat: number, lon: number, queryName?: string): string {
  const normName = (queryName || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
  const latStr = isNaN(lat) ? '0.0000' : lat.toFixed(4);
  const lonStr = isNaN(lon) ? '0.0000' : lon.toFixed(4);
  return `${latStr}_${lonStr}_${normName}`;
}

export function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0)
  );
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  const distance = dp[a.length][b.length];
  const maxLen = Math.max(a.length, b.length);
  return 1 - distance / maxLen;
}

export const STOPWORDS = new Set(['sri', 'shri', 'shree', 'the', 'a', 'of', 'temple', 'maha', 'and', 'in', 'at']);

export function tokenize(str: string): string[] {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0 && !STOPWORDS.has(t));
}

export function fuzzyNameMatchScore(placeName: string, wikiTitle: string): number {
  const placeTokens = tokenize(placeName);
  const titleTokens = tokenize(wikiTitle);
  if (placeTokens.length === 0) return 0;

  let totalScore = 0;
  for (const pt of placeTokens) {
    let bestForThisToken = 0;
    for (const tt of titleTokens) {
      const sim = pt === tt ? 1 : stringSimilarity(pt, tt);
      if (sim > bestForThisToken) bestForThisToken = sim;
    }
    if (bestForThisToken >= 0.5) {
      totalScore += bestForThisToken;
    }
  }

  return totalScore / placeTokens.length;
}

function toPlaceImage(
  title: string,
  alt: string,
  thumbnail: { source: string; width: number; height: number }
): PlaceImage {
  return {
    url: thumbnail.source,
    width: thumbnail.width,
    height: thumbnail.height,
    alt: alt || `${title} on Wikipedia`,
    attribution: `Photo via Wikipedia — "${title}"`,
    source: 'wikipedia',
  };
}

/**
 * Fallback image resolver for articles whose main infobox image parameter is absent
 * but high-resolution authentic place photos exist in the article body.
 */
async function resolveArticleImage(
  title: string,
  signal: AbortSignal
): Promise<{ source: string; width: number; height: number } | null> {
  const imgParams = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    titles: title,
    prop: 'images',
    imlimit: '20',
  });

  try {
    const res = await fetch(`${WIKIPEDIA_ENDPOINT}?${imgParams.toString()}`, {
      headers: WIKIPEDIA_HEADERS,
      signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const page = Object.values(data?.query?.pages ?? {})[0] as any;
    const candidateFile = page?.images?.find((img: { title: string }) => {
      const t = img.title.toLowerCase();
      return (
        (t.endsWith('.jpg') || t.endsWith('.jpeg') || t.endsWith('.png') || t.endsWith('.webp')) &&
        !t.includes('flag') &&
        !t.includes('icon') &&
        !t.includes('symbol') &&
        !t.includes('logo') &&
        !t.includes('map') &&
        !t.includes('stub') &&
        !t.includes('locator')
      );
    });

    if (!candidateFile) return null;

    const infoParams = new URLSearchParams({
      action: 'query',
      format: 'json',
      origin: '*',
      titles: candidateFile.title,
      prop: 'imageinfo',
      iiprop: 'url',
      iiurlwidth: '900',
    });

    const infoRes = await fetch(`${WIKIPEDIA_ENDPOINT}?${infoParams.toString()}`, {
      headers: WIKIPEDIA_HEADERS,
      signal,
    });
    if (!infoRes.ok) return null;
    const infoData = await infoRes.json();
    const infoPage = Object.values(infoData?.query?.pages ?? {})[0] as any;
    const thumb = infoPage?.imageinfo?.[0];
    const source = thumb?.thumburl || thumb?.url;
    if (source) {
      return {
        source,
        width: thumb?.thumbwidth || 900,
        height: thumb?.thumbheight || 600,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Resolves accurate Wikipedia data (accurate title, summary extract, and authentic photograph)
 * for ANY location on the map.
 */
export async function resolveWikipediaPlace(
  params: {
    latitude: number;
    longitude: number;
    queryName?: string;
  },
  signal?: AbortSignal
): Promise<WikipediaResolutionResult | null> {
  const { latitude, longitude, queryName } = params;
  if (isNaN(latitude) || isNaN(longitude)) return null;

  const cacheKey = getCacheKey(latitude, longitude, queryName);
  if (placeResolutionCache.has(cacheKey)) {
    return placeResolutionCache.get(cacheKey) ?? null;
  }

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => {
    timeoutController.abort(new DOMException('Timeout', 'TimeoutError'));
  }, 9000);

  const onCallerAbort = () => timeoutController.abort();
  if (signal) {
    if (signal.aborted) {
      clearTimeout(timeoutId);
      throw new DOMException('Aborted', 'AbortError');
    }
    signal.addEventListener('abort', onCallerAbort);
  }

  try {
    const cleanName = queryName ? queryName.trim() : '';
    const isGenericQuery =
      !cleanName ||
      cleanName.includes('Selected') ||
      cleanName.includes('°') ||
      cleanName.toLowerCase().includes('point') ||
      cleanName.toLowerCase().includes('pin');

    const canonical = getCanonicalWikipediaName(cleanName, latitude, longitude);
    const candidateSearch = canonical || (!isGenericQuery ? cleanName : '');

    // Step 1: Search by name if a specific place or landmark name is known
    if (candidateSearch) {
      try {
        const searchParams = new URLSearchParams({
          action: 'query',
          format: 'json',
          origin: '*',
          generator: 'search',
          gsrsearch: candidateSearch,
          gsrlimit: '6',
          prop: 'pageimages|coordinates|extracts',
          piprop: 'thumbnail',
          pithumbsize: '900',
          exintro: '1',
          explaintext: '1',
          redirects: '1',
        });

        const sRes = await fetch(`${WIKIPEDIA_ENDPOINT}?${searchParams.toString()}`, {
          headers: WIKIPEDIA_HEADERS,
          signal: timeoutController.signal,
        });

        if (sRes.ok) {
          const sData = await sRes.json();
          const pages: any[] = Object.values(sData?.query?.pages || {});

          // Look for best candidate matching canonical or high name similarity
          for (const page of pages) {
            if (!page.title) continue;

            const coord = page.coordinates?.[0];
            const dist =
              coord && !isNaN(coord.lat) && !isNaN(coord.lon)
                ? distanceKm(latitude, longitude, coord.lat, coord.lon)
                : 0;

            const isCanonMatch =
              canonical &&
              (page.title.toLowerCase().includes(canonical.toLowerCase()) ||
                canonical.toLowerCase().includes(page.title.toLowerCase()));

            const nameScore = fuzzyNameMatchScore(cleanName, page.title);

            // Accept only if canonical match, or if distance is reasonable (under 50km) and name matches
            if (isCanonMatch || (dist <= 50 && nameScore >= 0.45)) {
              let thumb = page.thumbnail;
              if (!thumb?.source) {
                thumb = await resolveArticleImage(page.title, timeoutController.signal);
              }

              if (thumb?.source) {
                const img = toPlaceImage(page.title, cleanName || page.title, thumb);
                const res: WikipediaResolutionResult = {
                  title: page.title,
                  extract: page.extract || undefined,
                  image: img,
                  coordinates: coord ? { lat: coord.lat, lon: coord.lon } : undefined,
                  distanceKm: dist,
                };
                placeResolutionCache.set(cacheKey, res);
                return res;
              }
            }
          }
        }
      } catch {
        // Fall through to geosearch
      }
    }

    // Step 2: MediaWiki Geosearch around coordinates (finds places, landmarks, neighborhoods near lat, lon)
    const geoParams = new URLSearchParams({
      action: 'query',
      format: 'json',
      origin: '*',
      generator: 'geosearch',
      ggscoord: `${latitude}|${longitude}`,
      ggsradius: '10000', // 10 km radius
      ggslimit: '12',
      prop: 'pageimages|coordinates|extracts',
      piprop: 'thumbnail',
      pithumbsize: '900',
      exintro: '1',
      explaintext: '1',
      coprimary: 'all',
    });

    const geoRes = await fetch(`${WIKIPEDIA_ENDPOINT}?${geoParams.toString()}`, {
      headers: WIKIPEDIA_HEADERS,
      signal: timeoutController.signal,
    });

    if (geoRes.ok) {
      const geoData = await geoRes.json();
      const rawPages: any[] = Object.values(geoData?.query?.pages || {});

      // Sort by proximity and prioritize pages with images
      const sortedPages = rawPages
        .map((page) => {
          const coord = page.coordinates?.[0];
          const dist =
            coord && !isNaN(coord.lat) && !isNaN(coord.lon)
              ? distanceKm(latitude, longitude, coord.lat, coord.lon)
              : 999;
          return { page, dist };
        })
        .sort((a, b) => {
          // Prioritize having an image first, then closer distance
          const aHasImg = Boolean(a.page.thumbnail?.source);
          const bHasImg = Boolean(b.page.thumbnail?.source);
          if (aHasImg && !bHasImg) return -1;
          if (!aHasImg && bHasImg) return 1;
          return a.dist - b.dist;
        });

      for (const item of sortedPages) {
        const page = item.page;
        if (!page.title) continue;

        // Anti-collapse semantic safeguard:
        // Must verify that the geosearch article title actually corresponds to the place name!
        const geoNameScore = fuzzyNameMatchScore(cleanName, page.title);
        const isGeoCanonMatch = Boolean(
          canonical &&
            (page.title.toLowerCase().includes(canonical.toLowerCase()) ||
              canonical.toLowerCase().includes(page.title.toLowerCase()))
        );

        // DO NOT accept an unrelated nearby landmark (e.g. ISKCON Temple for Sri Pratyagara Devi Temple)
        if (!isGeoCanonMatch && geoNameScore < 0.45) {
          continue;
        }

        let thumb = page.thumbnail;
        if (!thumb?.source) {
          thumb = await resolveArticleImage(page.title, timeoutController.signal);
        }

        if (thumb?.source) {
          const img = toPlaceImage(page.title, cleanName || page.title, thumb);
          const res: WikipediaResolutionResult = {
            title: page.title,
            extract: page.extract || undefined,
            image: img,
            coordinates: page.coordinates?.[0]
              ? { lat: page.coordinates[0].lat, lon: page.coordinates[0].lon }
              : undefined,
            distanceKm: item.dist,
          };
          placeResolutionCache.set(cacheKey, res);
          return res;
        }
      }

      // If articles were found nearby and match the place name, take the closest matching article
      const topMatch = sortedPages.find((item) => {
        if (!item.page.title) return false;
        const score = fuzzyNameMatchScore(cleanName, item.page.title);
        const isCanon = Boolean(
          canonical &&
            (item.page.title.toLowerCase().includes(canonical.toLowerCase()) ||
              canonical.toLowerCase().includes(item.page.title.toLowerCase()))
        );
        return isCanon || score >= 0.45;
      });

      if (topMatch && topMatch.page.title) {
        const top = topMatch;
        const res: WikipediaResolutionResult = {
          title: top.page.title,
          extract: top.page.extract || undefined,
          image: null,
          coordinates: top.page.coordinates?.[0]
            ? { lat: top.page.coordinates[0].lat, lon: top.page.coordinates[0].lon }
            : undefined,
          distanceKm: top.dist,
        };
        placeResolutionCache.set(cacheKey, res);
        return res;
      }
    }

    return null;
  } catch (err: any) {
    if (err?.name === 'AbortError' || signal?.aborted) {
      throw err;
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
    if (signal) {
      signal.removeEventListener('abort', onCallerAbort);
    }
  }
}

/**
 * Resolves a verified Wikipedia photo for a place.
 */
export async function getWikipediaImage(
  place: { name: string; latitude: number; longitude: number },
  signal?: AbortSignal
): Promise<PlaceImage | null> {
  if (!place || isNaN(place.latitude) || isNaN(place.longitude)) {
    return null;
  }

  const result = await resolveWikipediaPlace(
    {
      latitude: place.latitude,
      longitude: place.longitude,
      queryName: place.name,
    },
    signal
  );

  return result?.image ?? null;
}

/**
 * Provider class implementation for integration with multi-provider resolvers
 */
export class WikipediaProvider implements PlaceImageProvider {
  name = 'wikipedia';

  async getImages(place: NormalizedPlace, signal: AbortSignal): Promise<PlaceImage[]> {
    try {
      const img = await getWikipediaImage(place, signal);
      return img ? [img] : [];
    } catch {
      return [];
    }
  }
}

export const wikipediaProvider = new WikipediaProvider();
