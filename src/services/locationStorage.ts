import { LocationItem } from '../types/location';

const LEGACY_STORAGE_KEY = 'maply:locations';

const getStorageKey = (userId?: string | null): string => {
  if (!userId) return 'maply:locations:guest_default';
  const cleanId = userId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  return `maply:locations:${cleanId}`;
};

export const locationStorage = {
  load(userId?: string | null): LocationItem[] {
    try {
      const key = getStorageKey(userId);
      let data = localStorage.getItem(key);

      // Legacy migration helper for main demo account
      if (data === null && (userId === 'user-default-1' || userId === 'aghilan')) {
        const legacyData = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacyData) {
          localStorage.setItem(key, legacyData);
          data = legacyData;
        }
      }

      if (data === null) {
        return [];
      }
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed;
    } catch {
      return [];
    }
  },

  save(locations: LocationItem[], userId?: string | null): void {
    try {
      const key = getStorageKey(userId);
      localStorage.setItem(key, JSON.stringify(locations));
    } catch (e) {
      console.error('Failed to save locations to localStorage:', e);
    }
  },

  clearAll(userId?: string | null): void {
    try {
      const key = getStorageKey(userId);
      localStorage.setItem(key, JSON.stringify([]));
    } catch (e) {
      console.error('Failed to reset locations in localStorage:', e);
    }
  },
};
