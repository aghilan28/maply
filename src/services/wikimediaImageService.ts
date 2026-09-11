/**
 * Maply — Dedicated Wikimedia Image Service
 * 
 * Resolves authentic Wikimedia/Wikipedia photography worldwide with high coverage
 * and strict geographical & semantic fidelity.
 * 
 * ABSOLUTE ARCHITECTURAL RULES:
 * 1. This service is strictly an IMAGE PROVIDER.
 * 2. CanonicalLocation is read-only and is NEVER mutated by this service.
 * 3. Candidate page titles or coordinates are NEVER used to rename or move the location.
 * 4. WRONG IMAGE IS WORSE THAN NO IMAGE: Obvious different landmarks or distant streets are rejected.
 * 5. Returns multiple authentic images (hero + gallery) when available.
 */

export type CanonicalLocation = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  region?: string;
  country?: string;
  category?: string;
  tags?: string[];
  mapboxId?: string;
};

export type PlaceImage = {
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  alt: string;
  source: 'wikimedia';
  sourcePageUrl?: string;
  sourceTitle?: string;
  author?: string;
  license?: string;
  attribution?: string;
};

export type PlaceImageResult = {
  images: PlaceImage[];
  matchedPageTitle?: string;
  matchedPageUrl?: string;
  matchedExtract?: string;
  confidence: number;
  matchType:
    | 'exact-title'
    | 'exact-name'
    | 'coordinate-match'
    | 'nearby-verified'
    | 'commons-match'
    | 'none';
};

export interface PlaceImageProvider {
  resolveImages(location: CanonicalLocation, signal?: AbortSignal): Promise<PlaceImageResult>;
}

const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const MIN_IMAGE_MATCH_CONFIDENCE = 0.50;

/**
 * Diagnostic logger for photo resolution attempts per Maply specification.
 */
export function logPhotoResolverDiagnostic(info: {
  locationId?: string;
  locationName: string;
  latitude: number;
  longitude: number;
  candidateSource: string;
  candidatePageTitle: string;
  candidateImageUrl: string;
  candidateScore: number;
  nameSimilarity: number;
  contextMatch: boolean | string;
  distance: string;
  browserImageLoad?: 'pending' | 'success' | 'failed';
  status: 'accepted' | 'rejected';
  reason: string;
}) {
  try {
    console.log(
      `[Maply Photo Resolver]\n` +
      `locationId: ${info.locationId || 'N/A'}\n` +
      `locationName: ${info.locationName}\n` +
      `latitude: ${info.latitude}\n` +
      `longitude: ${info.longitude}\n\n` +
      `candidate source: ${info.candidateSource}\n` +
      `candidate page title: ${info.candidatePageTitle}\n` +
      `candidate image URL: ${info.candidateImageUrl}\n` +
      `candidate score: ${info.candidateScore.toFixed(2)}\n` +
      `name similarity: ${info.nameSimilarity.toFixed(2)}\n` +
      `context match: ${info.contextMatch}\n` +
      `distance: ${info.distance}\n` +
      `browser image load: ${info.browserImageLoad || 'pending'}\n` +
      `accepted/rejected: ${info.status}\n` +
      `reason: ${info.reason}`
    );
  } catch {
    // safe fallback
  }
}

/**
 * Normalizes place name for baseline tokenization.
 */
