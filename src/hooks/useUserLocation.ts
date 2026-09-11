import { useState, useEffect, useRef, useCallback } from 'react';

export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  altitude?: number | null;
  altitudeAccuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  isHighAccuracy?: boolean;
  isCalibrated?: boolean;
  label?: string;
}

export type GeolocationStatus =
  | 'idle'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'unavailable'
  | 'timeout'
  | 'unsupported';

export interface UseUserLocationResult {
  userLocation: UserLocation | null;
  isLocating: boolean;
  status: GeolocationStatus;
  errorMessage: string | null;
  isCalibrated: boolean;
  calibrateLocation: (lat: number, lng: number, label?: string) => void;
  resetCalibration: () => Promise<UserLocation | null>;
  requestLocation: (forceFresh?: boolean) => Promise<UserLocation | null>;
}

export const CALIBRATED_LOCATION_STORAGE_KEY = 'maply_calibrated_user_location';

/**
 * Calculates horizontal distance in meters between two coordinates using the Haversine formula.
 */
export function computeDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
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

/**
 * Evaluates whether an incoming geolocation fix should replace the current best fix.
 * Follows the principle of retaining the best available fix, preventing random jumping,
 * and allowing progressive refinement as high-accuracy readings arrive.
 */
function shouldAcceptNewFix(
  candidate: UserLocation,
  current: UserLocation | null
): boolean {
  // First reading: accept if it's within a realistic horizontal accuracy (< 10000m)
  if (!current) {
    return candidate.accuracy < 10000;
  }

  // If the user has manually calibrated their exact physical location,
  // do not let coarse Wi-Fi/cellular triangulation downgrade or move their calibrated pin
  // unless the device has moved significantly (> 500 meters, e.g. travelling) with high accuracy
  if (current.isCalibrated) {
    const distFromCalibrated = computeDistanceMeters(
      current.latitude,
      current.longitude,
      candidate.latitude,
      candidate.longitude
    );
    if (distFromCalibrated > 500 && candidate.accuracy <= 40) {
      return true;
    }
    return false;
  }

  const accuracyDiff = current.accuracy - candidate.accuracy;
  const dist = computeDistanceMeters(
    current.latitude,
    current.longitude,
    candidate.latitude,
    candidate.longitude
  );
  const timeDelta = candidate.timestamp - current.timestamp;

  // 1. Candidate is strictly more accurate (smaller accuracy radius in meters)
  if (accuracyDiff > 0) {
    return true;
  }

  // 2. Candidate has high accuracy (<= 30m) and reasonable time elapsed
  if (candidate.accuracy <= 30 && timeDelta > 1500) {
    return true;
  }

  // 3. Candidate is similar accuracy and device moved beyond 15 meters
  const isSimilarAccuracy =
    candidate.accuracy <= Math.max(current.accuracy * 1.3, current.accuracy + 15);
  if (dist > 15 && isSimilarAccuracy && timeDelta > 1500) {
    return true;
  }

  // 4. If current fix is coarse (> 45m, common in laptop/Wi-Fi positioning), allow newer readings
  // of similar accuracy to refine position instead of staying permanently frozen on the initial guess
  if (current.accuracy > 45 && candidate.accuracy <= current.accuracy + 10 && timeDelta > 3000) {
    return true;
  }

  // 5. If current fix is stale (> 20s), accept fresh fix with acceptable accuracy
  if (timeDelta > 20000 && candidate.accuracy < 100) {
    return true;
  }

  return false;
}

const HIGH_ACCURACY_POSITION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 12000,
  maximumAge: 0, // Request fresh device reading, never rely on stale cache
};

const WATCH_POSITION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 20000,
  maximumAge: 0,
};

