/**
 * Maply — Mapbox Visual Provider (PRIORITY 4: CATEGORY / MAKI ICON FALLBACK)
 * 
 * Invoked as the final provider fallback before "Photo unavailable".
 * Uses Mapbox POI category and Maki icon metadata to generate a clean,
 * authentic category visual for the place.
 * 
 * Type: 'icon'
 * Source: 'mapbox'
 */

import { PlaceVisual, PlaceVisualContext, PlaceVisualProvider } from '../../../types/visual';

// Mapping of common Mapbox Maki classes / categories to clean SVG data URIs
function createCategorySvgDataUri(categoryName: string, iconType: string, color = '#38bdf8'): string {
  const title = categoryName.toUpperCase();
  
  // Clean, high-contrast SVG representation with Maply dark glass aesthetic
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
    <defs>
      <radialGradient id="bg" cx="50%" cy="50%" r="70%">
        <stop offset="0%" stop-color="#0e223d" />
        <stop offset="100%" stop-color="#060e1a" />
      </radialGradient>
      <linearGradient id="glow" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.35" />
        <stop offset="100%" stop-color="#2563eb" stop-opacity="0.1" />
      </linearGradient>
    </defs>
    <rect width="600" height="400" fill="url(#bg)" />
    <circle cx="300" cy="180" r="80" fill="url(#glow)" stroke="${color}" stroke-width="1.5" stroke-opacity="0.4" />
    <circle cx="300" cy="180" r="55" fill="#0b1728" stroke="${color}" stroke-width="1.5" stroke-opacity="0.6" />
    <text x="300" y="190" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="32" font-weight="bold" fill="${color}" text-anchor="middle" dominant-baseline="middle">
      ${iconType}
    </text>
    <text x="300" y="300" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="600" fill="#e2e8f0" text-anchor="middle" letter-spacing="1">
      ${title}
    </text>
    <text x="300" y="325" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="500" fill="#94a3b8" text-anchor="middle" letter-spacing="0.5">
      MAPBOX PLACE IDENTITY
    </text>
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export class MapboxVisualProvider implements PlaceVisualProvider {
  readonly name = 'Mapbox';
  readonly priority = 4;

  canHandle(context: PlaceVisualContext): boolean {
    return Boolean(
      context &&
      (context.maki ||
       context.category ||
       (context.mapboxCategory && context.mapboxCategory.length > 0) ||
       context.featureType)
    );
  }

  async resolveVisual(
    context: PlaceVisualContext,
    _signal?: AbortSignal
  ): Promise<PlaceVisual | null> {
    if (!this.canHandle(context)) return null;

    const rawCategory =
      context.maki ||
      context.category ||
      (context.mapboxCategory && context.mapboxCategory[0]) ||
      (context.featureType === 'poi' ? 'Point of Interest' : 'Location');

    const catName = String(rawCategory).toLowerCase();

    // Map to icon symbol / label
    let iconSymbol = '📍';
    let color = '#38bdf8';

    if (catName.includes('restaurant') || catName.includes('food') || catName.includes('dining')) {
      iconSymbol = '🍴';
      color = '#f97316';
    } else if (catName.includes('cafe') || catName.includes('coffee')) {
      iconSymbol = '☕';
      color = '#eab308';
    } else if (catName.includes('hotel') || catName.includes('lodging')) {
      iconSymbol = '🏨';
      color = '#3b82f6';
    } else if (catName.includes('park') || catName.includes('nature') || catName.includes('garden')) {
      iconSymbol = '🌳';
      color = '#22c55e';
    } else if (catName.includes('museum') || catName.includes('gallery') || catName.includes('historic')) {
      iconSymbol = '🏛️';
      color = '#a855f7';
    } else if (catName.includes('beach') || catName.includes('coast')) {
      iconSymbol = '🏖️';
      color = '#06b6d4';
    } else if (catName.includes('temple') || catName.includes('church') || catName.includes('mosque') || catName.includes('worship')) {
      iconSymbol = '🛕';
      color = '#f59e0b';
    } else if (catName.includes('hospital') || catName.includes('medical') || catName.includes('pharmacy')) {
      iconSymbol = '🏥';
      color = '#ef4444';
    } else if (catName.includes('shop') || catName.includes('store') || catName.includes('mall')) {
      iconSymbol = '🛍️';
      color = '#ec4899';
    } else if (catName.includes('transit') || catName.includes('station') || catName.includes('airport')) {
      iconSymbol = '🚉';
      color = '#6366f1';
    }

    const dataUri = createCategorySvgDataUri(rawCategory, iconSymbol, color);

    return {
      url: dataUri,
      thumbnailUrl: dataUri,
      type: 'icon',
      source: 'mapbox',
      confidence: 0.75,
      title: `${rawCategory} (Mapbox Icon)`,
      categoryIconName: rawCategory,
      attribution: `Category Icon via Mapbox`,
    };
  }
}

export const mapboxVisualProvider = new MapboxVisualProvider();