export function normalizePlaceName(name: string): string {
  if (!name) return '';
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .toLowerCase()
    .replace(/['"’`]/g, '')
    .replace(/[,\-_–—/\\()\[\]|:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes phonetic and transliteration variations (e.g. "th" vs "t", "sh" vs "s", double letters, honorifics).
 */
export function normalizeTransliteration(name: string): string {
  if (!name) return '';
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(sri|shri|shree|st|saint|the|hotel|restaurant|resort|dr|mr|mrs|prof|lord|goddess|maa)\b/g, '')
    .replace(/th/g, 't')
    .replace(/dh/g, 'd')
    .replace(/bh/g, 'b')
    .replace(/kh/g, 'k')
    .replace(/ph/g, 'p')
    .replace(/sh/g, 's')
    .replace(/([a-z])\1+/g, '$1') // collapse double letters
    .replace(/ee/g, 'i')
    .replace(/oo/g, 'u')
    .replace(/[\W_]+/g, ' ')
    .trim();
}

/**
 * Extracts primary name and secondary parts from structured location titles
 * (e.g. "Marina Beach, Triplicane, Chennai" -> primary: "Marina Beach", secondary: ["Triplicane", "Chennai"]).
 */
export function extractPlaceComponents(name: string): {
  primaryName: string;
  secondaryParts: string[];
} {
  if (!name) return { primaryName: '', secondaryParts: [] };
  const parts = name
    .split(/[,;\-—|]/)
    .map((p) => p.trim())
    .filter(Boolean);
  const rawPrimary = parts[0] || name.trim();
  const cleanPrimary = rawPrimary.replace(/\s*\([^)]*\)/g, '').trim();
  return {
    primaryName: cleanPrimary || rawPrimary,
    secondaryParts: parts.slice(1),
  };
}

export interface CanonicalAlias {
  pattern: RegExp;
  canonicalTitle: string;
  nearLat?: number;
  nearLon?: number;
  maxDistKm?: number;
}

export const CANONICAL_WIKIPEDIA_ALIASES: CanonicalAlias[] = [
  // Academic & Research Institutions
  { pattern: /\b(iit\s*madras|indian\s*institute\s*of\s*technology\s*(–|-)?\s*madras)\b/i, canonicalTitle: 'IIT Madras' },
  { pattern: /\b(iit\s*bombay|indian\s*institute\s*of\s*technology\s*(–|-)?\s*bombay)\b/i, canonicalTitle: 'IIT Bombay' },
  { pattern: /\b(iit\s*delhi|indian\s*institute\s*of\s*technology\s*(–|-)?\s*delhi)\b/i, canonicalTitle: 'IIT Delhi' },
  { pattern: /\b(iit\s*kharagpur|indian\s*institute\s*of\s*technology\s*(–|-)?\s*kharagpur)\b/i, canonicalTitle: 'IIT Kharagpur' },
  { pattern: /\b(iit\s*kanpur|indian\s*institute\s*of\s*technology\s*(–|-)?\s*kanpur)\b/i, canonicalTitle: 'IIT Kanpur' },
  { pattern: /\b(iit\s*roorkee|indian\s*institute\s*of\s*technology\s*(–|-)?\s*roorkee)\b/i, canonicalTitle: 'IIT Roorkee' },
  { pattern: /\b(anna\s*university)\b/i, canonicalTitle: 'Anna University' },
  { pattern: /\b(madras\s*medical\s*college)\b/i, canonicalTitle: 'Madras Medical College' },
  { pattern: /\b(stanley\s*medical\s*college)\b/i, canonicalTitle: 'Stanley Medical College' },

  // Parks, Wildlife & Nature
  { pattern: /\b(guindy\s*national\s*park)\b/i, canonicalTitle: 'Guindy National Park' },
  { pattern: /\b(chennai\s*snake\s*park|snake\s*park.*chennai)\b/i, canonicalTitle: 'Chennai Snake Park' },
  { pattern: /\b(arignar\s*anna\s*zoological|vandalur\s*zoo)\b/i, canonicalTitle: 'Arignar Anna Zoological Park' },
  { pattern: /\b(madras\s*crocodile\s*bank|croc\s*bank)\b/i, canonicalTitle: 'Madras Crocodile Bank Trust' },
  { pattern: /\b(semmozhi\s*poonga)\b/i, canonicalTitle: 'Semmozhi Poonga' },
  { pattern: /\b(theosophical\s*society.*adyar|theosophical\s*society)\b/i, canonicalTitle: 'Theosophical Society Adyar' },
  { pattern: /\b(cubbon\s*park)\b/i, canonicalTitle: 'Cubbon Park' },
  { pattern: /\b(lalbagh)\b/i, canonicalTitle: 'Lalbagh Botanical Garden' },

  // Heritage, Monuments, Museums & Architecture
  { pattern: /\b(ripon\s*building)\b/i, canonicalTitle: 'Ripon Building' },
  { pattern: /\b(valluvar\s*kottam)\b/i, canonicalTitle: 'Valluvar Kottam' },
  { pattern: /\b(government\s*museum.*chennai|egmore\s*museum)\b/i, canonicalTitle: 'Government Museum, Chennai' },
  { pattern: /\b(connemara\s*(public\s*)?library)\b/i, canonicalTitle: 'Connemara Public Library' },
  { pattern: /\b(birla\s*planetarium.*chennai|birla\s*planetarium)\b/i, canonicalTitle: 'Birla Planetarium, Chennai' },
  { pattern: /\b(dakshinachitra|dakshina\s*chitra)\b/i, canonicalTitle: 'DakshinaChitra' },
  { pattern: /\b(kalakshetra)\b/i, canonicalTitle: 'Kalakshetra Foundation' },
  { pattern: /\b(fort\s*st\s*george|fort\s*saint\s*george)\b/i, canonicalTitle: 'Fort St. George, India' },
  { pattern: /\b(madras\s*high\s*court)\b/i, canonicalTitle: 'Madras High Court' },
  { pattern: /\b(victoria\s*memorial)\b/i, canonicalTitle: 'Victoria Memorial, Kolkata' },
  { pattern: /\b(howrah\s*bridge)\b/i, canonicalTitle: 'Howrah Bridge' },
  { pattern: /\b(vidhana\s*soudha)\b/i, canonicalTitle: 'Vidhana Soudha' },
  { pattern: /\b(bangalore\s*palace|bengaluru\s*palace)\b/i, canonicalTitle: 'Bengaluru Palace' },
  { pattern: /\b(mysore\s*palace|ambavilas)\b/i, canonicalTitle: 'Mysore Palace' },
  { pattern: /\b(red\s*fort)\b/i, canonicalTitle: 'Red Fort' },
  { pattern: /\b(qutub\s*minar|qutb\s*minar)\b/i, canonicalTitle: 'Qutb Minar complex' },
  { pattern: /\b(india\s*gate)\b/i, canonicalTitle: 'India Gate' },
  { pattern: /\b(gateway\s*of\s*india)\b/i, canonicalTitle: 'Gateway of India' },
  { pattern: /\b(charminar)\b/i, canonicalTitle: 'Charminar' },
  { pattern: /\b(hawa\s*mahal)\b/i, canonicalTitle: 'Hawa Mahal' },
  { pattern: /\b(amber\s*fort|amer\s*fort)\b/i, canonicalTitle: 'Amer Fort' },
  { pattern: /\b(taj\s*mahal)\b/i, canonicalTitle: 'Taj Mahal' },

  // Religious & Cultural Sites
  { pattern: /\b(kapaleeshwarar|kapaleeswarar)\b/i, canonicalTitle: 'Kapaleeshwarar Temple' },
  { pattern: /\b(san\s*thome|santhome\s*cathedral|santhome\s*church)\b/i, canonicalTitle: 'San Thome Basilica' },
  { pattern: /\b(st\.?\s*thomas\s*mount)\b/i, canonicalTitle: 'St. Thomas Mount' },
  { pattern: /\b(parthasarathy\s*temple)\b/i, canonicalTitle: 'Parthasarathy Temple, Triplicane' },
  { pattern: /\b(marundeeswarar\s*temple)\b/i, canonicalTitle: 'Marundeeswarar Temple' },
  { pattern: /\b(ashtalakshmi\s*temple|ashtalakshmi\s*kovil)\b/i, canonicalTitle: 'Ashtalakshmi Kovil' },
  { pattern: /\b(brihadisvara|brihadeeswarar|thanjavur\s*temple|big\s*temple)\b/i, canonicalTitle: 'Brihadisvara Temple, Thanjavur' },
  { pattern: /\b(meenakshi\s*amman|meenakshi\s*temple)\b/i, canonicalTitle: 'Meenakshi Temple' },
  { pattern: /\b(prathyangira|pratyangira|pratyagara|prathyagara|pratyangara|prathyangara)\b/i, canonicalTitle: 'Prathyangira Devi Temple, Shollinganallur' },
  { pattern: /\b(golden\s*temple|harmandir\s*sahib)\b/i, canonicalTitle: 'Golden Temple' },
  { pattern: /\b(lotus\s*temple)\b/i, canonicalTitle: 'Lotus Temple' },
  { pattern: /\b(mahabalipuram|mamallapuram)\b/i, canonicalTitle: 'Group of Monuments at Mahabalipuram' },
  { pattern: /\b(shore\s*temple)\b/i, canonicalTitle: 'Shore Temple' },
  { pattern: /\b(pancha\s*rathas)\b/i, canonicalTitle: 'Pancha Rathas' },

  // Transport Hubs & Beaches
  { pattern: /\b(chennai\s*central|mgr\s*central)\b/i, canonicalTitle: 'Puratchi Thalaivar Dr. M.G. Ramachandran Central Railway Station' },
  { pattern: /\b(chhatrapati\s*shivaji\s*(maharaj\s*)?terminus|vt\s*station|csmt)\b/i, canonicalTitle: 'Chhatrapati Shivaji Maharaj Terminus' },
  { pattern: /\b(marina\s*beach)\b/i, canonicalTitle: 'Marina Beach' },
  { pattern: /\b(elliot('?s)?\s*beach|besant\s*nagar\s*beach)\b/i, canonicalTitle: "Elliot's Beach" },
  { pattern: /\b(promenade\s*beach|rock\s*beach|pondicherry\s*beach)\b/i, canonicalTitle: 'Promenade Beach' },
  { pattern: /\b(muttukadu|muttukadu\s*boat\s*house)\b/i, canonicalTitle: 'Muttukadu boat house' },
  { pattern: /\b(kovalam\s*beach.*chennai|covelong\s*beach|covelong)\b/i, canonicalTitle: 'Covelong' },
  { pattern: /\b(vgp\s*universal\s*kingdom|vgp\s*marine\s*kingdom)\b/i, canonicalTitle: 'VGP Universal Kingdom' },
  { pattern: /\b(ooty\s*lake|ooty)\b/i, canonicalTitle: 'Ooty' },

  // ISKCON Temples by Location
  {
    pattern: /\biskcon\b/i,
    canonicalTitle: 'ISKCON Temple, Chennai',
    nearLat: 12.9048,
    nearLon: 80.2505,
    maxDistKm: 45,
  },
  {
    pattern: /\biskcon\b/i,
    canonicalTitle: 'ISKCON Temple, Bangalore',
    nearLat: 12.9845,
    nearLon: 77.5518,
    maxDistKm: 45,
  },
  {
    pattern: /\biskcon\b/i,
    canonicalTitle: 'Sri Sri Radha Parthasarathi Mandir',
    nearLat: 28.5562,
    nearLon: 77.2536,
    maxDistKm: 45,
  },
  {
    pattern: /\biskcon\b/i,
    canonicalTitle: 'ISKCON temple, Mumbai',
    nearLat: 19.1114,
    nearLon: 72.8267,
    maxDistKm: 45,
  },
  { pattern: /\b(iskcon.*chennai|chennai.*iskcon)\b/i, canonicalTitle: 'ISKCON Temple, Chennai' },

  // International Icons
  { pattern: /\b(eiffel\s*tower)\b/i, canonicalTitle: 'Eiffel Tower' },
  { pattern: /\b(louvre)\b/i, canonicalTitle: 'Louvre Museum' },
  { pattern: /\b(statue\s*of\s*liberty)\b/i, canonicalTitle: 'Statue of Liberty' },
  { pattern: /\b(central\s*park)\b/i, canonicalTitle: 'Central Park' },
  { pattern: /\b(golden\s*gate\s*bridge)\b/i, canonicalTitle: 'Golden Gate Bridge' },
  { pattern: /\b(empire\s*state\s*building)\b/i, canonicalTitle: 'Empire State Building' },
  { pattern: /\b(colosseum)\b/i, canonicalTitle: 'Colosseum' },
  { pattern: /\b(big\s*ben)\b/i, canonicalTitle: 'Big Ben' },
  { pattern: /\b(machu\s*picchu)\b/i, canonicalTitle: 'Machu Picchu' },
];

/**
 * List of known distinct geographic centers used to prevent distant homonym collapse.
 * If candidate image title/URL contains one of these, it must match the location's region.
 */
export const FOREIGN_CITY_TOKENS = [
  'mayapur', 'vrindavan', 'delhi', 'mumbai', 'bombay', 'kolkata', 'calcutta',
  'bangalore', 'bengaluru', 'hyderabad', 'pune', 'jaipur', 'ahmedabad',
  'varanasi', 'banaras', 'agra', 'thanjavur', 'madurai', 'kochi', 'cochin',
  'trivandrum', 'thiruvananthapuram', 'london', 'paris', 'tokyo', 'new york'
];

/**
 * Levenshtein distance for fuzzy string comparison.
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Computes similarity ratio between two tokens (0 to 1).
 */
function tokenSimilarity(t1: string, t2: string): number {
  if (t1 === t2) return 1.0;
  if (t1.includes(t2) || t2.includes(t1)) return 0.90;

  const n1 = normalizeTransliteration(t1);
  const n2 = normalizeTransliteration(t2);
  if (n1 && n2) {
    if (n1 === n2) return 0.95;
    if (n1.includes(n2) || n2.includes(n1)) return 0.88;
    const d = levenshteinDistance(n1, n2);
    const maxLen = Math.max(n1.length, n2.length);
    if (maxLen > 0) {
      const sim = 1.0 - d / maxLen;
      if (sim >= 0.70) return sim;
    }
  }
  return 0;
}

/**
 * Checks if one token/phrase is an acronym of another
 * e.g. "IIT" <-> "Indian Institute of Technology", "AIIMS" <-> "All India Institute of Medical Sciences"
 */
export function isAcronymMatch(phrase: string, acronymCandidate: string): boolean {
  const cleanAcr = acronymCandidate.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (cleanAcr.length < 2 || cleanAcr.length > 8) return false;

  const words = phrase.toLowerCase().split(/[\s,\-_–—|/:\\]+/).filter((w) => w.length > 0);
  if (words.length < 2) return false;

  const initials = words.map((w) => w[0]).join('');
  if (initials === cleanAcr || cleanAcr.startsWith(initials) || initials.startsWith(cleanAcr)) {
    return true;
  }

  const stopWords = new Set(['and', 'for', 'the', 'of', 'in', 'at', 'on', 'by', 'to']);
  const contentInitials = words.filter((w) => !stopWords.has(w)).map((w) => w[0]).join('');
  return (
    contentInitials === cleanAcr ||
    cleanAcr.startsWith(contentInitials) ||
    contentInitials.startsWith(cleanAcr)
  );
}

/**
 * Generates common acronym variations for institutions (e.g. "IIT Madras", "NIT Trichy", "AIIMS Delhi")
 */
export function generateAcronymVariations(name: string): string[] {
  const clean = name.replace(/[\u2010-\u2015\-_–—|/:\\]+/g, ' ').replace(/\s+/g, ' ').trim();
  const res: string[] = [];

  const replacements: Array<[RegExp, string]> = [
    [/\bIndian Institute of Technology\b/gi, 'IIT'],
    [/\bNational Institute of Technology\b/gi, 'NIT'],
    [/\bIndian Institute of Management\b/gi, 'IIM'],
    [/\bAll India Institute of Medical Sciences\b/gi, 'AIIMS'],
    [/\bBirla Institute of Technology and Science\b/gi, 'BITS'],
    [/\bBirla Institute of Technology\b/gi, 'BIT'],
    [/\bMassachusetts Institute of Technology\b/gi, 'MIT'],
    [/\bCalifornia Institute of Technology\b/gi, 'Caltech'],
    [/\bChhatrapati Shivaji Maharaj Terminus\b/gi, 'CSMT'],
    [/\bIndian Space Research Organisation\b/gi, 'ISRO'],
    [/\bDefence Research and Development Organisation\b/gi, 'DRDO'],
  ];

  for (const [re, acr] of replacements) {
    if (re.test(clean)) {
      res.push(clean.replace(re, acr));
    }
  }
  return res;
}

export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

interface MediaWikiCandidate {
  pageid: number;
  title: string;
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
  coordinates?: Array<{
    lat: number;
    lon: number;
  }>;
  extract?: string;
  description?: string;
  fullurl?: string;
  images?: Array<{
    title: string;
  }>;
  customImages?: PlaceImage[];
  source: 'wikipedia' | 'commons';
}

class WikimediaImageService implements PlaceImageProvider {
  private cache = new Map<string, PlaceImageResult>();

  constructor() {
    this.loadFromLocalStorage();
  }

  private getCacheKey(location: CanonicalLocation): string {
    const norm = normalizePlaceName(location.name);
    const lat = isNaN(location.latitude) ? '0.0000' : location.latitude.toFixed(4);
    const lng = isNaN(location.longitude) ? '0.0000' : location.longitude.toFixed(4);
    return `${location.id || ''}_${lat}_${lng}_${norm}`;
  }

  /**
   * Synchronously checks in-memory cache and returns cached image result if present.
   * Performs semantic validation to prevent stale/collapsed cache bleed across places.
   */
  public getCachedResult(location: CanonicalLocation): PlaceImageResult | null {
    if (!location) return null;
    const cacheKey = this.getCacheKey(location);
    let cached: PlaceImageResult | null = null;
    if (this.cache.has(cacheKey)) {
      cached = this.cache.get(cacheKey)!;
    } else if (location.id && this.cache.has(location.id)) {
      cached = this.cache.get(location.id)!;
    }
    if (!cached) return null;

    // Safety check: prevent foreign city images from polluting cache
    const lowerPageTitle = (cached.matchedPageTitle || '').toLowerCase();
    const lowerImgUrl = (cached.images?.[0]?.url || '').toLowerCase();
    const locCity = (location.city || '').toLowerCase();
    const locRegion = (location.region || '').toLowerCase();
    const locName = (location.name || '').toLowerCase();
    for (const cityToken of FOREIGN_CITY_TOKENS) {
      const inCached = lowerPageTitle.includes(cityToken) || lowerImgUrl.includes(cityToken);
      if (inCached && !locCity.includes(cityToken) && !locRegion.includes(cityToken) && !locName.includes(cityToken)) {
        this.cache.delete(cacheKey);
        if (location.id) this.cache.delete(location.id);
        return null;
      }
    }

    // Safety validation: Ensure cached result's matchedPageTitle actually belongs to location.name
    if (cached.matchedPageTitle && location.name) {
      const isAlias = CANONICAL_WIKIPEDIA_ALIASES.some(
        (a) => a.pattern.test(location.name) && a.canonicalTitle.toLowerCase() === cached?.matchedPageTitle?.toLowerCase()
      );
      if (!isAlias) {
        const normLoc = normalizePlaceName(location.name);
        const normTitle = normalizePlaceName(cached.matchedPageTitle);
        const stopWords = new Set(['and', 'for', 'the', 'of', 'in', 'at', 'on', 'by', 'to', 'from', 'sri', 'shri', 'shree']);
        const genericPlaceNouns = new Set([
          'temple', 'temples', 'mandir', 'church', 'cathedral', 'mosque', 'palace', 'fort', 'beach', 'park',
          'garden', 'hotel', 'restaurant', 'cafe', 'mall', 'station', 'airport', 'bridge', 'lake', 'museum', 'chennai', 'bengaluru'
        ]);
        const pTokens = normLoc.split(' ').filter((t) => t.length > 2 && !stopWords.has(t) && !genericPlaceNouns.has(t));
        const tTokens = normTitle.split(' ').filter((t) => t.length > 2 && !stopWords.has(t) && !genericPlaceNouns.has(t));
        if (pTokens.length > 0 && tTokens.length > 0) {
          const match = pTokens.some((pt) => tTokens.some((tt) => tokenSimilarity(pt, tt) >= 0.70));
          if (!match) {
            // Purge corrupted cached item from another location
            this.cache.delete(cacheKey);
            if (location.id) this.cache.delete(location.id);
            return null;
          }
        }
      }
    }
    return cached;
  }

  /**
   * Caches a successfully browser-rendered image candidate in memory and localStorage.
   */
  public cacheSuccessfulCandidate(location: CanonicalLocation, candidate: PlaceImage) {
    if (!location || !candidate || !candidate.url) return;
    const cacheKey = this.getCacheKey(location);
    const existing = this.cache.get(cacheKey) || {
      images: [candidate],
      matchedPageTitle: candidate.sourceTitle,
      confidence: 1.0,
      matchType: 'exact-title' as const,
    };
    if (!existing.images.some((img) => img.url === candidate.url)) {
      existing.images.unshift(candidate);
    }
    this.cache.set(cacheKey, existing);
    if (location.id) {
      this.cache.set(location.id, existing);
    }
    this.saveToLocalStorage(location, candidate);
  }

  private saveToLocalStorage(location: CanonicalLocation, candidate: PlaceImage) {
    try {
      const storageKey = 'maply_photo_cache_v6';
      const raw = localStorage.getItem(storageKey);
      const data: Record<string, any> = raw ? JSON.parse(raw) : {};
      const key = location.id || this.getCacheKey(location);
      data[key] = {
        locationId: location.id,
        imageUrl: candidate.url,
        thumbnailUrl: candidate.thumbnailUrl,
        source: 'wikimedia',
        sourceTitle: candidate.sourceTitle,
        sourcePageUrl: candidate.sourcePageUrl,
        attribution: candidate.attribution,
        author: candidate.author,
        license: candidate.license,
        resolvedAt: Date.now(),
      };
      const keys = Object.keys(data);
      if (keys.length > 100) {
        delete data[keys[0]];
      }
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch {
      // safe fallback
    }
  }

  private loadFromLocalStorage() {
    try {
      // Clear old corrupted caches from earlier versions
      try {
        localStorage.removeItem('maply_photo_cache_v2');
        localStorage.removeItem('maply_photo_cache_v3');
        localStorage.removeItem('maply_photo_cache_v4');
        localStorage.removeItem('maply_photo_cache_v5');
      } catch {}

      const storageKey = 'maply_photo_cache_v6';
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const data: Record<string, any> = JSON.parse(raw);
      for (const [key, item] of Object.entries(data)) {
        if (item && item.imageUrl) {
          const placeImg: PlaceImage = {
            url: item.imageUrl,
            thumbnailUrl: item.thumbnailUrl || item.imageUrl,
            width: 1280,
            height: 800,
            alt: item.sourceTitle || 'Place photograph',
            source: 'wikimedia',
            sourcePageUrl: item.sourcePageUrl,
            sourceTitle: item.sourceTitle,
            author: item.author || 'Wikimedia Contributor',
            license: item.license || 'CC BY-SA',
            attribution: item.attribution || `Photo via Wikipedia — "${item.sourceTitle || 'Verified Place'}"`,
          };
          const result: PlaceImageResult = {
            images: [placeImg],
            matchedPageTitle: item.sourceTitle,
            matchedPageUrl: item.sourcePageUrl,
            confidence: 1.0,
            matchType: 'exact-title',
          };
          this.cache.set(key, result);
          if (item.locationId) {
            this.cache.set(item.locationId, result);
          }
        }
      }
    } catch {
      // safe fallback
    }
  }

  /**
   * Evaluates and scores a MediaWiki page candidate against the canonical location.
   * Ensures high semantic match while rejecting unrelated places or distant homonyms.
   */
  private scoreCandidate(
    candidate: MediaWikiCandidate,
    location: CanonicalLocation,
    stage: 'search' | 'geo' | 'commons'
  ): { confidence: number; matchType: PlaceImageResult['matchType'] } {
    // 1. If candidate has an image, ensure it is not an SVG, flag, icon, or placeholder
    const candidateImg =
      candidate.thumbnail?.source ||
      candidate.original?.source ||
      candidate.customImages?.[0]?.url ||
      '';
    if (candidateImg) {
      const lowerImg = candidateImg.toLowerCase();
      if (
        lowerImg.endsWith('.svg') ||
        lowerImg.includes('.svg/') ||
        lowerImg.includes('flag_of') ||
        lowerImg.includes('symbol') ||
        lowerImg.includes('question_book') ||
        lowerImg.includes('icon') ||
        lowerImg.includes('blank.png') ||
        lowerImg.includes('stub')
      ) {
        if (candidate.source === 'commons') {
          return { confidence: 0, matchType: 'none' };
        }
        // For Wikipedia articles, clear the SVG/placeholder thumbnail so real article photos get resolved
        candidate.thumbnail = undefined;
        candidate.original = undefined;
      }
    }

    const normLoc = normalizePlaceName(location.name);
    const { primaryName, secondaryParts } = extractPlaceComponents(location.name);
    const normPrimary = normalizePlaceName(primaryName);
    const normTitle = normalizePlaceName(candidate.title);
    const candPrimary = normalizePlaceName(candidate.title.split(/[,;\-—|]/)[0].trim());

    if (!normLoc || !normTitle) {
      return { confidence: 0, matchType: 'none' };
    }

    // 1b. FOREIGN GEOGRAPHIC ENTITY REJECTION
    // Completely prevent mismatched photos from distant cities (e.g. Mayapur, Mumbai, Delhi for a Chennai place)
    const locCity = (location.city || '').toLowerCase();
    const locRegion = (location.region || '').toLowerCase();
    const locName = (location.name || '').toLowerCase();
    const candImgLower = candidateImg.toLowerCase();
    for (const cityToken of FOREIGN_CITY_TOKENS) {
      const appearsInCandidate = normTitle.includes(cityToken) || candImgLower.includes(cityToken);
      if (appearsInCandidate && !locCity.includes(cityToken) && !locRegion.includes(cityToken) && !locName.includes(cityToken)) {
        logPhotoResolverDiagnostic({
          locationId: location.id,
          locationName: location.name,
          latitude: location.latitude,
          longitude: location.longitude,
          candidateSource: candidate.source || 'wikipedia',
          candidatePageTitle: candidate.title,
          candidateImageUrl: candidateImg,
          candidateScore: 0,
          nameSimilarity: 0,
          contextMatch: false,
          distance: 'foreign-city-rejected',
          browserImageLoad: 'pending',
          status: 'rejected',
          reason: `Candidate mentions foreign geographic entity "${cityToken}" not matching location "${locCity || 'local'}"`,
        });
        return { confidence: 0, matchType: 'none' };
      }
    }

    // Distance calculation if candidate has coordinates
    let distMeters: number | null = null;
    const hasCoordinates =
      !isNaN(location.latitude) &&
      !isNaN(location.longitude) &&
      location.latitude !== 0 &&
      location.longitude !== 0;

    if (
      candidate.coordinates &&
      candidate.coordinates.length > 0 &&
      hasCoordinates
    ) {
      distMeters = calculateDistanceMeters(
        location.latitude,
        location.longitude,
        candidate.coordinates[0].lat,
        candidate.coordinates[0].lon
      );
    }

    // HARD DISTANCE LIMIT: Reject any candidate located > 35km away from physical place coordinates
    if (distMeters !== null && distMeters > 35000) {
      logPhotoResolverDiagnostic({
        locationId: location.id,
        locationName: location.name,
        latitude: location.latitude,
        longitude: location.longitude,
        candidateSource: candidate.source || 'wikipedia',
        candidatePageTitle: candidate.title,
        candidateImageUrl: candidateImg,
        candidateScore: 0,
        nameSimilarity: 0,
        contextMatch: false,
        distance: `${(distMeters / 1000).toFixed(2)} km`,
        browserImageLoad: 'pending',
        status: 'rejected',
        reason: 'Candidate exceeds 35km distance limit; rejected to prevent distant homonym mismatch',
      });
      return { confidence: 0, matchType: 'none' };
    }

    // 0. CANONICAL LANDMARK ALIAS MATCH (e.g. "ISKCON Temple" near Chennai -> "ISKCON Temple, Chennai")
    const canonicalAlias = CANONICAL_WIKIPEDIA_ALIASES.find((a) => {
      const matchName = a.pattern.test(location.name) || (normLoc && a.pattern.test(normLoc));
      if (!matchName || a.canonicalTitle.toLowerCase() !== candidate.title.toLowerCase()) return false;
      if (a.nearLat !== undefined && a.nearLon !== undefined && hasCoordinates) {
        const d = calculateDistanceMeters(location.latitude, location.longitude, a.nearLat, a.nearLon);
        if (d > (a.maxDistKm || 45) * 1000) return false;
      }
      return true;
    });

    if (canonicalAlias) {
      if (distMeters === null || distMeters <= 35000) {
        logPhotoResolverDiagnostic({
          locationId: location.id,
          locationName: location.name,
          latitude: location.latitude,
          longitude: location.longitude,
          candidateSource: candidate.source || 'wikipedia',
          candidatePageTitle: candidate.title,
          candidateImageUrl: candidateImg,
          candidateScore: 1.0,
          nameSimilarity: 1.0,
          contextMatch: true,
          distance: distMeters !== null ? `${(distMeters / 1000).toFixed(2)} km` : 'verified',
          browserImageLoad: 'pending',
          status: 'accepted',
          reason: 'Exact canonical landmark alias match',
        });
        return { confidence: 1.0, matchType: 'exact-title' };
      }
    }

    // 1. EXACT TITLE MATCH (e.g. "Marina Beach" === "Marina Beach", "Taj Mahal" === "Taj Mahal")
    const isExactMatch =
      normTitle === normLoc ||
      normTitle === normPrimary ||
      candPrimary === normPrimary ||
      candPrimary === normLoc;

    if (isExactMatch) {
      if (distMeters !== null && distMeters > 35000) {
        return { confidence: 0, matchType: 'none' };
      }

      logPhotoResolverDiagnostic({
        locationId: location.id,
        locationName: location.name,
        latitude: location.latitude,
        longitude: location.longitude,
        candidateSource: candidate.source || 'wikipedia',
        candidatePageTitle: candidate.title,
        candidateImageUrl: candidateImg,
        candidateScore: 1.0,
        nameSimilarity: 1.0,
        contextMatch: true,
        distance: distMeters !== null ? `${(distMeters / 1000).toFixed(2)} km` : 'verified',
        browserImageLoad: 'pending',
        status: 'accepted',
        reason: 'Exact title match with verified location context',
      });
      return { confidence: 1.0, matchType: 'exact-title' };
    }

    // Generic category nouns that NEVER serve as distinctive proof of identity
    const genericPlaceNouns = new Set([
      'temple', 'temples', 'mandir', 'kovil', 'church', 'cathedral', 'basilica', 'mosque', 'masjid',
      'gurdwara', 'palace', 'fort', 'beach', 'park', 'garden', 'resort', 'hotel', 'restaurant', 'cafe',
      'bar', 'shop', 'store', 'mall', 'bazaar', 'market', 'station', 'airport', 'bridge', 'tower', 'lake',
      'waterfall', 'zoo', 'aquarium', 'museum', 'monument', 'memorial', 'center', 'centre', 'complex',
      'road', 'street', 'avenue', 'lane', 'drive', 'way', 'nagar', 'colony', 'layout', 'city', 'town',
      'village', 'hall', 'house', 'villa', 'club', 'bank', 'school', 'college', 'university', 'hospital',
      'clinic', 'office', 'building', 'apartment', 'company', 'institute', 'academy', 'primary', 'secondary', 'high',
      '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th',
      '11th', '12th', '13th', '14th', '15th', '16th', '17th', '18th', '19th', '20th',
      'main', 'cross', 'link', 'central', 'north', 'south', 'east', 'west', 'new', 'old'
    ]);

    const stopWords = new Set([
      'and', 'for', 'near', 'the', 'of', 'in', 'at', 'on', 'by', 'to', 'from',
      'sri', 'shri', 'shree', 'saint', 'st', 'lord', 'goddess', 'maa', 'dr', 'mr', 'hotel'
    ]);

    const primaryTokens = normPrimary.split(' ').filter((t) => t.length > 2 && !stopWords.has(t));
    const titleTokens = normTitle.split(' ').filter((t) => t.length > 2 && !stopWords.has(t));
    const distinctPrimaryTokens = primaryTokens.filter((t) => !genericPlaceNouns.has(t));
    const distinctTitleTokens = titleTokens.filter((t) => !genericPlaceNouns.has(t));

    // CRITICAL ANTI-COLLAPSE SAFEGUARD FOR GENERIC STREET / ADDRESS NAMES:
    // If all tokens in the place name are generic place nouns / numbers (e.g. "5th Cross Street 14", "12 Main Road")
    // and candidate is NOT an exact title match (isExactMatch === false),
    // reject candidate to prevent random MediaWiki article matches (e.g. shop pages like "A2Z Travel").
    if (distinctPrimaryTokens.length === 0 && !isExactMatch) {
      logPhotoResolverDiagnostic({
        locationId: location.id,
        locationName: location.name,
        latitude: location.latitude,
        longitude: location.longitude,
        candidateSource: candidate.source || 'wikipedia',
        candidatePageTitle: candidate.title,
        candidateImageUrl: candidateImg,
        candidateScore: 0,
        nameSimilarity: 0,
        contextMatch: false,
        distance: distMeters !== null ? `${(distMeters / 1000).toFixed(2)} km` : 'N/A',
        browserImageLoad: 'pending',
        status: 'rejected',
        reason: 'Generic street/address name without proper noun tokens; rejected to prevent random article matches',
      });
      return { confidence: 0, matchType: 'none' };
    }

    // CRITICAL ANTI-COLLAPSE SAFEGUARD:
    // If both place and candidate have distinctive proper name tokens,
    // they MUST share at least one distinctive token match with high similarity,
    // or satisfy acronym matching, or have physical proximity within 1.5km!
    if (distinctPrimaryTokens.length > 0 && distinctTitleTokens.length > 0) {
      let hasDistinctiveMatch = false;

      // Check 1: Token-to-token similarity
      for (const pt of distinctPrimaryTokens) {
        for (const tt of distinctTitleTokens) {
          if (tokenSimilarity(pt, tt) >= 0.70) {
            hasDistinctiveMatch = true;
            break;
          }
        }
        if (hasDistinctiveMatch) break;
      }

      // Check 2: Acronym matching (e.g. "Indian Institute of Technology" <-> "IIT", "AIIMS", "BITS", "NIT")
      if (!hasDistinctiveMatch) {
        if (
          isAcronymMatch(normPrimary, normTitle) ||
          isAcronymMatch(normTitle, normPrimary) ||
          isAcronymMatch(normLoc, normTitle) ||
          distinctTitleTokens.some((tt) => isAcronymMatch(normPrimary, tt)) ||
          distinctPrimaryTokens.some((pt) => isAcronymMatch(normTitle, pt))
        ) {
          hasDistinctiveMatch = true;
        }
      }

      // Check 3: Physical coordinate co-location within 1.5km
      if (!hasDistinctiveMatch && distMeters !== null && distMeters <= 1500) {
        // If within 1.5km, any shared word proves co-location
        const sharedAny = primaryTokens.some((pt) => titleTokens.some((tt) => tokenSimilarity(pt, tt) >= 0.70));
        if (sharedAny) {
          hasDistinctiveMatch = true;
        }
      }

      if (!hasDistinctiveMatch) {
        logPhotoResolverDiagnostic({
          locationId: location.id,
          locationName: location.name,
          latitude: location.latitude,
          longitude: location.longitude,
          candidateSource: candidate.source || 'wikipedia',
          candidatePageTitle: candidate.title,
          candidateImageUrl: candidateImg,
          candidateScore: 0,
          nameSimilarity: 0,
          contextMatch: false,
          distance: distMeters !== null ? `${(distMeters / 1000).toFixed(2)} km` : 'N/A',
          browserImageLoad: 'pending',
          status: 'rejected',
          reason: 'Distinctive proper names do not match (anti-collapse safeguard)',
        });
        return { confidence: 0, matchType: 'none' };
      }
    }

    // Candidate description/extract context
    const candContext = (
      (candidate.description || '') +
      ' ' +
      (candidate.extract || '') +
      ' ' +
      candidate.title
    ).toLowerCase();

    // 2. SUBSTRING & PREFIX MATCH (e.g. "Brihadisvara Temple, Thanjavur" vs "Brihadisvara Temple")
    const isSubstringMatch =
      (normPrimary.length >= 5 && normTitle.includes(normPrimary)) ||
      (normTitle.length >= 5 && normPrimary.includes(normTitle));

    if (isSubstringMatch) {
      // If coordinates are available, require proximity
      if (distMeters !== null && distMeters <= 35000) {
        logPhotoResolverDiagnostic({
          locationId: location.id,
          locationName: location.name,
          latitude: location.latitude,
          longitude: location.longitude,
          candidateSource: candidate.source || 'wikipedia',
          candidatePageTitle: candidate.title,
          candidateImageUrl: candidateImg,
          candidateScore: 0.98,
          nameSimilarity: 0.98,
          contextMatch: true,
          distance: `${(distMeters / 1000).toFixed(2)} km`,
          browserImageLoad: 'pending',
          status: 'accepted',
          reason: 'High-confidence substring match with verified proximity',
        });
        return { confidence: 0.98, matchType: 'exact-name' };
      }

      // If candidate has NO coordinates:
      if (distMeters === null) {
        const cityOrRegion = (locCity || locRegion || '').toLowerCase();
        if (cityOrRegion && candContext.includes(cityOrRegion)) {
          return { confidence: 0.88, matchType: 'exact-name' };
        }
        // If place has physical coordinates, do NOT allow an un-geocoded candidate to match via simple substring
        if (hasCoordinates) {
          return { confidence: 0.20, matchType: 'none' };
        }
      }
    }

    // 3. TOKEN SIMILARITY & OVERLAP ANALYSIS
    const allLocTokens = (normLoc + ' ' + locCity + ' ' + (location.address || '') + ' ' + secondaryParts.join(' '))
      .split(' ')
      .filter((t) => t.length > 2 && !stopWords.has(t));

    let primaryMatchCount = 0;
    for (const pt of primaryTokens) {
      let bestSim = 0;
      for (const tt of titleTokens) {
        const sim = tokenSimilarity(pt, tt);
        if (sim > bestSim) bestSim = sim;
      }
      if (bestSim >= 0.70) primaryMatchCount += bestSim;
    }
    const primaryRecall = primaryTokens.length > 0 ? primaryMatchCount / primaryTokens.length : 0;

    let titleMatchInLoc = 0;
    for (const tt of titleTokens) {
      let bestSim = 0;
      for (const lt of allLocTokens) {
        const sim = tokenSimilarity(tt, lt);
        if (sim > bestSim) bestSim = sim;
      }
      if (bestSim >= 0.70) titleMatchInLoc += bestSim;
    }
    const titleCoverage = titleTokens.length > 0 ? titleMatchInLoc / titleTokens.length : 0;

    let score = Math.max(primaryRecall, titleCoverage) * 0.85;

    // Geographic distance adjustments
    if (distMeters !== null) {
      if (distMeters <= 1000) {
        score += 0.25;
      } else if (distMeters <= 4000) {
        score += 0.15;
      } else if (distMeters <= 10000) {
        score += 0.05;
      } else if (distMeters > 50000) {
        score -= 0.60;
      } else if (distMeters > 20000) {
        score -= 0.40;
      }
    } else if (hasCoordinates && stage !== 'commons') {
      // Penalty for non-geocoded Wikipedia candidate when physical place coordinates exist
      const city = locCity;
      if (city && candContext.includes(city)) {
        score += 0.05;
      } else {
        score -= 0.60;
      }
    }

    if (stage === 'commons') {
      if (primaryRecall >= 0.70 || titleCoverage >= 0.70) {
        score = Math.max(score, 0.85);
      }
    }

    const finalConf = Math.min(0.96, Math.max(0, score));
    const isAccepted = finalConf >= MIN_IMAGE_MATCH_CONFIDENCE;

    logPhotoResolverDiagnostic({
      locationId: location.id,
      locationName: location.name,
      latitude: location.latitude,
      longitude: location.longitude,
      candidateSource: stage === 'commons' ? 'commons' : 'wikipedia',
      candidatePageTitle: candidate.title,
      candidateImageUrl: candidateImg,
      candidateScore: finalConf,
      nameSimilarity: Math.max(primaryRecall, titleCoverage),
      contextMatch: Boolean(locCity && candContext.includes(locCity)),
      distance: distMeters !== null ? `${(distMeters / 1000).toFixed(2)} km` : 'N/A',
      browserImageLoad: 'pending',
      status: isAccepted ? 'accepted' : 'rejected',
      reason: isAccepted
        ? `Verified match (${(finalConf * 100).toFixed(0)}%) via ${stage}`
        : `Confidence too low (${(finalConf * 100).toFixed(0)}%)`,
    });

    if (!isAccepted) {
      return { confidence: 0, matchType: 'none' };
    }

    const matchType: PlaceImageResult['matchType'] =
      stage === 'geo'
        ? 'coordinate-match'
        : stage === 'commons'
        ? 'commons-match'
        : 'exact-name';

    return { confidence: finalConf, matchType };
  }

  /**
   * Safe fetch with standard MediaWiki headers and abort signal.
   */
  private async fetchApi(url: string, signal?: AbortSignal): Promise<any> {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'MaplyApp/2.0 (https://maply.app; contact@maply.app)',
          'Api-User-Agent': 'MaplyApp/2.0 (https://maply.app; contact@maply.app)',
        },
        signal,
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
      return null;
    }
  }

  private isSvgOrIconUrl(url?: string): boolean {
    if (!url) return true;
    const lower = url.toLowerCase();
    return (
      lower.endsWith('.svg') ||
      lower.includes('.svg/') ||
      lower.includes('flag_of') ||
      lower.includes('symbol') ||
      lower.includes('question_book') ||
      lower.includes('icon') ||
      lower.includes('blank.png') ||
      lower.includes('stub')
    );
  }

  /**
   * Sorts candidate photo files to prefer exterior, campus, and landmark views over fauna/diagrams
   */
  private rankPhotoFiles(fileTitles: string[], placeName: string): string[] {
    const tokens = placeName
      .toLowerCase()
      .split(/[\s,\-_–—|/:\\]+/)
      .filter((t) => t.length > 2);
    const preferredTerms = [
      'campus', 'building', 'front', 'main', 'view', 'aerial', 'temple', 'palace',
      'monument', 'memorial', 'facade', 'entrance', 'hall', 'gate', 'tower',
      'exterior', 'overview', 'panoramic', ...tokens
    ];

    return fileTitles.slice().sort((a, b) => {
      const la = a.toLowerCase();
      const lb = b.toLowerCase();
      let scoreA = 0;
      let scoreB = 0;
      for (const t of preferredTerms) {
        if (la.includes(t)) scoreA += 3;
        if (lb.includes(t)) scoreB += 3;
      }
      const isWildlifePlace = /zoo|park|sanctuary|forest|garden|wildlife|animal|snake/i.test(placeName);
      if (!isWildlifePlace) {
        if (/blackbuck|deer|bird|snake|squirrel|monkey|frog|insect/i.test(la)) scoreA -= 4;
        if (/blackbuck|deer|bird|snake|squirrel|monkey|frog|insect/i.test(lb)) scoreB -= 4;
      }
      return scoreB - scoreA;
    });
  }

  /**
   * Fetches article body photos from MediaWiki when pageimages has no thumbnail.
   */
  private async resolveArticleImage(
    title: string,
    placeName: string,
    signal?: AbortSignal,
    existingImages?: Array<{ title: string }>
  ): Promise<{ source: string; width: number; height: number; title: string; attribution: string } | null> {
    try {
      let fileTitles: string[] = [];
      if (existingImages && existingImages.length > 0) {
        fileTitles = existingImages.map((img) => img.title);
      } else {
        const url = `${WIKIPEDIA_API}?action=query&format=json&origin=*&titles=${encodeURIComponent(
          title
        )}&prop=images&imlimit=20`;
        const data = await this.fetchApi(url, signal);
        const page = Object.values(data?.query?.pages ?? {})[0] as any;
        if (page?.images && Array.isArray(page.images)) {
          fileTitles = page.images.map((img: { title: string }) => img.title);
        }
      }

      if (fileTitles.length === 0) return null;

      const ranked = this.rankPhotoFiles(fileTitles, placeName);
      const photos = await this.fetchImageInfo(ranked, placeName, signal);
      if (photos.length > 0) {
        return {
          source: photos[0].url,
          width: photos[0].width || 1280,
          height: photos[0].height || 800,
          title: photos[0].sourceTitle || title,
          attribution: photos[0].attribution || `Photo via Wikipedia — "${title}"`,
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Fetches multiple high-resolution photos for a set of file titles from MediaWiki.
   */
  private async fetchImageInfo(
    fileTitles: string[],
    placeName?: string,
    signal?: AbortSignal
  ): Promise<PlaceImage[]> {
    if (fileTitles.length === 0) return [];

    const cleanFiles = fileTitles
      .filter((f) => {
        const lf = f.toLowerCase();
        return (
          (lf.endsWith('.jpg') || lf.endsWith('.jpeg') || lf.endsWith('.png') || lf.endsWith('.webp')) &&
          !lf.includes('flag_of') &&
          !lf.includes('icon') &&
          !lf.includes('symbol') &&
          !lf.includes('question_book') &&
          !lf.includes('stub') &&
          !lf.includes('pfeil') &&
          !lf.includes('logo')
        );
      });

    const rankedFiles = placeName
      ? this.rankPhotoFiles(cleanFiles, placeName).slice(0, 5)
      : cleanFiles.slice(0, 5);

    if (rankedFiles.length === 0) return [];

    const url = `${WIKIPEDIA_API}?action=query&format=json&origin=*&titles=${rankedFiles
      .map(encodeURIComponent)
      .join('|')}&prop=imageinfo&iiprop=url|size|extmetadata|user|mime&iiurlwidth=1280`;

    const data = await this.fetchApi(url, signal);
    if (!data?.query?.pages) return [];

    const results: PlaceImage[] = [];
    for (const page of Object.values(data.query.pages) as any[]) {
      if (page.imageinfo && page.imageinfo.length > 0) {
        const ii = page.imageinfo[0];
        const title = page.title.replace(/^File:/i, '').replace(/_/g, ' ');
        const artist =
          ii.extmetadata?.Artist?.value?.replace(/<[^>]*>/g, '') ||
          ii.user ||
          'Wikimedia Contributor';
        const license = ii.extmetadata?.LicenseShortName?.value || 'CC BY-SA';
        const safeUrl = ii.thumburl || ii.url;

        results.push({
          url: safeUrl,
          thumbnailUrl: safeUrl,
          width: ii.thumbwidth || ii.width,
          height: ii.thumbheight || ii.height,
          alt: title,
          source: 'wikimedia',
          sourcePageUrl: ii.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
          sourceTitle: title,
          author: artist,
          license,
          attribution: `Photo: ${title} (${artist}, ${license})`,
        });
      }
    }

    return results;
  }

  /**
   * Generates highest-confidence exact titles and common landmark synonyms for the Fast Path.
   */
  private getFastPathCandidateTitles(location: CanonicalLocation): string[] {
    const titles: string[] = [];
    const raw = (location.name || '').trim();
    if (!raw) return [];

    const { primaryName, secondaryParts } = extractPlaceComponents(raw);

    // 1. Primary name (e.g. "Marina Beach")
    if (primaryName && !titles.includes(primaryName)) {
      titles.push(primaryName);
    }

    // 2. Clean name with hyphens, en-dashes, slashes replaced with spaces
    const cleanDashes = raw
      .replace(/[\u2010-\u2015\-_–—|/:\\]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleanDashes && !titles.includes(cleanDashes)) {
      titles.push(cleanDashes);
    }

    // 3. Full raw name if different
    if (raw !== primaryName && !titles.includes(raw)) {
      titles.push(raw);
    }

    // 4. Common Acronym Variations (e.g. "IIT Madras", "AIIMS", "CSMT")
    const acronymVariants = generateAcronymVariations(raw);
    for (const av of acronymVariants) {
      if (!titles.includes(av)) {
        titles.push(av);
      }
    }

    // 5. Primary name + city
    const city = location.city || secondaryParts[0];
    if (city && primaryName && !primaryName.toLowerCase().includes(city.toLowerCase())) {
      const withCity = `${primaryName}, ${city}`;
      if (!titles.includes(withCity)) titles.push(withCity);
    }

    // 6. Strip honorific prefixes: Sri, Shri, Shree, The, Saint, St
    const stripped = primaryName.replace(/^(sri|shri|shree|the|saint|st\.?)\s+/i, '').trim();
    if (stripped && stripped !== primaryName && !titles.includes(stripped)) {
      titles.push(stripped);
      if (city) {
        titles.push(`${stripped}, ${city}`);
      }
    }

    // 7. Canonical Aliases for landmarks
    const norm = raw.toLowerCase();
    const hasCoordinates =
      !isNaN(location.latitude) &&
      !isNaN(location.longitude) &&
      location.latitude !== 0 &&
      location.longitude !== 0;

    for (const alias of CANONICAL_WIKIPEDIA_ALIASES) {
      if (
        alias.pattern.test(norm) ||
        (primaryName && alias.pattern.test(primaryName.toLowerCase())) ||
        (cleanDashes && alias.pattern.test(cleanDashes.toLowerCase()))
      ) {
        if (alias.nearLat !== undefined && alias.nearLon !== undefined && hasCoordinates) {
          const dist = calculateDistanceMeters(location.latitude, location.longitude, alias.nearLat, alias.nearLon);
          if (dist > (alias.maxDistKm || 45) * 1000) {
            continue; // Not in this city/region
          }
        }
        if (!titles.includes(alias.canonicalTitle)) {
          titles.push(alias.canonicalTitle);
        }
      }
    }

    return titles.slice(0, 10);
  }

  /**
   * Phase 1 Fast Path: Exact MediaWiki PageImages query for candidate titles in a single HTTP request.
   * Resolves in ~100-150ms for landmarks with known Wikipedia articles.
   */
  private async resolveFastPath(
    location: CanonicalLocation,
    signal?: AbortSignal
  ): Promise<{ candidate: MediaWikiCandidate; confidence: number; matchType: PlaceImageResult['matchType'] } | null> {
    const titles = this.getFastPathCandidateTitles(location);
    if (titles.length === 0) return null;

    const url = `${WIKIPEDIA_API}?action=query&format=json&origin=*&formatversion=2&prop=pageimages|coordinates|info|description|extracts|images&piprop=thumbnail|original&pithumbsize=1280&imlimit=15&inprop=url&redirects=1&titles=${titles
      .map(encodeURIComponent)
      .join('|')}`;

    const data = await this.fetchApi(url, signal);
    if (signal?.aborted || !data?.query?.pages) return null;

    const pages: MediaWikiCandidate[] = Object.values(data.query.pages);
    let bestCandidate: MediaWikiCandidate | null = null;
    let highestConfidence = 0;
    let bestMatchType: PlaceImageResult['matchType'] = 'none';

    for (const page of pages) {
      if (!page || (page as any).missing || page.pageid === undefined || page.pageid <= 0) continue;

      const { confidence, matchType } = this.scoreCandidate(page, location, 'search');
      if (confidence > highestConfidence) {
        // If thumbnail is missing from pageimages or is an SVG/logo/icon, attempt article body resolution
        const thumb = page.thumbnail?.source || page.original?.source || '';
        if (!thumb || this.isSvgOrIconUrl(thumb)) {
          const articleImg = await this.resolveArticleImage(page.title, location.name, signal, page.images);
          if (articleImg) {
            page.customImages = [
              {
                url: articleImg.source,
                thumbnailUrl: articleImg.source,
                width: articleImg.width,
                height: articleImg.height,
                alt: `${location.name} (Photo via Wikimedia: ${articleImg.title})`,
                source: 'wikimedia',
                sourcePageUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
                sourceTitle: articleImg.title,
                author: 'Wikimedia Contributor',
                license: 'CC BY-SA',
                attribution: articleImg.attribution,
              },
            ];
          } else {
            continue; // Skip candidates without a photographic image
          }
        }
        highestConfidence = confidence;
        bestCandidate = page;
        bestMatchType = matchType;
      }
    }

    if (highestConfidence >= MIN_IMAGE_MATCH_CONFIDENCE && bestCandidate) {
      return { candidate: bestCandidate, confidence: highestConfidence, matchType: bestMatchType };
    }

    return null;
  }

  /**
   * Progressive Wikimedia photo resolution:
   * 1. Checks memory & localStorage cache for zero-delay instant display.
   * 2. Runs Phase 1 (Fast Path): Exact MediaWiki pageimages in ONE single network request.
   *    If found, invokes onCandidateFound immediately and returns so the browser can load the image right away.
   * 3. Runs Phase 2 (Fallback): Multi-search, geosearch, commons.
   *    Invokes onCandidateFound with the first valid candidate discovered.
   */
  async resolveImagesProgressive(
    location: CanonicalLocation,
    onCandidateFound?: (image: PlaceImage, title?: string) => void,
    signal?: AbortSignal
  ): Promise<PlaceImageResult> {
    if (!location || !location.name) {
      return { images: [], confidence: 0, matchType: 'none' };
    }

    // 1. In-memory & LocalStorage cache check
    const cacheKey = this.getCacheKey(location);
    const cached = this.getCachedResult(location);
    if (cached && cached.images.length > 0) {
      onCandidateFound?.(cached.images[0], cached.matchedPageTitle);
      return cached;
    }

    try {
      // 2. PHASE 1: Fast Path exact query (~100-150ms)
      const fastMatch = await this.resolveFastPath(location, signal);
      if (signal?.aborted) return { images: [], confidence: 0, matchType: 'none' };

      if (fastMatch && fastMatch.candidate) {
        const cleanTitle = fastMatch.candidate.title.replace(/^File:/i, '').replace(/_/g, ' ');
        const primaryImage: PlaceImage = fastMatch.candidate.customImages?.[0] || {
          url: fastMatch.candidate.thumbnail?.source || fastMatch.candidate.original?.source || '',
          thumbnailUrl: fastMatch.candidate.thumbnail?.source || fastMatch.candidate.original?.source || '',
          width: fastMatch.candidate.thumbnail?.width || fastMatch.candidate.original?.width || 1280,
          height: fastMatch.candidate.thumbnail?.height || fastMatch.candidate.original?.height || 800,
          alt: `${location.name} (Photo via Wikimedia: ${cleanTitle})`,
          source: 'wikimedia',
          sourcePageUrl:
            fastMatch.candidate.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(fastMatch.candidate.title)}`,
          sourceTitle: cleanTitle,
          author: 'Wikimedia Contributor',
          license: 'CC BY-SA',
          attribution: `Photo via Wikipedia — "${cleanTitle}"`,
        };

        const primaryUrl = primaryImage.url;

        // IMMEDIATELY notify UI! Browser starts loading and displays this image without waiting!
        onCandidateFound?.(primaryImage, cleanTitle);

        const candidatesList = [primaryImage];
        if (
          fastMatch.candidate.original?.source &&
          fastMatch.candidate.original.source !== primaryUrl &&
          /\.(jpe?g|png|webp)($|\?)/i.test(fastMatch.candidate.original.source)
        ) {
          candidatesList.push({
            ...primaryImage,
            url: fastMatch.candidate.original.source,
          });
        }

        const fastResult: PlaceImageResult = {
          images: candidatesList,
          matchedPageTitle: cleanTitle,
          matchedPageUrl: fastMatch.candidate.fullurl,
          matchedExtract: fastMatch.candidate.extract,
          confidence: fastMatch.confidence,
          matchType: fastMatch.matchType,
        };

        this.cache.set(cacheKey, fastResult);
        if (location.id) this.cache.set(location.id, fastResult);

        return fastResult;
      }

      // -------------------------------------------------------------
      // PHASE 2: FALLBACK DISCOVERY PIPELINE
      // -------------------------------------------------------------
      // STAGE 1: PROGRESSIVE GEOSEARCH (PRIORITY FOR GEOLOCATED PLACES)
      // Checks immediate physical proximity (1km, 3.5km, 8km) to find the exact local article
      const isRoadOrStreet =
        /^\d*(st|nd|rd|th)?\s*(main|cross)?\s*(road|street|ave|avenue|lane|drive|way|rd|st)\b/i.test(location.name);
      const hasCoordinates =
        !isNaN(location.latitude) &&
        !isNaN(location.longitude) &&
        location.latitude !== 0 &&
        location.longitude !== 0;

      if (!isRoadOrStreet && hasCoordinates) {
        const radii = [1000, 3500, 8000];
        for (const radius of radii) {
          if (signal?.aborted) return { images: [], confidence: 0, matchType: 'none' };

          const geoUrl = `${WIKIPEDIA_API}?action=query&format=json&origin=*&list=geosearch&gscoord=${location.latitude}|${location.longitude}&gsradius=${radius}&gslimit=8`;
          const geoData = await this.fetchApi(geoUrl, signal);

          const geoTitles = (geoData?.query?.geosearch || []).map((g: any) => g.title);
          if (geoTitles.length > 0) {
            const geoHydrateUrl = `${WIKIPEDIA_API}?action=query&format=json&origin=*&titles=${geoTitles
              .map(encodeURIComponent)
              .join('|')}&prop=pageimages|coordinates|info|description|extracts|images&piprop=thumbnail|original&pithumbsize=1280&imlimit=8&exintro=1&explaintext=1&exchars=400&inprop=url&redirects=1`;

            const ghData = await this.fetchApi(geoHydrateUrl, signal);
            if (ghData?.query?.pages) {
              const pages: MediaWikiCandidate[] = Object.values(ghData.query.pages);
              let bestGeoCandidate: MediaWikiCandidate | null = null;
              let highestGeoConfidence = 0;
              let bestGeoMatchType: PlaceImageResult['matchType'] = 'none';

              for (const page of pages) {
                const { confidence, matchType } = this.scoreCandidate(page, location, 'geo');
                if (confidence > highestGeoConfidence) {
                  const thumb = page.thumbnail?.source || page.original?.source || '';
                  if (!thumb || this.isSvgOrIconUrl(thumb)) {
                    const articleImg = await this.resolveArticleImage(page.title, location.name, signal, page.images);
                    if (articleImg) {
                      page.customImages = [
                        {
                          url: articleImg.source,
                          thumbnailUrl: articleImg.source,
                          width: articleImg.width,
                          height: articleImg.height,
                          alt: `${location.name} (Photo via Wikimedia: ${articleImg.title})`,
                          source: 'wikimedia',
                          sourcePageUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
                          sourceTitle: articleImg.title,
                          author: 'Wikimedia Contributor',
                          license: 'CC BY-SA',
                          attribution: articleImg.attribution,
                        },
                      ];
                    } else {
                      continue; // Skip if no photo available
                    }
                  }
                  highestGeoConfidence = confidence;
                  bestGeoCandidate = page;
                  bestGeoMatchType = matchType;
                }
              }

              if (highestGeoConfidence >= MIN_IMAGE_MATCH_CONFIDENCE && bestGeoCandidate) {
                const result = await this.buildImageResult(
                  bestGeoCandidate,
                  highestGeoConfidence,
                  bestGeoMatchType,
                  location,
                  signal
                );
                if (result.images.length > 0) {
                  onCandidateFound?.(result.images[0], result.matchedPageTitle);
                  this.cache.set(cacheKey, result);
                  if (location.id) this.cache.set(location.id, result);
                  return result;
                }
              }
            }
          }
        }
      }

      // -------------------------------------------------------------
      // STAGE 2: WIKIPEDIA TEXT SEARCH WITH CITY-QUALIFIED QUERIES
      // -------------------------------------------------------------
      const candidateTitles: string[] = [];
      let discoveredSuggestion: string | null = null;

      const city = location.city || (location.name.includes(',') ? location.name.split(',')[1].trim() : '');
      const searchQueries: string[] = [];
      if (city && !location.name.toLowerCase().includes(city.toLowerCase())) {
        searchQueries.push(`${location.name} ${city}`);
      }
      searchQueries.push(location.name);

      const strippedPrefix = location.name.replace(/\b(sri|shri|shree|maa|the|saint|st)\s+/gi, '').trim();
      if (strippedPrefix && strippedPrefix !== location.name) {
        if (city) searchQueries.push(`${strippedPrefix} ${city}`);
        searchQueries.push(strippedPrefix);
      }
      if (location.name.includes(',')) {
        const primaryPart = location.name.split(',')[0].trim();
        if (primaryPart && !searchQueries.includes(primaryPart)) {
          if (city) searchQueries.push(`${primaryPart} ${city}`);
          searchQueries.push(primaryPart);
        }
      }

      for (const sq of Array.from(new Set(searchQueries)).slice(0, 3)) {
        if (signal?.aborted) return { images: [], confidence: 0, matchType: 'none' };
        const primaryUrl = `${WIKIPEDIA_API}?action=query&format=json&origin=*&list=search&srsearch=${encodeURIComponent(
          sq
        )}&srlimit=5`;

        const pData = await this.fetchApi(primaryUrl, signal);
        if (pData?.query?.search) {
          for (const item of pData.query.search) {
            candidateTitles.push(item.title);
          }
        }

        // Check if MediaWiki suggested a spelling correction
        if (pData?.query?.searchinfo?.suggestion && !discoveredSuggestion) {
          discoveredSuggestion = pData.query.searchinfo.suggestion;
          const sugUrl = `${WIKIPEDIA_API}?action=query&format=json&origin=*&list=search&srsearch=${encodeURIComponent(
            discoveredSuggestion
          )}&srlimit=5`;
          const sugData = await this.fetchApi(sugUrl, signal);
          if (sugData?.query?.search) {
            for (const item of sugData.query.search) {
              candidateTitles.push(item.title);
            }
          }
        }
      }

      const uniqueTitles = Array.from(new Set(candidateTitles)).slice(0, 10);
      let bestCandidate: MediaWikiCandidate | null = null;
      let highestConfidence = 0;
      let bestMatchType: PlaceImageResult['matchType'] = 'none';

      // Hydrate all candidate Wikipedia articles in ONE batched request
      if (uniqueTitles.length > 0) {
        const hydrateUrl = `${WIKIPEDIA_API}?action=query&format=json&origin=*&titles=${uniqueTitles
          .map(encodeURIComponent)
          .join('|')}&prop=pageimages|coordinates|info|description|extracts|images&piprop=thumbnail|original&pithumbsize=1280&imlimit=10&exintro=1&explaintext=1&exchars=400&inprop=url&redirects=1`;

        const hData = await this.fetchApi(hydrateUrl, signal);
        if (signal?.aborted) return { images: [], confidence: 0, matchType: 'none' };

        if (hData?.query?.pages) {
          const pages: MediaWikiCandidate[] = Object.values(hData.query.pages);
          for (const page of pages) {
            const { confidence, matchType } = this.scoreCandidate(page, location, 'search');
            if (confidence > highestConfidence) {
              const thumb = page.thumbnail?.source || page.original?.source || '';
              if (!thumb || this.isSvgOrIconUrl(thumb)) {
                const articleImg = await this.resolveArticleImage(page.title, location.name, signal, page.images);
                if (articleImg) {
                  page.customImages = [
                    {
                      url: articleImg.source,
                      thumbnailUrl: articleImg.source,
                      width: articleImg.width,
                      height: articleImg.height,
                      alt: `${location.name} (Photo via Wikimedia: ${articleImg.title})`,
                      source: 'wikimedia',
                      sourcePageUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
                      sourceTitle: articleImg.title,
                      author: 'Wikimedia Contributor',
                      license: 'CC BY-SA',
                      attribution: articleImg.attribution,
                    },
                  ];
                } else {
                  continue; // Skip if no photo available
                }
              }
              highestConfidence = confidence;
              bestCandidate = page;
              bestMatchType = matchType;
            }
          }
        }
      }

      // If Stage 2 found a confident match with image
      if (highestConfidence >= MIN_IMAGE_MATCH_CONFIDENCE && bestCandidate) {
        const result = await this.buildImageResult(
          bestCandidate,
          highestConfidence,
          bestMatchType,
          location,
          signal
        );
        if (result.images.length > 0) {
          onCandidateFound?.(result.images[0], result.matchedPageTitle);
          this.cache.set(cacheKey, result);
          if (location.id) this.cache.set(location.id, result);
          return result;
        }
      }

      // -------------------------------------------------------------
      // STAGE 3: WIKIMEDIA COMMONS MEDIA SEARCH
      // -------------------------------------------------------------
      const commonsQueries = [
        location.name,
        location.city ? `${location.name} ${location.city}` : null,
        discoveredSuggestion,
        bestCandidate?.title,
      ].filter(Boolean) as string[];

      for (const cq of Array.from(new Set(commonsQueries))) {
        if (signal?.aborted) return { images: [], confidence: 0, matchType: 'none' };

        const commonsUrl = `${COMMONS_API}?action=query&format=json&origin=*&generator=search&gsrsearch=${encodeURIComponent(
          cq
        )}&gsrnamespace=6&gsrlimit=6&prop=imageinfo&iiprop=url|size|extmetadata|user|mime&iiurlwidth=1280`;

        const cData = await this.fetchApi(commonsUrl, signal);
        if (cData?.query?.pages) {
          const pages = Object.values(cData.query.pages) as any[];
          for (const page of pages) {
            if (page.imageinfo && page.imageinfo.length > 0) {
              const ii = page.imageinfo[0];
              const safeThumb = ii.thumburl || ii.url;
              const candidate: MediaWikiCandidate = {
                pageid: page.pageid,
                title: page.title.replace(/^File:/i, ''),
                thumbnail: {
                  source: safeThumb,
                  width: ii.thumbwidth || ii.width || 1280,
                  height: ii.thumbheight || ii.height || 800,
                },
                original: {
                  source: safeThumb,
                  width: ii.width,
                  height: ii.height,
                },
                fullurl: ii.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
                source: 'commons',
              };

              const { confidence, matchType } = this.scoreCandidate(candidate, location, 'commons');
              if (confidence > highestConfidence) {
                highestConfidence = confidence;
                bestCandidate = candidate;
                bestMatchType = matchType;
              }
            }
          }
        }

        if (highestConfidence >= MIN_IMAGE_MATCH_CONFIDENCE && bestCandidate) {
          const result = await this.buildImageResult(
            bestCandidate,
            highestConfidence,
            bestMatchType,
            location,
            signal
          );
          if (result.images.length > 0) {
            onCandidateFound?.(result.images[0], result.matchedPageTitle);
          }
          this.cache.set(cacheKey, result);
          if (location.id) this.cache.set(location.id, result);
          return result;
        }
      }

      // -------------------------------------------------------------
      // NO CONFIDENT IMAGE FOUND
      // Return empty images array honestly. Never show incorrect photo.
      // -------------------------------------------------------------
      const emptyResult: PlaceImageResult = {
        images: [],
        confidence: 0,
        matchType: 'none',
      };
      this.cache.set(cacheKey, emptyResult);
      if (location.id) this.cache.set(location.id, emptyResult);
      return emptyResult;
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return { images: [], confidence: 0, matchType: 'none' };
      }
      console.warn('WikimediaImageService resolution error:', err);
      return { images: [], confidence: 0, matchType: 'none' };
    }
  }

  /**
   * Resolves verified Wikimedia photography for a canonical location.
   */
  async resolveImages(
    location: CanonicalLocation,
    signal?: AbortSignal
  ): Promise<PlaceImageResult> {
    return this.resolveImagesProgressive(location, undefined, signal);
  }

  /**
   * Formats PlaceImageResult with primary image and any additional article photos.
   */
  private async buildImageResult(
    candidate: MediaWikiCandidate,
    confidence: number,
    matchType: PlaceImageResult['matchType'],
    location: CanonicalLocation,
    signal?: AbortSignal
  ): Promise<PlaceImageResult> {
    const cleanTitle = candidate.title.replace(/^File:/i, '').replace(/_/g, ' ');

    const hasValidCustom =
      candidate.customImages &&
      candidate.customImages.length > 0 &&
      !this.isSvgOrIconUrl(candidate.customImages[0].url);

    const thumbUrl = candidate.thumbnail?.source || candidate.original?.source || '';
    const hasValidThumb = thumbUrl && !this.isSvgOrIconUrl(thumbUrl);

    let primaryImage: PlaceImage | null = null;
    if (hasValidCustom) {
      primaryImage = candidate.customImages![0];
    } else if (hasValidThumb) {
      primaryImage = {
        url: thumbUrl,
        thumbnailUrl: thumbUrl,
        width: candidate.thumbnail?.width || candidate.original?.width || 1280,
        height: candidate.thumbnail?.height || candidate.original?.height || 800,
        alt: `${location.name} (Photo via Wikimedia: ${cleanTitle})`,
        source: 'wikimedia',
        sourcePageUrl:
          candidate.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(candidate.title)}`,
        sourceTitle: cleanTitle,
        author: 'Wikimedia Contributor',
        license: 'CC BY-SA',
        attribution: `Photo via Wikipedia — "${cleanTitle}"`,
      };
    } else {
      // Resolve from article images if possible
      const articleImg = await this.resolveArticleImage(candidate.title, location.name, signal, candidate.images);
      if (articleImg) {
        primaryImage = {
          url: articleImg.source,
          thumbnailUrl: articleImg.source,
          width: articleImg.width,
          height: articleImg.height,
          alt: `${location.name} (Photo via Wikimedia: ${articleImg.title})`,
          source: 'wikimedia',
          sourcePageUrl:
            candidate.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(candidate.title)}`,
          sourceTitle: articleImg.title,
          author: 'Wikimedia Contributor',
          license: 'CC BY-SA',
          attribution: articleImg.attribution,
        };
      }
    }

    if (!primaryImage) {
      return { images: [], confidence: 0, matchType: 'none' };
    }

    const primaryUrl = primaryImage.url;
    const allImages: PlaceImage[] = [primaryImage];

    // Priority 2: Original source image as candidate fallback if it is a standard web image and differs from thumbnail
    if (
      candidate.original?.source &&
      candidate.original.source !== primaryUrl &&
      !this.isSvgOrIconUrl(candidate.original.source) &&
      /\.(jpe?g|png|webp)($|\?)/i.test(candidate.original.source)
    ) {
      allImages.push({
        ...primaryImage,
        url: candidate.original.source,
      });
    }

    // Priority 3..N: Additional verified photos from article images
    if (candidate.images && candidate.images.length > 0) {
      try {
        const fileNames = candidate.images.map((img) => img.title);
        const extraPhotos = await this.fetchImageInfo(fileNames, location.name, signal);
        for (const ep of extraPhotos) {
          if (!allImages.some((existing) => existing.url === ep.url)) {
            allImages.push({
              ...ep,
              alt: `${location.name} (Photo via Wikimedia: ${ep.sourceTitle || cleanTitle})`,
            });
          }
        }
      } catch {
        // Non-blocking extra photos fetch
      }
    }

    return {
      images: allImages,
      matchedPageTitle: cleanTitle,
      matchedPageUrl: candidate.fullurl,
      matchedExtract: candidate.extract,
      confidence,
      matchType,
    };
  }
}

export const wikimediaImageService = new WikimediaImageService();
