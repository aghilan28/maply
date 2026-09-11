import { LocationItem } from '../types/location';
import { locationStorage } from './locationStorage';

export class LocationRepository {
  private cache: LocationItem[] = [];
  private activeUserId: string | null = null;

  public setActiveUser(userId?: string | null) {
    const cleanId = userId || null;
    if (this.activeUserId !== cleanId) {
      this.activeUserId = cleanId;
      this.cache = locationStorage.load(this.activeUserId);
    }
  }

  public getActiveUserId(): string | null {
    return this.activeUserId;
  }

  async getLocations(userId?: string | null): Promise<LocationItem[]> {
    if (userId !== undefined) {
      this.activeUserId = userId || null;
    }
    this.cache = locationStorage.load(this.activeUserId);
    return [...this.cache];
  }

  async getLocation(id: string, userId?: string | null): Promise<LocationItem | null> {
    if (userId !== undefined) {
      this.setActiveUser(userId);
    } else {
      this.cache = locationStorage.load(this.activeUserId);
    }
    const loc = this.cache.find(item => item.id === id);
    return loc ? { ...loc } : null;
  }

  async createLocation(
    item: Omit<LocationItem, 'id' | 'createdAt'> & { id?: string },
    userId?: string | null
  ): Promise<LocationItem> {
    if (userId !== undefined) {
      this.setActiveUser(userId);
    }
    const now = new Date();
    const dateFormatted =
      now.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }) +
      ' · ' +
      now.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
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
    locationStorage.save(this.cache, this.activeUserId);
    return newLocation;
  }

  async updateLocation(
    id: string,
    data: Partial<LocationItem>,
    userId?: string | null
  ): Promise<LocationItem | null> {
    if (userId !== undefined) {
      this.setActiveUser(userId);
    }
    const index = this.cache.findIndex(item => item.id === id);
    if (index === -1) return null;

    const now = new Date();
    const dateFormatted =
      now.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }) +
      ' · ' +
      now.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });

    const updated: LocationItem = {
      ...this.cache[index],
      ...data,
      updatedAt: dateFormatted,
    };

    this.cache[index] = updated;
    locationStorage.save(this.cache, this.activeUserId);
    return updated;
  }

  async deleteLocation(id: string, userId?: string | null): Promise<boolean> {
    if (userId !== undefined) {
      this.setActiveUser(userId);
    }
    const prevLen = this.cache.length;
    this.cache = this.cache.filter(item => item.id !== id);
    if (this.cache.length !== prevLen) {
      locationStorage.save(this.cache, this.activeUserId);
      return true;
    }
    return false;
  }

  async restoreLocation(location: LocationItem, userId?: string | null): Promise<void> {
    if (userId !== undefined) {
      this.setActiveUser(userId);
    }
    if (!this.cache.some(item => item.id === location.id)) {
      this.cache = [location, ...this.cache];
      locationStorage.save(this.cache, this.activeUserId);
    }
  }
}

export const locationRepo = new LocationRepository();
