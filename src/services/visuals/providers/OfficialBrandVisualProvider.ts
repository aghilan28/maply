/**
 * Maply — Official Brand Visual Provider (PRIORITY 3: VERIFIED BRAND/LOGO)
 * 
 * Invoked ONLY when Wikimedia and secondary photo providers fail to produce a photograph.
 * For branded / commercial locations, resolves verified official brand logos.
 * 
 * STRICT POLICIES:
 * - NO random image search or unverified website scraping.
 * - Identified via Mapbox brand metadata or verified brand matches.
 * - Always marked as type = 'logo', source = 'official'.
 */

import { PlaceVisual, PlaceVisualContext, PlaceVisualProvider } from '../../../types/visual';
import { validateBrowserImage } from '../utils/imageValidator';
import { normalizePlaceName } from '../../wikimediaImageService';

// Curated verified official brand logo assets from Wikimedia Commons
const VERIFIED_BRAND_REGISTRY: Record<string, { brandName: string; logoUrl: string }> = {
  starbucks: {
    brandName: 'Starbucks',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/d/d3/Starbucks_Corporation_Logo_2011.svg/500px-Starbucks_Corporation_Logo_2011.svg.png',
  },
  mcdonalds: {
    brandName: "McDonald's",
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/McDonald%27s_Golden_Arches.svg/500px-McDonald%27s_Golden_Arches.svg.png',
  },
  subway: {
    brandName: 'Subway',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Subway_2016_logo.svg/500px-Subway_2016_logo.svg.png',
  },
  kfc: {
    brandName: 'KFC',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/b/bf/KFC_logo.svg/500px-KFC_logo.svg.png',
  },
  dominos: {
    brandName: "Domino's Pizza",
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Dominos_pizza_logo.svg/500px-Dominos_pizza_logo.svg.png',
  },
  pizza_hut: {
    brandName: 'Pizza Hut',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/d/d2/Pizza_Hut_logo_%282014%29.svg/500px-Pizza_Hut_logo_%282014%29.svg.png',
  },
  burger_king: {
    brandName: 'Burger King',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Burger_King_logo_%281999%29.svg/500px-Burger_King_logo_%281999%29.svg.png',
  },
  apple: {
    brandName: 'Apple Store',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Apple_logo_black.svg/500px-Apple_logo_black.svg.png',
  },
  nike: {
    brandName: 'Nike',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Logo_NIKE.svg/500px-Logo_NIKE.svg.png',
  },
  adidas: {
    brandName: 'Adidas',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/Adidas_Logo.svg/500px-Adidas_Logo.svg.png',
  },
  ikea: {
    brandName: 'IKEA',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Ikea_logo.svg/500px-Ikea_logo.svg.png',
  },
  target: {
    brandName: 'Target',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Target_Corporation_logo_%28vector%29.svg/500px-Target_Corporation_logo_%28vector%29.svg.png',
  },
  costco: {
    brandName: 'Costco',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/Costco_Wholesale_logo_2010-10-26.svg/500px-Costco_Wholesale_logo_2010-10-26.svg.png',
  },
  walmart: {
    brandName: 'Walmart',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Walmart_logo.svg/500px-Walmart_logo.svg.png',
  },
  shell: {
    brandName: 'Shell',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/e/e8/Shell_logo.svg/500px-Shell_logo.svg.png',
  },
  bp: {
    brandName: 'BP',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/d/d2/BP_Helios_logo.svg/500px-BP_Helios_logo.svg.png',
  },
  hilton: {
    brandName: 'Hilton',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Hilton_Hotels_%26_Resorts_logo.svg/500px-Hilton_Hotels_%26_Resorts_logo.svg.png',
  },
  marriott: {
    brandName: 'Marriott',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Marriott_Hotels_%26_Resorts_logo.svg/500px-Marriott_Hotels_%26_Resorts_logo.svg.png',
  },
  hyatt: {
    brandName: 'Hyatt',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Hyatt_logo.svg/500px-Hyatt_logo.svg.png',
  },
  decathlon: {
    brandName: 'Decathlon',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Decathlon_Logo.svg/500px-Decathlon_Logo.svg.png',
  },
  costa_coffee: {
    brandName: 'Costa Coffee',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/2/23/Costa_Coffee_logo.svg/500px-Costa_Coffee_logo.svg.png',
  },
  dunkin: {
    brandName: "Dunkin'",
    logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/b/b8/Dunkin%27_logo.svg/500px-Dunkin%27_logo.svg.png',
  },
  zara: {
    brandName: 'ZARA',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/Zara_Logo.svg/500px-Zara_Logo.svg.png',
  },
  h_and_m: {
    brandName: 'H&M',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/H%26M-Logo.svg/500px-H%26M-Logo.svg.png',
  },
  sephora: {
    brandName: 'Sephora',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Sephora_logo.svg/500px-Sephora_logo.svg.png',
  },
};

export class OfficialBrandVisualProvider implements PlaceVisualProvider {
  readonly name = 'Official';
  readonly priority = 3;

  private detectBrandKey(context: PlaceVisualContext): string | null {
    // 1. Check Mapbox brand metadata directly
    if (context.mapboxBrand) {
      const normBrand = normalizePlaceName(context.mapboxBrand).replace(/\s+/g, '_');
      for (const key of Object.keys(VERIFIED_BRAND_REGISTRY)) {
        if (normBrand.includes(key) || key.includes(normBrand)) {
          return key;
        }
      }
    }

    // 2. Check place name for exact known brand matches
    const normName = normalizePlaceName(context.name);
    for (const key of Object.keys(VERIFIED_BRAND_REGISTRY)) {
      const brandToken = key.replace(/_/g, ' ');
      // Must match at word boundary or exact start of name
      const regex = new RegExp(`\\b${brandToken}\\b`, 'i');
      if (regex.test(normName)) {
        return key;
      }
    }

    return null;
  }

  canHandle(context: PlaceVisualContext): boolean {
    if (!context || !context.name) return false;
    return Boolean(this.detectBrandKey(context));
  }

  async resolveVisual(
    context: PlaceVisualContext,
    signal?: AbortSignal
  ): Promise<PlaceVisual | null> {
    const brandKey = this.detectBrandKey(context);
    if (!brandKey) return null;

    const brandEntry = VERIFIED_BRAND_REGISTRY[brandKey];
    if (!brandEntry) return null;

    try {
      const isLoaded = await validateBrowserImage(brandEntry.logoUrl, {
        signal,
        timeoutMs: 4000,
      });

      if (signal?.aborted || !isLoaded) {
        return null;
      }

      return {
        url: brandEntry.logoUrl,
        thumbnailUrl: brandEntry.logoUrl,
        type: 'logo',
        source: 'official',
        confidence: 0.90,
        title: brandEntry.brandName,
        brandName: brandEntry.brandName,
        attribution: `Official Brand Visual — ${brandEntry.brandName}`,
      };
    } catch {
      return null;
    }
  }
}

export const officialBrandVisualProvider = new OfficialBrandVisualProvider();
