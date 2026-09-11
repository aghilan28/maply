import { Place, PlaceAddress, PlaceViewport } from '../types/place';
import { PlaceProvider, SearchOptions, NearbyOptions } from './placeProvider';

interface MapboxContextItem {
  id: string;
  text: string;
  short_code?: string;
  wikidata?: string;
}

interface MapboxFeature {
  id: string;
  type: string;
  place_type: string[];
  relevance: number;
  properties: {
    accuracy?: string;
    address?: string;
    category?: string;
    maki?: string;
    landmark?: boolean;
    wikidata?: string;
    short_code?: string;
  };
  text: string;
  place_name: string;
  bbox?: [number, number, number, number];
  center: [number, number]; // [lng, lat]
  geometry: {
    type: string;
    coordinates: [number, number];
  };
  context?: MapboxContextItem[];
}

interface MapboxGeocodingResponse {
  type: string;
  query: string[] | number[];
  features: MapboxFeature[];
  attribution?: string;
}

export class MapboxPlaceProvider implements PlaceProvider {
  readonly name = 'mapbox';
  private token: string;

  constructor(token?: string) {
    this.token = token || (import.meta.env.VITE_MAPBOX_TOKEN as string) || '';
  }

  setToken(token: string) {
    this.token = token;
  }

  async search(query: string, options?: SearchOptions): Promise<Place[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    if (this.token) {
      try {
        let url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          trimmed
        )}.json?access_token=${this.token}&autocomplete=true&limit=${options?.limit || 7}`;

        if (options?.proximity) {
          url += `&proximity=${options.proximity.longitude},${options.proximity.latitude}`;
        }
        if (options?.types && options.types.length > 0) {
          url += `&types=${options.types.join(',')}`;
        }

        const res = await fetch(url);
        if (res.ok) {
          const data: MapboxGeocodingResponse = await res.json();
          if (data.features && data.features.length > 0) {
            return data.features.map((f) => this.mapFeatureToPlace(f));
          }
        }
      } catch (err) {
        console.warn('Mapbox search request failed, trying fallback:', err);
      }
    }

    // Graceful Fallback: Real OpenStreetMap Nominatim forward search
    return this.searchNominatim(trimmed, options);
  }

  async reverseGeocode(latitude: number, longitude: number): Promise<Place | null> {
    if (this.token) {
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${this.token}&limit=1`;
        const res = await fetch(url);
        if (res.ok) {
          const data: MapboxGeocodingResponse = await res.json();
          if (data.features && data.features.length > 0) {
            return this.mapFeatureToPlace(data.features[0]);
          }
        }
      } catch (err) {
        console.warn('Mapbox reverse geocode failed, trying fallback:', err);
      }
    }

    // Graceful Fallback: Real OpenStreetMap Nominatim reverse geocode
    return this.reverseGeocodeNominatim(latitude, longitude);
  }

  async getPlaceDetails(placeId: string, fallbackPlace?: Partial<Place>): Promise<Place | null> {
    // If it's already a complete place, return it
    if (fallbackPlace && fallbackPlace.name && fallbackPlace.coordinates) {
      return fallbackPlace as Place;
    }

    if (this.token && placeId.startsWith('mapbox:')) {
      const featureId = placeId.replace('mapbox:', '');
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          featureId
        )}.json?access_token=${this.token}`;
        const res = await fetch(url);
        if (res.ok) {
          const data: MapboxGeocodingResponse = await res.json();
          if (data.features && data.features.length > 0) {
            return this.mapFeatureToPlace(data.features[0]);
          }
        }
      } catch (err) {
        console.warn('Mapbox place details failed:', err);
      }
    }

    return null;
  }

  async getNearbyPlaces(
    latitude: number,
    longitude: number,
    options?: NearbyOptions
  ): Promise<Place[]> {
    const category = options?.category || 'poi';
    const limit = options?.limit || 6;

    if (this.token) {
      try {
        // Mapbox POI search with proximity
        const queryTerm = category === 'poi' || category === 'All' ? 'landmark' : category;
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          queryTerm
        )}.json?proximity=${longitude},${latitude}&types=poi,address&limit=${limit}&access_token=${this.token}`;
        const res = await fetch(url);
        if (res.ok) {
          const data: MapboxGeocodingResponse = await res.json();
          if (data.features && data.features.length > 0) {
            return data.features.map((f) => this.mapFeatureToPlace(f));
          }
        }
      } catch (err) {
        console.warn('Mapbox nearby search failed:', err);
      }
    }

    // Graceful Fallback: Real Nominatim nearby search
    try {
      const q = options?.category && options.category !== 'All' ? options.category : 'tourism';
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        q
      )}&format=json&addressdetails=1&limit=${limit}&viewbox=${longitude - 0.08},${latitude + 0.08},${longitude + 0.08},${latitude - 0.08}&bounded=1`;
      const res = await fetch(url, {
        headers: { 'Accept-Language': 'en' },
      });
      if (res.ok) {
        const items = await res.json();
        return items.map((item: any) => this.mapNominatimToPlace(item));
      }
    } catch {
      // Return empty array if nearby lookup fails
    }

    return [];
  }

  private mapFeatureToPlace(feature: MapboxFeature): Place {
    const address: PlaceAddress = {};
    const categories: string[] = [];

    if (feature.place_type && feature.place_type.length > 0) {
      categories.push(...feature.place_type);
    }
    if (feature.properties?.category) {
      categories.push(...feature.properties.category.split(',').map((c) => c.trim()));
    }

    if (feature.context) {
      for (const ctx of feature.context) {
        if (ctx.id.startsWith('country')) {
          address.country = ctx.text;
          address.countryCode = ctx.short_code?.toUpperCase();
        } else if (ctx.id.startsWith('region')) {
          address.state = ctx.text;
        } else if (ctx.id.startsWith('district')) {
          address.district = ctx.text;
        } else if (ctx.id.startsWith('place')) {
          address.city = ctx.text;
        } else if (ctx.id.startsWith('locality')) {
          address.locality = ctx.text;
        } else if (ctx.id.startsWith('neighborhood')) {
          address.neighborhood = ctx.text;
        } else if (ctx.id.startsWith('postcode')) {
          address.postalCode = ctx.text;
        }
      }
    }

    if (feature.properties?.address) {
      address.street = feature.properties.address;
    }

    // Extract viewport if available
    let viewport: PlaceViewport | undefined;
    if (feature.bbox) {
      viewport = {
        west: feature.bbox[0],
        south: feature.bbox[1],
        east: feature.bbox[2],
        north: feature.bbox[3],
      };
    }

    // Determine normalized primary category
    let primaryCategory = 'Travel';
    const joinedCategories = categories.join(' ').toLowerCase();
    if (joinedCategories.includes('restaurant') || joinedCategories.includes('food') || joinedCategories.includes('cafe')) {
      primaryCategory = 'Food';
    } else if (joinedCategories.includes('park') || joinedCategories.includes('nature') || joinedCategories.includes('beach') || joinedCategories.includes('mountain')) {
      primaryCategory = 'Nature';
    } else if (joinedCategories.includes('office') || joinedCategories.includes('work') || joinedCategories.includes('commercial')) {
      primaryCategory = 'Work';
    } else if (joinedCategories.includes('shop') || joinedCategories.includes('mall') || joinedCategories.includes('market')) {
      primaryCategory = 'Shopping';
    } else if (joinedCategories.includes('hotel') || joinedCategories.includes('lodging')) {
      primaryCategory = 'Travel';
    }

    return {
      id: `mapbox:${feature.id}`,
      provider: 'mapbox',
      providerPlaceId: feature.id,
      name: feature.text || feature.place_name.split(',')[0],
      coordinates: {
        latitude: feature.center[1],
        longitude: feature.center[0],
      },
      formattedAddress: feature.place_name,
      address,
      category: primaryCategory,
      categories,
      viewport,
      mapboxFeatureType: feature.place_type?.[0],
      sourceMetadata: feature,
    };
  }

  private async searchNominatim(query: string, options?: SearchOptions): Promise<Place[]> {
    try {
      let url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        query
      )}&format=json&addressdetails=1&limit=${options?.limit || 6}`;

      if (options?.proximity) {
        url += `&viewbox=${options.proximity.longitude - 0.25},${options.proximity.latitude + 0.25},${options.proximity.longitude + 0.25},${options.proximity.latitude - 0.25}`;
      }

      const res = await fetch(url, {
        headers: { 'Accept-Language': 'en' },
      });
      if (!res.ok) return [];

      const items = await res.json();
      return items.map((item: any) => this.mapNominatimToPlace(item));
    } catch (err) {
      console.warn('Nominatim search failed:', err);
      return [];
    }
  }

  private async reverseGeocodeNominatim(latitude: number, longitude: number): Promise<Place | null> {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`;
      const res = await fetch(url, {
        headers: { 'Accept-Language': 'en' },
      });
      if (!res.ok) return null;

      const item = await res.json();
      return this.mapNominatimToPlace(item);
    } catch (err) {
      console.warn('Nominatim reverse geocode failed:', err);
      return null;
    }
  }

  private mapNominatimToPlace(item: any): Place {
    const addr = item.address || {};
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);

    const name =
      item.namedetails?.name ||
      addr.tourism ||
      addr.amenity ||
      addr.building ||
      addr.historic ||
      addr.leisure ||
      addr.road ||
      item.display_name?.split(',')[0] ||
      'Location';

    const address: PlaceAddress = {
      houseNumber: addr.house_number,
      street: addr.road || addr.street,
      neighborhood: addr.neighbourhood || addr.suburb,
      locality: addr.locality || addr.suburb,
      city: addr.city || addr.town || addr.village,
      district: addr.county || addr.state_district,
      state: addr.state,
      postalCode: addr.postcode,
      country: addr.country,
      countryCode: addr.country_code?.toUpperCase(),
    };

    let category = 'Travel';
    const typeStr = `${item.type || ''} ${item.class || ''}`.toLowerCase();
    if (typeStr.includes('food') || typeStr.includes('restaurant') || typeStr.includes('cafe')) {
      category = 'Food';
    } else if (typeStr.includes('natural') || typeStr.includes('beach') || typeStr.includes('park')) {
      category = 'Nature';
    } else if (typeStr.includes('commercial') || typeStr.includes('office')) {
      category = 'Work';
    } else if (typeStr.includes('shop')) {
      category = 'Shopping';
    }

    return {
      id: `osm:${item.place_id || `${lat.toFixed(5)}_${lng.toFixed(5)}`}`,
      provider: 'nominatim',
      providerPlaceId: String(item.place_id),
      name,
      coordinates: {
        latitude: lat,
        longitude: lng,
      },
      formattedAddress: item.display_name,
      address,
      category,
      categories: [item.class, item.type].filter(Boolean),
      sourceMetadata: item,
    };
  }
}
