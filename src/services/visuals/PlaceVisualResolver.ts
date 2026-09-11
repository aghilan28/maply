/**
 * Maply — Central Place Visual Resolution Orchestrator
 * 
 * Coordinates all visual enrichment providers in STRICT hierarchy:
 * 
 *     1. WIKIMEDIA (PRIMARY PROVIDER — ALWAYS FIRST)
 *              ↓
 *     2. FOURSQUARE (SECONDARY PLACE-PHOTO PROVIDER — ONLY IF WIKIMEDIA FAILS & CONFIGURED)
 *              ↓
 *     3. OFFICIAL BRAND VISUAL (VERIFIED BRAND / LOGO FALLBACK)
 *              ↓
 *     4. MAPBOX CATEGORY / MAKI ICON (METADATA FALLBACK)
 *              ↓
 *     5. NULL (PHOTO UNAVAILABLE)
 * 
 * ABSOLUTE ARCHITECTURAL RULES:
 * - NEVER let a secondary provider replace a suitable Wikimedia image.
 * - NEVER let visual resolution mutate canonical location coordinates or place name.
 * - Monotonic request ID & AbortSignal guards against race conditions and stale requests.
 */

import {
  PlaceVisual,
  PlaceVisualContext,
  PlaceVisualProvider,
} from '../../types/visual';
import {
  wikimediaVisualProvider,
  WikimediaVisualProvider,
} from './providers/WikimediaVisualProvider';
import {
  foursquareVisualProvider,
  FoursquareVisualProvider,
} from './providers/FoursquareVisualProvider';
import {
  officialBrandVisualProvider,
  OfficialBrandVisualProvider,
} from './providers/OfficialBrandVisualProvider';
import {
  mapboxVisualProvider,
  MapboxVisualProvider,
} from './providers/MapboxVisualProvider';
import {
  logVisualResolutionDiagnostic,
  ProviderDiagnosticLog,
} from './utils/visualLogger';

export interface VisualResolverOptions {
  enableCache?: boolean;
  onProgressiveVisual?: (visual: PlaceVisual) => void;
  signal?: AbortSignal;
}

export class PlaceVisualResolver {
  private wikimediaProvider: WikimediaVisualProvider;
  private foursquareProvider: FoursquareVisualProvider;
  private officialProvider: OfficialBrandVisualProvider;
  private mapboxProvider: MapboxVisualProvider;

  // In-memory cache for resolved visuals: key -> PlaceVisual
  private cache = new Map<string, PlaceVisual>();

  constructor(
    wikimedia = wikimediaVisualProvider,
    foursquare = foursquareVisualProvider,
    official = officialBrandVisualProvider,
    mapbox = mapboxVisualProvider
  ) {
    this.wikimediaProvider = wikimedia;
    this.foursquareProvider = foursquare;
    this.officialProvider = official;
    this.mapboxProvider = mapbox;
  }