export function useUserLocation(): UseUserLocationResult {
  // Check localStorage for a persisted user calibration
  const initialCalibrated = (() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem(CALIBRATED_LOCATION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as UserLocation;
        if (
          typeof parsed.latitude === 'number' &&
          typeof parsed.longitude === 'number' &&
          !isNaN(parsed.latitude) &&
          !isNaN(parsed.longitude)
        ) {
          return {
            ...parsed,
            isCalibrated: true,
            isHighAccuracy: true,
          };
        }
      }
    } catch {
      // ignore
    }
    return null;
  })();

  const [userLocation, setUserLocation] = useState<UserLocation | null>(initialCalibrated);
  const [isCalibrated, setIsCalibrated] = useState<boolean>(Boolean(initialCalibrated));
  const [isLocating, setIsLocating] = useState<boolean>(!initialCalibrated);
  const [status, setStatus] = useState<GeolocationStatus>(initialCalibrated ? 'granted' : 'requesting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const userLocationRef = useRef<UserLocation | null>(initialCalibrated);
  const isRequestInProgressRef = useRef(false);
  const hasInitializedRef = useRef(false);
  const watchIdRef = useRef<number | null>(null);

  // Keep ref in sync with latest state
  useEffect(() => {
    userLocationRef.current = userLocation;
  }, [userLocation]);

  /**
   * Manually calibrate the user's location to an exact coordinate (e.g. dragging the puck or selecting building).
   * Persists to localStorage and prevents inaccurate Wi-Fi fixes from overwriting it.
   */
  const calibrateLocation = useCallback((lat: number, lng: number, label?: string) => {
    const calibrated: UserLocation = {
      latitude: lat,
      longitude: lng,
      accuracy: 5, // Exact calibrated physical position (< 5m uncertainty)
      timestamp: Date.now(),
      isHighAccuracy: true,
      isCalibrated: true,
      label: label || 'Calibrated Location',
    };

    try {
      localStorage.setItem(CALIBRATED_LOCATION_STORAGE_KEY, JSON.stringify(calibrated));
    } catch (e) {
      console.warn('[Maply] Failed to save calibrated location:', e);
    }

    userLocationRef.current = calibrated;
    setUserLocation(calibrated);
    setIsCalibrated(true);
    setStatus('granted');
    setIsLocating(false);
    setErrorMessage(null);
  }, []);

  /**
   * Reset calibration back to raw device/browser GPS readings.
   */
  const resetCalibration = useCallback(async (): Promise<UserLocation | null> => {
    try {
      localStorage.removeItem(CALIBRATED_LOCATION_STORAGE_KEY);
    } catch {
      // ignore
    }
    setIsCalibrated(false);
    userLocationRef.current = null;
    setUserLocation(null);
    return requestLocation(true);
  }, []);

  /**
   * Processes an incoming raw GeolocationPosition from navigator.geolocation.
   * Performs validation, development diagnostic logging, and accuracy evaluation.
   */
  const processPosition = useCallback((position: GeolocationPosition): UserLocation | null => {
    const { latitude, longitude, accuracy, altitude, altitudeAccuracy, heading, speed } =
      position.coords;
    const timestamp = position.timestamp || Date.now();

    // Sanity-check coordinate validity
    if (
      typeof latitude !== 'number' ||
      typeof longitude !== 'number' ||
      isNaN(latitude) ||
      isNaN(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180 ||
      typeof accuracy !== 'number' ||
      isNaN(accuracy) ||
      accuracy < 0
    ) {
      return null;
    }

    // Development diagnostic logging as required by PART 24
    if (import.meta.env.DEV) {
      console.log(
        `[Maply Geolocation]\n` +
          `latitude: ${latitude}\n` +
          `longitude: ${longitude}\n` +
          `accuracy: ${accuracy}m\n` +
          `altitude: ${altitude ?? 'null'}\n` +
          `heading: ${heading ?? 'null'}\n` +
          `speed: ${speed ?? 'null'}\n` +
          `timestamp: ${timestamp}\n` +
          `source = navigator.geolocation`
      );
    }

    const candidate: UserLocation = {
      latitude,
      longitude,
      accuracy,
      timestamp,
      altitude: altitude ?? null,
      altitudeAccuracy: altitudeAccuracy ?? null,
      heading: heading ?? null,
      speed: speed ?? null,
      isHighAccuracy: accuracy <= 35,
    };

    if (shouldAcceptNewFix(candidate, userLocationRef.current)) {
      userLocationRef.current = candidate;
      setUserLocation(candidate);
      setStatus('granted');
      setIsLocating(false);
      setErrorMessage(null);
      return candidate;
    }

    return userLocationRef.current;
  }, []);

  /**
   * Safe watchPosition lifecycle starter (ensures only one watcher is active).
   */
  const startWatching = useCallback(() => {
    if (typeof window === 'undefined' || !navigator?.geolocation) return;
    if (watchIdRef.current !== null) return; // Prevent duplicate active watchers

    try {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          processPosition(pos);
        },
        (err) => {
          if (import.meta.env.DEV) {
            console.warn('[Maply Geolocation] watchPosition notice:', err.message);
          }
        },
        WATCH_POSITION_OPTIONS
      );
    } catch (err) {
      console.warn('[Maply Geolocation] watchPosition error:', err);
    }
  }, [processPosition]);

  /**
   * Safe watchPosition cleanup helper.
   */
  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null && typeof window !== 'undefined' && navigator?.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  /**
   * Request fresh device location (used on startup and explicitly on "My Location" click).
   */
  const requestLocation = useCallback(
    async (forceFresh = false): Promise<UserLocation | null> => {
      if (typeof window === 'undefined' || !navigator?.geolocation) {
        setStatus('unsupported');
        setIsLocating(false);
        setErrorMessage('Location is not supported by this browser.');
        return null;
      }

      if (isRequestInProgressRef.current) {
        return userLocationRef.current;
      }

      isRequestInProgressRef.current = true;
      setIsLocating(true);
      setStatus('requesting');
      setErrorMessage(null);

      // Ensure active watcher is running to catch progressively better fixes
      startWatching();

      return new Promise((resolve) => {
        const handleSuccess = (position: GeolocationPosition) => {
          isRequestInProgressRef.current = false;
          setIsLocating(false);
          const accepted = processPosition(position);
          resolve(accepted || userLocationRef.current);
        };

        const handleError = (error: GeolocationPositionError) => {
          // If first high-accuracy attempt timed out, retry once with a slightly larger timeout
          if (error.code === error.TIMEOUT) {
            navigator.geolocation.getCurrentPosition(
              handleSuccess,
              (retryError) => {
                isRequestInProgressRef.current = false;
                setIsLocating(false);
                let nextStatus: GeolocationStatus = 'unavailable';
                let message = 'Location request timed out. Please check device location services.';

                if (retryError.code === retryError.PERMISSION_DENIED) {
                  nextStatus = 'denied';
                  message = 'Location permission is required to center Maply on your location.';
                } else if (retryError.code === retryError.POSITION_UNAVAILABLE) {
                  nextStatus = 'unavailable';
                  message = 'Your device location is currently unavailable.';
                }

                setStatus(nextStatus);
                setErrorMessage(message);
                resolve(userLocationRef.current);
              },
              {
                ...HIGH_ACCURACY_POSITION_OPTIONS,
                timeout: 15000,
              }
            );
            return;
          }

          isRequestInProgressRef.current = false;
          setIsLocating(false);

          let nextStatus: GeolocationStatus = 'unavailable';
          let message = 'Your location is currently unavailable.';

          if (error.code === error.PERMISSION_DENIED) {
            nextStatus = 'denied';
            message = 'Location permission is required to center Maply on your location.';
            if (import.meta.env.DEV) console.log('[Maply] geolocation error: permission denied');
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            nextStatus = 'unavailable';
            message = 'Your location is currently unavailable.';
            if (import.meta.env.DEV) console.log('[Maply] geolocation error: position unavailable');
          } else if (error.code === error.TIMEOUT) {
            nextStatus = 'timeout';
            message = 'Location request timed out.';
            if (import.meta.env.DEV) console.log('[Maply] geolocation error: timeout');
          }

          setStatus(nextStatus);
          setErrorMessage(message);
          resolve(userLocationRef.current);
        };

        navigator.geolocation.getCurrentPosition(
          handleSuccess,
          handleError,
          forceFresh
            ? { ...HIGH_ACCURACY_POSITION_OPTIONS, maximumAge: 0 }
            : HIGH_ACCURACY_POSITION_OPTIONS
        );
      });
    },
    [processPosition, startWatching]
  );

  // Initial startup request and lifecycle management
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    // Check Permissions API if supported
    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((permissionStatus) => {
          if (permissionStatus.state === 'denied') {
            setStatus('denied');
            setErrorMessage('Location permission is required to center Maply on your location.');
            setIsLocating(false);
          }
          permissionStatus.onchange = () => {
            if (permissionStatus.state === 'granted') {
              requestLocation(true);
            } else if (permissionStatus.state === 'denied') {
              setStatus('denied');
              setErrorMessage('Location permission is required to center Maply on your location.');
              setIsLocating(false);
            }
          };
        })
        .catch(() => {
          // Permissions API query not supported or failed, fallback to requestLocation
        });
    }

    // Immediately trigger high-accuracy location and start continuous watchPosition
    requestLocation(true);

    return () => {
      stopWatching();
    };
  }, [requestLocation, stopWatching]);

  return {
    userLocation,
    isLocating,
    status,
    errorMessage,
    isCalibrated,
    calibrateLocation,
    resetCalibration,
    requestLocation,
  };
}

