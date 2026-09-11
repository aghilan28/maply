import { LocationItem } from '../types/location';
import { locationStorage } from './locationStorage';

export class LocationRepository {
  private cache: LocationItem[] = [];

  constructor() {
    this.cache = locationStorage.load();
  }

  async getLocations(): Promise<LocationItem[]> {
    this.cache = locationStorage.load();
    return [...this.cache];
  }

  async getLocation(id: string): Promise<LocationItem | null> {
    const loc = this.cache.find(item => item.id === id);
    return loc ? { ...loc } : null;
  }

  async createLocation(item: Omit<LocationItem, 'id' | 'createdAt'> & { id?: string }): Promise<LocationItem> {
    const now = new Date();
    const dateFormatted = now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }) + ' · ' + now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    const newLocation: LocationItem = {
      ...item,
      id: item.id || `loc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: dateFormatted,
      updatedAt: dateFormatted,
      tags: item.tags || [],
      isFavorite: item.isFavorite ?? false,
    };

    this.cache = [newLocation, ...this.cache];
    locationStorage.save(this.cache);
    return newLocation;
  }

  async updateLocation(id: string, data: Partial<LocationItem>): Promise<LocationItem | null> {
    const index = this.cache.findIndex(item => item.id === id);
    if (index === -1) return null;

    const now = new Date();
    const dateFormatted = now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }) + ' · ' + now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    const updated: LocationItem = {
      ...this.cache[index],
      ...data,
      updatedAt: dateFormatted
    };

    this.cache[index] = updated;
    locationStorage.save(this.cache);
    return updated;
  }

  async deleteLocation(id: string): Promise<boolean> {
    const prevLen = this.cache.length;
    this.cache = this.cache.filter(item => item.id !== id);
    if (this.cache.length !== prevLen) {
      locationStorage.save(this.cache);
      return true;
    }
    return false;
  }

  async restoreLocation(location: LocationItem): Promise<void> {
    if (!this.cache.some(item => item.id === location.id)) {
      this.cache = [location, ...this.cache];
      locationStorage.save(this.cache);
    }
  }
}

export const locationRepo = new LocationRepository();