  public getCacheKey(context: PlaceVisualContext): string {
    const lat = isNaN(context.latitude) ? '0.00' : context.latitude.toFixed(4);
    const lng = isNaN(context.longitude) ? '0.00' : context.longitude.toFixed(4);
    const norm = (context.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${context.locationId || ''}_${lat}_${lng}_${norm}`;
  }

  public getCachedVisual(context: PlaceVisualContext): PlaceVisual | null {
    if (!context) return null;
    const key = this.getCacheKey(context);
    return this.cache.get(key) || null;
  }

  public cacheVisual(context: PlaceVisualContext, visual: PlaceVisual) {
    if (!context || !visual) return;
    const key = this.getCacheKey(context);
    this.cache.set(key, visual);
    if (context.locationId) {
      this.cache.set(context.locationId, visual);
    }
    // Limit cache size to 150 items
    if (this.cache.size > 150) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
  }

  /**
   * Main sequential orchestrator enforcing strict provider priority.
   */
  async resolvePlaceVisual(
    context: PlaceVisualContext,
    options: VisualResolverOptions = {}
  ): Promise<PlaceVisual | null> {
    const { enableCache = true, onProgressiveVisual, signal } = options;
    const diagnosticLogs: ProviderDiagnosticLog[] = [];

    if (!context || !context.name) {
      return null;
    }

    // 0. FAST CACHE CHECK
    if (enableCache) {
      const cached = this.getCachedVisual(context);
      if (cached) {
        onProgressiveVisual?.(cached);
        return cached;
      }
    }

    if (signal?.aborted) return null;

    // =========================================================================
    // PRIORITY 1: WIKIMEDIA (PRIMARY)
    // Wikimedia is the tested primary provider for landmarks, cultural sites, etc.
    // =========================================================================
    try {
      diagnosticLogs.push({
        provider: 'Wikimedia',
        status: 'attempted',
      });

      const wikimediaVisual = await this.wikimediaProvider.resolveVisualProgressive(
        context,
        (progressive) => {
          if (!signal?.aborted) {
            onProgressiveVisual?.(progressive);
          }
        },
        signal
      );

      if (signal?.aborted) return null;

      if (wikimediaVisual && wikimediaVisual.confidence >= 0.65) {
        const lastLog = diagnosticLogs[diagnosticLogs.length - 1];
        lastLog.status = 'success';
        lastLog.confidence = wikimediaVisual.confidence;
        lastLog.browserLoad = 'success';
        lastLog.details = wikimediaVisual.title;

        if (enableCache) {
          this.cacheVisual(context, wikimediaVisual);
        }

        logVisualResolutionDiagnostic(context.name, diagnosticLogs, wikimediaVisual);
        return wikimediaVisual;
      } else {
        const lastLog = diagnosticLogs[diagnosticLogs.length - 1];
        lastLog.status = 'failed';
        lastLog.reason = 'No high-confidence verified photograph found';
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return null;
      const lastLog = diagnosticLogs[diagnosticLogs.length - 1];
      if (lastLog) {
        lastLog.status = 'failed';
        lastLog.reason = String(err?.message || 'Lookup error');
      }
    }

    if (signal?.aborted) return null;

    // =========================================================================
    // PRIORITY 2: SECONDARY PLACE-PHOTO PROVIDER (FOURSQUARE)
    // Invoked ONLY after Wikimedia fails to produce a suitable photograph.
    // =========================================================================
    if (this.foursquareProvider.canHandle(context)) {
      try {
        diagnosticLogs.push({
          provider: 'Foursquare',
          status: 'attempted',
        });

        const fsqVisual = await this.foursquareProvider.resolveVisual(context, signal);
        if (signal?.aborted) return null;

        if (fsqVisual && fsqVisual.confidence >= 0.65) {
          const lastLog = diagnosticLogs[diagnosticLogs.length - 1];
          lastLog.status = 'success';
          lastLog.confidence = fsqVisual.confidence;
          lastLog.browserLoad = 'success';
          lastLog.details = fsqVisual.title;

          if (enableCache) {
            this.cacheVisual(context, fsqVisual);
          }

          logVisualResolutionDiagnostic(context.name, diagnosticLogs, fsqVisual);
          return fsqVisual;
        } else {
          const lastLog = diagnosticLogs[diagnosticLogs.length - 1];
          lastLog.status = 'failed';
          lastLog.reason = 'No exact venue identity match with photos';
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return null;
        const lastLog = diagnosticLogs[diagnosticLogs.length - 1];
        if (lastLog) {
          lastLog.status = 'failed';
          lastLog.reason = String(err?.message || 'Error');
        }
      }
    } else {
      diagnosticLogs.push({
        provider: 'Foursquare',
        status: 'skipped',
        reason: 'No API key configured or ineligible context',
      });
    }

    if (signal?.aborted) return null;

    // =========================================================================
    // PRIORITY 3: OFFICIAL BRAND VISUAL (VERIFIED BRAND / LOGO)
    // Invoked for commercial POIs where no photograph exists.
    // =========================================================================
    if (this.officialProvider.canHandle(context)) {
      try {
        diagnosticLogs.push({
          provider: 'Official',
          status: 'attempted',
        });

        const officialVisual = await this.officialProvider.resolveVisual(context, signal);
        if (signal?.aborted) return null;

        if (officialVisual) {
          const lastLog = diagnosticLogs[diagnosticLogs.length - 1];
          lastLog.status = 'success';
          lastLog.confidence = officialVisual.confidence;
          lastLog.browserLoad = 'success';
          lastLog.details = officialVisual.title;

          if (enableCache) {
            this.cacheVisual(context, officialVisual);
          }

          logVisualResolutionDiagnostic(context.name, diagnosticLogs, officialVisual);
          return officialVisual;
        } else {
          const lastLog = diagnosticLogs[diagnosticLogs.length - 1];
          lastLog.status = 'failed';
          lastLog.reason = 'No verified brand match found';
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return null;
        const lastLog = diagnosticLogs[diagnosticLogs.length - 1];
        if (lastLog) {
          lastLog.status = 'failed';
          lastLog.reason = String(err?.message || 'Error');
        }
      }
    } else {
      diagnosticLogs.push({
        provider: 'Official',
        status: 'skipped',
        reason: 'No recognized brand metadata for this place',
      });
    }

    if (signal?.aborted) return null;

    // =========================================================================
    // PRIORITY 4: MAPBOX CATEGORY / MAKI ICON
    // Category metadata icon fallback.
    // =========================================================================
    if (this.mapboxProvider.canHandle(context)) {
      try {
        diagnosticLogs.push({
          provider: 'Mapbox',
          status: 'attempted',
        });

        const mapboxVisual = await this.mapboxProvider.resolveVisual(context, signal);
        if (signal?.aborted) return null;

        if (mapboxVisual) {
          const lastLog = diagnosticLogs[diagnosticLogs.length - 1];
          lastLog.status = 'success';
          lastLog.confidence = mapboxVisual.confidence;
          lastLog.browserLoad = 'bypassed';
          lastLog.details = mapboxVisual.title;

          if (enableCache) {
            this.cacheVisual(context, mapboxVisual);
          }

          logVisualResolutionDiagnostic(context.name, diagnosticLogs, mapboxVisual);
          return mapboxVisual;
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return null;
      }
    }

    // =========================================================================
    // PRIORITY 5: NO VISUAL -> PHOTO UNAVAILABLE
    // Honest, clean fallback.
    // =========================================================================
    logVisualResolutionDiagnostic(context.name, diagnosticLogs, null);
    return null;
  }
}

export const placeVisualResolver = new PlaceVisualResolver();
