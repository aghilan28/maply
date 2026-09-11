import { LocationItem } from '../types/location';

// Clean slate for new users: no pre-populated dummy locations
export const SEED_LOCATIONS: LocationItem[] = [];

const STORAGE_KEY = 'maply:locations';
const CLEAN_USER_MIGRATION_KEY = 'maply:clean_slate_migrated_v1';

export const locationStorage = {
  load(): LocationItem[] {
    try {
      // One-time cleanup of legacy test seed dummy locations (Chennai dummy places)
      const hasMigrated = localStorage.getItem(CLEAN_USER_MIGRATION_KEY);
      if (!hasMigrated) {
        localStorage.setItem(CLEAN_USER_MIGRATION_KEY, 'true');
        const legacyData = localStorage.getItem(STORAGE_KEY);
        if (legacyData) {
          try {
            const parsed = JSON.parse(legacyData);
            const legacyIds = new Set([
              'marina-beach',
              'semmozhi-poonga',
              'home-chennai',
              'work-tidel',
              'food-kitchen',
              'guindy-park',
              'chennai-harbor',
            ]);
            // If all or majority were the old seed data, purge them for a fresh new-user experience
            if (Array.isArray(parsed) && parsed.every((l: any) => legacyIds.has(l.id))) {
              localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
              return [];
            }
          } catch {
            localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
            return [];
          }
        } else {
          localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
          return [];
        }
      }

      const data = localStorage.getItem(STORAGE_KEY);
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

  save(locations: LocationItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(locations));
    } catch (e) {
      console.error('Failed to save locations to localStorage:', e);
    }
  },

  clearAll(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    } catch (e) {
      console.error('Failed to reset locations in localStorage:', e);
    }
  },
};
