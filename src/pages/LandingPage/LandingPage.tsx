import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { LocationItem, MapStyleType, discoveredPlaceToLocationItem, locationItemToPlace } from '../../types/location';
import { Place, DiscoveredPlace, discoveredPlaceToPlace, NormalizedPlace } from '../../types/place';
import { locationRepo } from '../../services/locationRepository';
import { placeService } from '../../services/placeService';
import { placeImageService } from '../../services/placeImageService';
import { mapboxPlaceService } from '../../services/mapboxPlaceService';
import { useUserLocation, UserLocation } from '../../hooks/useUserLocation';
import { MapView } from '../../components/map/MapView';
import { MapControls } from '../../components/map/MapControls';
import { Sidebar } from '../../components/layout/Sidebar';
import { TopSearchBar } from '../../components/layout/TopSearchBar';
import { TopRightControls } from '../../components/layout/TopRightControls';
import { ActionDock } from '../../components/layout/ActionDock';
import { LocationDetailsPanel } from '../../components/locations/LocationDetailsPanel';
import { AddLocationModal } from '../../components/locations/AddLocationModal';
import { EditLocationModal } from '../../components/locations/EditLocationModal';
import { DeleteConfirmDialog } from '../../components/locations/DeleteConfirmDialog';
import { MyPlacesModal } from '../../components/locations/MyPlacesModal';
import { CategoriesModal } from '../../components/locations/CategoriesModal';
import { CategoryPills } from '../../components/ui/CategoryPills';
import { ToastContainer, ToastMessage } from '../../components/ui/Toast';
import { Menu, X } from 'lucide-react';

import { AuthUser } from '../../types/authTypes';

interface LandingPageProps {
  onBackToLanding?: () => void;
  currentUser?: AuthUser | null;
  onLogout?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onBackToLanding, currentUser, onLogout }) => {
  // Single Source of Truth for saved locations (persisted in localStorage via locationRepo)
  const [locations, setLocations] = useState<LocationItem[]>([]);

  // Canonical selected saved-location ID
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

  // Separate temporary state for discovered places (map click or search result, not yet saved)
  const [discoveredPlace, setDiscoveredPlace] = useState<DiscoveredPlace | null>(null);
  const [isLoadingPlaceDetails, setIsLoadingPlaceDetails] = useState(false);

  // Temporary marker on the map for unsaved discoveries or pending clicks
  const [temporaryPin, setTemporaryPin] = useState<{
    latitude: number;
    longitude: number;
    label?: string;
  } | null>(null);

  // Filters and UI states
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activeNavTab, setActiveNavTab] = useState('explore');
  const [mapStyle, setMapStyle] = useState<MapStyleType>('satellite');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [latestSavedLocation, setLatestSavedLocation] = useState<LocationItem | null>(null);

  // Modals & Interaction States
  const [isAddingMode, setIsAddingMode] = useState(false);
  const [addModalCoords, setAddModalCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [addModalInitialPlace, setAddModalInitialPlace] = useState<DiscoveredPlace | null>(null);
  const [editingLocation, setEditingLocation] = useState<LocationItem | null>(null);
  const [deletingLocationId, setDeletingLocationId] = useState<string | null>(null);
  const [isMyPlacesModalOpen, setIsMyPlacesModalOpen] = useState(false);
  const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false);

  // Responsive Drawer state for Mobile
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  // Toast notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Mapbox map external reference
  const mapRef = useRef<mapboxgl.Map | null>(null);

  // User Geolocation Hook
  const {
    userLocation,
    isLocating,
    status: geoStatus,
    errorMessage: geoError,
    isCalibrated,
    calibrateLocation,
    resetCalibration,
    requestLocation,
  } = useUserLocation();

  const hasUserInteractedWithMap = useRef(false);
  const hasInitiallyCenteredUser = useRef(false);

  const showToast = useCallback(
    (
      message: string,
      type: 'success' | 'info' | 'error' = 'success',
      action?: { label: string; onClick: () => void }
    ) => {
      const id = `toast-${Date.now()}-${Math.random()}`;
      const newToast: ToastMessage = { id, message, type, action };
      setToasts((prev) => [...prev, newToast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    },
    []
  );

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Camera Helper: Smooth FlyTo
  const flyToCoordinates = useCallback(
    (lat: number, lng: number, zoom = 13.5) => {
      const map = mapRef.current;
      if (!map) return;
      const executeFly = () => {
        try {
          map.stop();
          map.flyTo({
            center: [lng, lat],
            zoom,
            pitch: 32,
            bearing: -5,
            essential: true,
            duration: 1200,
          });
        } catch (err) {
          console.warn('FlyTo error:', err);
        }
      };

      if (map.isStyleLoaded()) {
        executeFly();
      } else {
        map.once('load', executeFly);
      }
    },
    []
  );

  // Calibrate user's exact physical location (handles dragging user dot or clicking "Set as My Location")
  const handleUserLocationCalibrate = useCallback(
    async (lat: number, lng: number, customLabel?: string) => {
      let label = customLabel;
      try {
        const place = await mapboxPlaceService.reverseLookup(lng, lat);
        if (place?.name && !place.name.includes('°')) {
          label = place.name;
        }
      } catch (err) {
        console.warn('Reverse lookup failed for calibration:', err);
      }

      calibrateLocation(lat, lng, label);
      showToast(
        `Location calibrated to ${label || 'your exact spot'}! Your location is now accurate.`,
        'success'
      );

      // Clean up temporary pin if it was near this point so only the blue puck is shown
      if (
        temporaryPin &&
        Math.abs(temporaryPin.latitude - lat) < 0.002 &&
        Math.abs(temporaryPin.longitude - lng) < 0.002
      ) {
        setTemporaryPin(null);
      }
    },
    [calibrateLocation, temporaryPin, showToast]
  );

  // Set selected place as current user location
  const handleSetAsCurrentLocation = useCallback(
    (place: NormalizedPlace) => {
      handleUserLocationCalibrate(place.latitude, place.longitude, place.name);
      setTemporaryPin(null);
      setDiscoveredPlace(null);
      setSelectedLocationId(null);
      flyToCoordinates(place.latitude, place.longitude, 16);
    },
    [handleUserLocationCalibrate, flyToCoordinates]
  );

  // Reset calibration back to raw device sensor
  const handleResetLocationCalibration = useCallback(async () => {
    showToast('Resetting to live device GPS sensor…', 'info');
    const fresh = await resetCalibration();
    if (fresh) {
      flyToCoordinates(fresh.latitude, fresh.longitude, 15);
      showToast('Reverted to live device GPS sensor', 'success');
    }
  }, [resetCalibration, flyToCoordinates, showToast]);

  // Load saved locations from Repository on mount (clean new user start)
  useEffect(() => {
    locationRepo.getLocations().then((data) => {
      setLocations(data);
    });
  }, []);

  // Coordinated startup camera centering: executes when both map is ready and user location is available
  const bestCenteredAccuracyRef = useRef<number>(Infinity);

  const tryInitialUserLocationCenter = useCallback(
    (loc: UserLocation | null, map: mapboxgl.Map | null) => {
      if (!loc || !map) return;
      if (hasUserInteractedWithMap.current) {
        // User already manually moved or zoomed before geolocation completed; do not hijack
        return;
      }

      const executeFly = () => {
        try {
          map.flyTo({
            center: [loc.longitude, loc.latitude],
            zoom: 14.5,
            pitch: 32,
            bearing: -5,
            essential: true,
            duration: 1200,
          });
        } catch (err) {
          console.warn('Initial FlyTo user location error:', err);
        }
      };

      if (!hasInitiallyCenteredUser.current) {
        hasInitiallyCenteredUser.current = true;
        bestCenteredAccuracyRef.current = loc.accuracy;
        console.log('[Maply] initial camera moved to user location');

        if (map.isStyleLoaded()) {
          executeFly();
        } else {
          map.once('load', executeFly);
        }
        return;
      }

      // If already centered once, check if incoming fix is significantly more accurate (PART 19)
      // and user has NOT touched the map yet
      if (
        loc.accuracy < bestCenteredAccuracyRef.current - 15 ||
        loc.accuracy <= bestCenteredAccuracyRef.current * 0.5
      ) {
        bestCenteredAccuracyRef.current = loc.accuracy;
        console.log('[Maply] camera smoothly refined to higher accuracy fix:', loc.accuracy);
        try {
          map.easeTo({
            center: [loc.longitude, loc.latitude],
            duration: 800,
            essential: true,
          });
        } catch (err) {
          console.warn('Refined camera move error:', err);
        }
      }
    },
    []
  );

  // Callback when Mapbox completes loading
  const handleMapReady = useCallback(
    (map: mapboxgl.Map) => {
      mapRef.current = map;
      tryInitialUserLocationCenter(userLocation, map);
    },
    [userLocation, tryInitialUserLocationCenter]
  );

  // Auto-center on user's real location upon discovery on startup
  useEffect(() => {
    if (userLocation && mapRef.current) {
      tryInitialUserLocationCenter(userLocation, mapRef.current);
    }
  }, [userLocation, tryInitialUserLocationCenter]);

  // Canonical derived saved location: guarantees zero divergence between sidebar, marker, and details panel
  const selectedLocation = useMemo(() => {
    if (!selectedLocationId) return null;
    return locations.find((l) => l.id === selectedLocationId) ?? null;
  }, [locations, selectedLocationId]);

  // Derived active place for the Details Panel:
  // If a temporary discovered place is active, show it.
  // Otherwise, derive the place from the selected saved location.
  const activeDetailsPlace = useMemo<DiscoveredPlace | null>(() => {
    if (discoveredPlace) {
      return discoveredPlace;
    }
    if (selectedLocation) {
      return {
        mapboxId: selectedLocation.placeId,
        name: selectedLocation.name,
        latitude: selectedLocation.lat,
        longitude: selectedLocation.lng,
        address: selectedLocation.address || selectedLocation.cityRegion,
        city: selectedLocation.cityRegion,
        category: selectedLocation.category,
        photos: selectedLocation.imageUrl
          ? [{ url: selectedLocation.imageUrl, attribution: selectedLocation.imageCredit }]
          : undefined,
        source: 'mapbox',
      };
    }
    return null;
  }, [discoveredPlace, selectedLocation]);

  // Matching saved location item for the active details place (null if unsaved discovered place)
  const activeMatchingSavedLocation = useMemo<LocationItem | null>(() => {
    if (discoveredPlace) {
      // Check if this discovered place happens to already exist in saved locations
      return (
        locations.find(
          (l) =>
            (discoveredPlace.mapboxId && l.placeId === discoveredPlace.mapboxId) ||
            l.id === discoveredPlace.mapboxId ||
            (Math.abs(l.lat - discoveredPlace.latitude) < 0.0003 &&
              Math.abs(l.lng - discoveredPlace.longitude) < 0.0003)
        ) || null
      );
    }
    return selectedLocation;
  }, [discoveredPlace, selectedLocation, locations]);

  // Handle URL query parameters for direct sharing links
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const latParam = params.get('lat');
    const lngParam = params.get('lng');
    const nameParam = params.get('name');
    const locIdParam = params.get('loc');

    if (locIdParam) {
      locationRepo.getLocation(locIdParam).then((loc) => {
        if (loc) {
          setSelectedLocationId(loc.id);
          setDiscoveredPlace(null);
          setTemporaryPin(null);
          flyToCoordinates(loc.lat, loc.lng, 13.5);
        }
      });
    } else if (latParam && lngParam) {
      const lat = parseFloat(latParam);
      const lng = parseFloat(lngParam);
      if (!isNaN(lat) && !isNaN(lng)) {
        setIsLoadingPlaceDetails(true);
        setSelectedLocationId(null);
        setTemporaryPin({ latitude: lat, longitude: lng, label: nameParam || 'Location' });
        flyToCoordinates(lat, lng, 13.5);
        placeService
          .reverseGeocode(lat, lng)
          .then((place) => {
            if (place) {
              if (nameParam) place.name = decodeURIComponent(nameParam);
              setDiscoveredPlace(place);
            }
          })
          .finally(() => {
            setIsLoadingPlaceDetails(false);
          });
      }
    }
  }, [flyToCoordinates]);

  // Warm dynamic image cache for saved locations asynchronously
  useEffect(() => {
    if (locations && locations.length > 0) {
      locations.slice(0, 3).forEach((loc) => {
        const p = locationItemToPlace(loc);
        placeImageService.getPlaceImages(p).catch(() => {});
      });
    }
  }, [locations]);

  // Filtered saved locations based on category
  const filteredLocations = useMemo(() => {
    if (!selectedCategory || selectedCategory === 'All') return locations;
    return locations.filter((l) => l.category === selectedCategory);
  }, [locations, selectedCategory]);

  // Category counts for saved places
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    locations.forEach((loc) => {
      counts[loc.category] = (counts[loc.category] || 0) + 1;
    });
    return counts;
  }, [locations]);

  // 1. SELECT SAVED LOCATION (from sidebar, marker, or search)
  const handleSelectLocation = useCallback(
    (id: string) => {
      setSelectedLocationId(id);
      setDiscoveredPlace(null);
      setTemporaryPin(null);

      const target = locations.find((l) => l.id === id);
      if (target) {
        flyToCoordinates(target.lat, target.lng, 13.5);
      }
    },
    [locations, flyToCoordinates]
  );

  // 2. SELECT DISCOVERED PLACE (from search autocomplete or nearby POI)
  const handleSelectDiscoveredPlace = useCallback(
    (place: DiscoveredPlace) => {
      // Check if this place is already in saved locations
      const normDiscoveredName = (place.name || '').toLowerCase().trim();
      const saved = locations.find(
        (l) =>
          (place.mapboxId && l.placeId === place.mapboxId) ||
          l.id === place.mapboxId ||
          (Math.abs(l.lat - place.latitude) < 0.0008 &&
            Math.abs(l.lng - place.longitude) < 0.0008) ||
          (normDiscoveredName && l.name.toLowerCase().trim() === normDiscoveredName)
      );

      if (saved) {
        setSelectedLocationId(saved.id);
        setDiscoveredPlace(null);
        setTemporaryPin(null);
        flyToCoordinates(saved.lat, saved.lng, 13.5);
        showToast(`Selected saved location "${saved.name}"`, 'info');
      } else {
        setSelectedLocationId(null);
        setDiscoveredPlace(place);
        setTemporaryPin({
          latitude: place.latitude,
          longitude: place.longitude,
          label: place.name,
        });
        flyToCoordinates(place.latitude, place.longitude, 13.5);

        // If place has mapboxId and no photos yet, enrich details
        if (place.mapboxId && (!place.photos || place.photos.length === 0)) {
          setIsLoadingPlaceDetails(true);
          mapboxPlaceService
            .getPlaceDetails(place.mapboxId)
            .then((enriched) => {
              if (enriched) {
                setDiscoveredPlace(enriched);
              }
            })
            .catch((err) => {
              console.warn('Place details enrichment failed:', err);
            })
            .finally(() => {
              setIsLoadingPlaceDetails(false);
            });
        }
      }
    },
    [locations, flyToCoordinates, showToast]
  );

  // 3. MAP CLICK HANDLER (Canonical Mapbox reverse geocode on arbitrary click)
  const handleMapClick = useCallback(
    async (lat: number, lng: number) => {
      if (isAddingMode) {
        setAddModalCoords({ lat, lng });
        setAddModalInitialPlace(null);
        setIsAddingMode(false);
        return;
      }

      // Check if user clicked very close to an existing saved location
      const existingNear = locations.find(
        (l) => Math.abs(l.lat - lat) < 0.0004 && Math.abs(l.lng - lng) < 0.0004
      );
      if (existingNear) {
        handleSelectLocation(existingNear.id);
        return;
      }

      // Clear selected saved location and place temporary pin for discovery
      setSelectedLocationId(null);
      setTemporaryPin({
        latitude: lat,
        longitude: lng,
        label: 'Searching this location...',
      });
      setIsLoadingPlaceDetails(true);

      try {
        const place = await mapboxPlaceService.reverseLookup(lng, lat);
        if (place) {
          const exactPlace: DiscoveredPlace = {
            ...place,
            latitude: lat,  // Keep exact user click latitude
            longitude: lng, // Keep exact user click longitude
          };
          setDiscoveredPlace(exactPlace);
          setTemporaryPin({
            latitude: lat,
            longitude: lng,
            label: place.name,
          });
        } else {
          // Fallback coordinate point
          const fallbackPlace: DiscoveredPlace = {
            name: `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`,
            latitude: lat,
            longitude: lng,
            address: `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`,
            category: 'Address',
            featureType: 'address',
            source: 'mapbox',
          };
          setDiscoveredPlace(fallbackPlace);
          setTemporaryPin({
            latitude: lat,
            longitude: lng,
            label: fallbackPlace.name,
          });
        }
      } catch (err) {
        console.warn('Map reverse geocoding failed:', err);
      } finally {
        setIsLoadingPlaceDetails(false);
      }
    },
    [isAddingMode, locations, handleSelectLocation]
  );

  // 3b. MAPBOX POI CLICK HANDLER (Direct basemap POI interaction)
  const handlePoiClick = useCallback(
    async (poi: DiscoveredPlace) => {
      // Check if user clicked on or near an already saved location
      const existingNear = locations.find(
        (l) =>
          (Math.abs(l.lat - poi.latitude) < 0.0004 && Math.abs(l.lng - poi.longitude) < 0.0004) ||
          (l.placeId && poi.mapboxId && l.placeId === poi.mapboxId)
      );

      if (existingNear) {
        handleSelectLocation(existingNear.id);
        return;
      }

      // Clear selected saved location and set canonical discovered place immediately
      setSelectedLocationId(null);
      setDiscoveredPlace(poi);
      setTemporaryPin({
        latitude: poi.latitude,
        longitude: poi.longitude,
        label: poi.name,
      });
      flyToCoordinates(poi.latitude, poi.longitude, 14.5);
      showToast(`Selected: "${poi.name}"`, 'info');

      // Attempt Mapbox enrichment if mapboxId is present, strictly preserving POI name & coordinates
      if (poi.mapboxId) {
        setIsLoadingPlaceDetails(true);
        try {
          const enriched = await mapboxPlaceService.getPlaceDetails(poi.mapboxId);
          if (enriched) {
            setDiscoveredPlace({
              ...enriched,
              name: poi.name, // Guarantee name is never mutated
              latitude: poi.latitude,
              longitude: poi.longitude,
              featureType: 'poi',
            });
          }
        } catch (err) {
          console.warn('POI enrichment failed:', err);
        } finally {
          setIsLoadingPlaceDetails(false);
        }
      }
    },
    [locations, handleSelectLocation, flyToCoordinates, showToast]
  );

  // 4. SAVE DISCOVERED PLACE TO MAPLY
  const handleSavePlace = async (dp: DiscoveredPlace) => {
    // Prevent duplicate saves
    const isDuplicate = locations.some(
      (l) =>
        (Math.abs(l.lat - dp.latitude) < 0.0003 &&
          Math.abs(l.lng - dp.longitude) < 0.0003) ||
        (l.placeId && dp.mapboxId && l.placeId === dp.mapboxId)
    );

    if (isDuplicate) {
      const match = locations.find(
        (l) =>
          (Math.abs(l.lat - dp.latitude) < 0.0003 &&
            Math.abs(l.lng - dp.longitude) < 0.0003) ||
          (l.placeId && dp.mapboxId && l.placeId === dp.mapboxId)
      );
      if (match) {
        setSelectedLocationId(match.id);
        setDiscoveredPlace(null);
        setTemporaryPin(null);
      }
      showToast(`"${dp.name}" is already saved in your places!`, 'info');
      return;
    }

    const newLocation = discoveredPlaceToLocationItem(dp);
    const created = await locationRepo.createLocation(newLocation);
    setLocations((prev) => [created, ...prev]);
    setSelectedLocationId(created.id);
    setDiscoveredPlace(null);
    setTemporaryPin(null);
    setLatestSavedLocation(created);
    showToast(`Saved "${created.name}" to your Maply collection!`, 'success');
  };

  // 5. SAVE NEW LOCATION FROM MODAL
  const handleSaveNewLocation = async (newLocData: Omit<LocationItem, 'id' | 'createdAt'>) => {
    const created = await locationRepo.createLocation(newLocData);
    setLocations((prev) => [created, ...prev]);
    setSelectedLocationId(created.id);
    setDiscoveredPlace(null);
    setAddModalCoords(null);
    setAddModalInitialPlace(null);
    setTemporaryPin(null);
    setLatestSavedLocation(created);
    showToast(`Saved "${created.name}" to your places!`, 'success');
    flyToCoordinates(created.lat, created.lng, 14);
  };

  // 6. EDIT SAVED OR UNCREATED LOCATION FROM SIDEBAR
  const handleSaveEditLocation = async (id: string, updatedData: Partial<LocationItem>) => {
    const existing = locations.find((l) => l.id === id);

    if (existing) {
      const updated = await locationRepo.updateLocation(id, updatedData);
      if (updated) {
        setLocations((prev) => prev.map((l) => (l.id === id ? updated : l)));
        setEditingLocation(null);
        showToast(`Updated "${updated.name}" successfully`, 'success');
      }
    } else {
      // Unsaved place edited via EditLocationModal
      const newLocData: Omit<LocationItem, 'id' | 'createdAt'> = {
        name: updatedData.name || 'Selected Location',
        address: updatedData.address || '',
        cityRegion: updatedData.cityRegion || 'Chennai, India',
        lat: updatedData.lat || 0,
        lng: updatedData.lng || 0,
        category: updatedData.category || 'Travel',
        imageUrl: updatedData.imageUrl || '',
        tags: updatedData.tags || ['#location'],
        notes: updatedData.notes || '',
        isFavorite: updatedData.isFavorite || false,
      };
      const created = await locationRepo.createLocation(newLocData);
      setLocations((prev) => [created, ...prev]);
      setSelectedLocationId(created.id);
      setDiscoveredPlace(null);
      setTemporaryPin(null);
      setEditingLocation(null);
      setLatestSavedLocation(created);
      showToast(`Saved "${created.name}" to your Maply collection!`, 'success');
    }
  };

  // 7. DELETE SAVED LOCATION
  const handleConfirmDelete = async () => {
    if (!deletingLocationId) return;
    const target = locations.find((l) => l.id === deletingLocationId);
    if (!target) return;

    const success = await locationRepo.deleteLocation(deletingLocationId);
    if (success) {
      const remaining = locations.filter((l) => l.id !== deletingLocationId);
      setLocations(remaining);

      if (selectedLocationId === deletingLocationId) {
        // Close right side panel and stay at the exact same spot on the map
        setSelectedLocationId(null);
      }
      setDeletingLocationId(null);

      showToast(`Deleted "${target.name}"`, 'info', {
        label: 'Undo',
        onClick: async () => {
          await locationRepo.restoreLocation(target);
          setLocations((prev) => [target, ...prev]);
          setSelectedLocationId(target.id);
          showToast(`Restored "${target.name}"`, 'success');
        },
      });
    }
  };

  // 8. TOGGLE FAVORITE
  const handleToggleFavorite = async (id: string) => {
    const target = locations.find((l) => l.id === id);
    if (!target) return;
    const updated = await locationRepo.updateLocation(id, {
      isFavorite: !target.isFavorite,
    });
    if (updated) {
      setLocations((prev) => prev.map((l) => (l.id === id ? updated : l)));
      showToast(
        updated.isFavorite
          ? `Added "${updated.name}" to favorites`
          : `Removed "${updated.name}" from favorites`,
        'info'
      );
    }
  };

  const handleSidebarDirections = (loc: LocationItem) => {
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}`;
    try {
      const a = document.createElement('a');
      a.href = mapsUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      window.open(mapsUrl, '_blank', 'noopener,noreferrer');
    }
    showToast(`Opening Google Maps directions for "${loc.name}"...`, 'info');
  };

  const handleSidebarShare = async (loc: LocationItem) => {
    const shareUrl = `https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`;
    const shareText = `Explore "${loc.name}" on Maply: ${shareUrl}`;

    if (typeof navigator !== 'undefined' && navigator.share && window.isSecureContext) {
      try {
        await navigator.share({
          title: loc.name,
          text: shareText,
          url: shareUrl,
        });
        showToast(`Shared "${loc.name}" successfully!`, 'success');
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }

    let copied = false;
    try {
      await navigator.clipboard.writeText(shareUrl);
      copied = true;
    } catch {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = shareUrl;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        copied = document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch {
        copied = false;
      }
    }

    if (copied) {
      showToast(`Link for "${loc.name}" copied to clipboard!`, 'success');
    } else {
      showToast(`Share URL: ${shareUrl}`, 'info');
    }
  };

  // Zoom & Camera Controls
  const handleZoomIn = () => {
    if (mapRef.current && mapRef.current.isStyleLoaded()) {
      mapRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapRef.current && mapRef.current.isStyleLoaded()) {
      mapRef.current.zoomOut();
    }
  };

  // Fit all saved places into viewport
  const handleFitAllLocations = () => {
    const map = mapRef.current;
    if (!map || locations.length === 0) {
      showToast('No saved locations to fit into view', 'info');
      return;
    }
    const bounds = new mapboxgl.LngLatBounds();
    locations.forEach((loc) => bounds.extend([loc.lng, loc.lat]));
    map.fitBounds(bounds, { padding: 80, duration: 1000 });
    showToast(`Fitting all ${locations.length} saved places into view`, 'info');
  };

  // Center on user's real physical location (PART 8)
  const handleMyLocation = async () => {
    // Reset manual interaction so camera focuses cleanly on user location
    hasUserInteractedWithMap.current = false;

    // Deselect any previous place selection so map is cleanly showing current location
    setSelectedLocationId(null);
    setDiscoveredPlace(null);
    setTemporaryPin(null);

    // If we already have a location, center immediately so UI is responsive
    if (userLocation) {
      flyToCoordinates(userLocation.latitude, userLocation.longitude, 15);
    } else {
      showToast('Locating your position…', 'info');
    }

    // Always request a fresh high-accuracy position from device (maximumAge: 0)
    const loc = await requestLocation(true);
    if (loc) {
      flyToCoordinates(loc.latitude, loc.longitude, 15);
      showToast('Centered on your location', 'success');
    } else if (!userLocation) {
      showToast(
        geoError || 'Location permission is required to center Maply on your location.',
        'error'
      );
    }
  };

  // User Location Inspection Handler (shows address and opens Details Panel for current location)
  const handleUserLocationClick = useCallback(
    async (overrideCoords?: UserLocation) => {
      let coords = overrideCoords || userLocation;
      if (!coords) {
        showToast('Locating your position…', 'info');
        const fresh = await requestLocation(true);
        if (fresh) {
          coords = fresh;
        }
      }
      if (!coords) {
        showToast('Location permission is needed to resolve your current address.', 'error');
        return;
      }

      const lat = coords.latitude;
      const lng = coords.longitude;

      // Smoothly focus on current location
      flyToCoordinates(lat, lng, 15);

      // Deselect any saved place and remove temporary pin so no duplicate pin overlays the user puck
      setSelectedLocationId(null);
      setTemporaryPin(null);
      setIsLoadingPlaceDetails(true);

      try {
        const place = await mapboxPlaceService.reverseLookup(lng, lat);
        const currentLocationPlace: DiscoveredPlace = {
          ...(place || {}),
          id: `current-location-${lat.toFixed(5)}-${lng.toFixed(5)}`,
          // CRITICAL: Always preserve the user's exact coordinates, NEVER substitute with street/feature center
          latitude: lat,
          longitude: lng,
          name: place?.name && !place.name.includes('°') ? place.name : 'Current Location',
          address:
            place?.address ||
            `${lat.toFixed(5)}° N, ${lng.toFixed(5)}° E`,
          category: 'Current Location',
          featureType: 'address',
          source: 'mapbox',
        };
        setDiscoveredPlace(currentLocationPlace);
      } catch (err) {
        console.warn('Reverse lookup for current location failed:', err);
        const fallbackPlace: DiscoveredPlace = {
          id: `current-location-${lat.toFixed(5)}-${lng.toFixed(5)}`,
          name: 'Current Location',
          latitude: lat,
          longitude: lng,
          address: `${lat.toFixed(5)}° N, ${lng.toFixed(5)}° E`,
          category: 'Current Location',
          featureType: 'address',
          source: 'mapbox',
        };
        setDiscoveredPlace(fallbackPlace);
      } finally {
        setIsLoadingPlaceDetails(false);
      }
    },
    [userLocation, requestLocation, flyToCoordinates, showToast]
  );

  // Unified, seamless Add Place handler
  const handleAddNewPlace = useCallback(() => {
    setShowMobileSidebar(false);

    // Case 1: The user ALREADY chose a place on the map (discoveredPlace or temporaryPin)
    if (discoveredPlace) {
      setAddModalCoords({
        lat: discoveredPlace.latitude,
        lng: discoveredPlace.longitude,
      });
      setAddModalInitialPlace(discoveredPlace);
      setIsAddingMode(false);
      return;
    }

    if (temporaryPin) {
      setAddModalCoords({
        lat: temporaryPin.latitude,
        lng: temporaryPin.longitude,
      });
      setAddModalInitialPlace(null);
      setIsAddingMode(false);
      return;
    }

    // Case 2: The user has a saved location selected
    if (selectedLocation) {
      setAddModalCoords({
        lat: selectedLocation.lat,
        lng: selectedLocation.lng,
      });
      setAddModalInitialPlace(null);
      setIsAddingMode(false);
      return;
    }

    // Case 3: Map has a current viewport center - use it directly so modal opens instantly!
    const map = mapRef.current;
    if (map) {
      const center = map.getCenter();
      setAddModalCoords({
        lat: center.lat,
        lng: center.lng,
      });
      setAddModalInitialPlace(null);
      setIsAddingMode(false);
      return;
    }

    // Case 4: Fallback to user location if available
    if (userLocation) {
      setAddModalCoords({
        lat: userLocation.latitude,
        lng: userLocation.longitude,
      });
      setAddModalInitialPlace(null);
      setIsAddingMode(false);
      return;
    }

    // Otherwise, turn on pin drop mode
    setIsAddingMode(true);
    showToast('Click anywhere on the map to add a new location', 'info');
  }, [discoveredPlace, temporaryPin, selectedLocation, userLocation, showToast]);

  const handleToggleTheme = useCallback(() => {
    if (mapStyle === 'dark' || isDarkMode) {
      setMapStyle('satellite');
      setIsDarkMode(false);
      showToast('Switched map theme to Real-time Satellite View', 'info');
    } else {
      setMapStyle('dark');
      setIsDarkMode(true);
      showToast('Switched map theme to Dark Vector Theme', 'info');
    }
  }, [mapStyle, isDarkMode, showToast]);

  const handleCycleMapStyle = () => {
    const styles: MapStyleType[] = ['satellite', 'standard', 'dark'];
    const nextIndex = (styles.indexOf(mapStyle) + 1) % styles.length;
    const newStyle = styles[nextIndex];
    setMapStyle(newStyle);
    setIsDarkMode(newStyle === 'dark');
    showToast(`Switched map style to ${newStyle}`, 'info');
  };

  return (
    <div className="w-screen h-screen bg-[#070b0f] p-2 sm:p-3 overflow-hidden flex flex-col items-center justify-center select-none relative font-sans">
      {/* Outer Rounded Immersive Container */}
      <div className="relative w-full h-full rounded-[28px] md:rounded-[32px] overflow-hidden border border-white/10 shadow-[0_25px_70px_rgba(0,0,0,0.8)] flex bg-[#0b1015]">
        {/* Subtle Liquid Glass Geolocation Status indicator while locating */}
        {isLocating && (
          <div className="absolute top-5 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full liquid-glass border border-white/20 text-xs text-slate-100 shadow-2xl backdrop-blur-xl">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              <span className="font-medium text-[11px] text-slate-100">Finding your location…</span>
            </div>
          </div>
        )}

        {/* REAL INTERACTIVE SATELLITE MAP HERO (Background Layer) */}
        <div className="absolute inset-0 w-full h-full z-0">
          <MapView
            locations={filteredLocations}
            selectedLocationId={discoveredPlace ? null : selectedLocationId}
            selectedPlace={activeDetailsPlace}
            temporaryPin={temporaryPin}
            userLocation={userLocation}
            onSelectLocation={handleSelectLocation}
            onSelectPlace={handleSelectDiscoveredPlace}
            onPoiClick={handlePoiClick}
            onMapClick={handleMapClick}
            onUserLocationClick={handleUserLocationClick}
            onUserLocationCalibrate={handleUserLocationCalibrate}
            onUserInteract={() => {
              hasUserInteractedWithMap.current = true;
            }}
            isAddingMode={isAddingMode}
            mapStyle={mapStyle}
            mapRefExternal={mapRef}
            onMapReady={handleMapReady}
          />
        </div>
      </div>

      {/* --- ALL DESKTOP UI SURFACES MUST LIVE HERE AS DIRECT CHILDREN OF THE ROOT FULL-VIEWPORT LAYER --- */}

      {/* 2. MOBILE MENU TOGGLE BUTTON (Mobile only) */}
      <div className="lg:hidden absolute top-3 left-3 z-30 pointer-events-auto">
          <button
            onClick={() => setShowMobileSidebar(!showMobileSidebar)}
            aria-label="Toggle Navigation"
            className="w-10 h-10 rounded-2xl liquid-glass border border-white/15 flex items-center justify-center text-white shadow-xl cursor-pointer"
          >
            {showMobileSidebar ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* 3. INDEPENDENT LEFT SIDEBAR (Desktop: 338px fixed glass panel, Mobile: Drawer) */}
        <div
          className={`pointer-events-auto transition-all duration-300 box-border shrink-0 ${
            showMobileSidebar
              ? 'fixed inset-y-3 left-3 z-50 block w-[338px]'
              : 'hidden lg:block fixed left-[12px] top-[8px] bottom-[8px] w-[338px] min-w-[338px] max-w-[338px] z-20'
          }`}
        >
          <Sidebar
            locations={locations}
            selectedLocationId={discoveredPlace ? null : selectedLocationId}
            onSelectLocation={(id) => {
              handleSelectLocation(id);
              setShowMobileSidebar(false);
            }}
            onAddNewPlaceClick={handleAddNewPlace}
            isAddingMode={isAddingMode}
            activeNavTab={activeNavTab}
            setActiveNavTab={setActiveNavTab}
            onOpenMyPlacesModal={() => setIsMyPlacesModalOpen(true)}
            onOpenCategoriesModal={() => setIsCategoriesModalOpen(true)}
            onDeleteLocation={(id) => {
              setDeletingLocationId(id);
            }}
            onEditLocation={(loc) => {
              setEditingLocation(loc);
            }}
            onDirectionsLocation={(loc) => {
              handleSidebarDirections(loc);
            }}
            onShareLocation={(loc) => {
              handleSidebarShare(loc);
            }}
            onToggleFavorite={handleToggleFavorite}
            onCycleMapStyle={handleCycleMapStyle}
            currentMapStyle={mapStyle}
            currentUser={currentUser}
          />
        </div>

        {/* 4. INDEPENDENT TOP SEARCH (Desktop: 400px x 42px, centered in central map region) */}
        <div className="fixed top-[45px] left-[calc(50%-16px)] -translate-x-1/2 w-[calc(100vw-88px)] sm:w-[400px] min-w-[400px] max-w-[400px] h-[42px] z-[21] pointer-events-auto flex justify-center box-border shrink-0">
          <TopSearchBar
            locations={locations}
            onSelectSavedLocation={handleSelectLocation}
            onSelectDiscoveredPlace={handleSelectDiscoveredPlace}
            getCurrentCenter={() => {
              if (mapRef.current) {
                const c = mapRef.current.getCenter();
                return { latitude: c.lat, longitude: c.lng };
              }
              if (userLocation) {
                return { latitude: userLocation.latitude, longitude: userLocation.longitude };
              }
              return undefined;
            }}
          />
        </div>

        {/* 5. INDEPENDENT GREETING & CATEGORY PILLS (Floating directly on map, placed below search bar) */}
        <div className="hidden sm:flex fixed left-[356px] top-[96px] z-20 pointer-events-auto flex-col text-left box-border shrink-0">
          <div className="mb-2 text-left">
            <h2 className="text-[18px] font-normal tracking-tight text-white drop-shadow-md leading-none mb-1">
              {new Date().getHours() < 12
                ? 'Good Morning,'
                : new Date().getHours() < 17
                ? 'Good Afternoon,'
                : 'Good Evening,'}
            </h2>
            <h1 className="font-bold text-white text-[26px] tracking-tight drop-shadow-md leading-none mb-2">
              {currentUser?.name || currentUser?.username || 'Arjun'}
            </h1>
            <p className="text-[12px] text-slate-200/90 font-medium drop-shadow mt-1">
              Explore. Save. Revisit.
            </p>
            <p className="text-[12px] text-slate-400 font-normal">
              Your favorite places, always with you.
            </p>
          </div>
          <div className="mt-3">
            <CategoryPills
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              counts={categoryCounts}
            />
          </div>
        </div>

        {/* 6. INDEPENDENT TOP-RIGHT CONTROLS (Top right, independent from details panel) */}
        <div className="fixed top-[32px] right-[28px] z-22 pointer-events-auto hidden sm:flex items-center gap-2.5 box-border shrink-0">
          <TopRightControls
            cityName={
              selectedLocation
                ? (selectedLocation.cityRegion || selectedLocation.name)
                : userLocation
                ? 'Current Region'
                : 'Live Satellite'
            }
            weatherText={isDarkMode ? 'Dark Vector View' : 'Aerial HD View'}
            isDarkMode={isDarkMode}
            onToggleTheme={handleToggleTheme}
            savedCount={locations.length}
            currentUser={currentUser}
            onLogout={onLogout}
            onBackToLanding={onBackToLanding}
            latestSavedLocation={latestSavedLocation}
          />
        </div>

        {/* 7. INDEPENDENT BOTTOM ACTION DOCK (Desktop: 390px x 105px, perfectly centered in map viewport) */}
        <div className="fixed bottom-[32px] left-1/2 -translate-x-1/2 z-[21] pointer-events-auto box-border shrink-0">
          <ActionDock
            onAddPlaceClick={handleAddNewPlace}
            isAddingMode={isAddingMode}
            onSearchClick={() => {
              const searchInput = document.querySelector(
                'input[placeholder*="Search locations"], input[placeholder*="Search places"]'
              ) as HTMLInputElement;
              searchInput?.focus();
            }}
            onMyLocationClick={handleMyLocation}
            onToggleMapStyle={handleCycleMapStyle}
            currentMapStyle={mapStyle}
          />
        </div>

        {/* 8. INDEPENDENT MAP CONTROLS (Positioned at right-[365px], completely to the left of the right sidebar drawer) */}
        <div className="fixed bottom-[32px] right-[365px] z-22 pointer-events-auto">
          <MapControls
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onLocateUser={handleMyLocation}
            onFitAllLocations={handleFitAllLocations}
            mapStyle={mapStyle}
            onToggleMapStyle={handleCycleMapStyle}
            isCalibrated={isCalibrated}
          />
        </div>

        {/* 9. ELEGANT WATERMARK (Far Right Corner under right panel matching reference image) */}
        <div className="hidden xl:flex flex-col items-end pointer-events-none select-none fixed bottom-[32px] right-[28px] z-10 text-right opacity-40 font-serif italic text-xs text-slate-300 tracking-wider leading-tight">
          <span>Collect Moments</span>
          <span>Explore the World</span>
        </div>

        {/* TOP-LEVEL FLOATING DETAILS PANEL OVERLAY */}
        {activeDetailsPlace && (
          <LocationDetailsPanel
            key={
              activeDetailsPlace.id ||
              activeDetailsPlace.mapboxId ||
              `${activeDetailsPlace.latitude}_${activeDetailsPlace.longitude}_${activeDetailsPlace.name}`
            }
            place={activeDetailsPlace}
            savedLocation={activeMatchingSavedLocation}
            isLoading={isLoadingPlaceDetails}
            onClose={() => {
              if (discoveredPlace) {
                setDiscoveredPlace(null);
                setTemporaryPin(null);
              } else {
                setSelectedLocationId(null);
              }
            }}
            onSavePlace={handleSavePlace}
            onEditSaved={(loc) => setEditingLocation(loc)}
            onDeleteSaved={(id) => setDeletingLocationId(id)}
            onToggleFavorite={handleToggleFavorite}
            onSelectNearbyPlace={handleSelectDiscoveredPlace}
            onShowToast={showToast}
            userLocation={userLocation}
            onSetAsCurrentLocation={handleSetAsCurrentLocation}
            isCurrentLocationCalibrated={isCalibrated}
            onResetLocationCalibration={handleResetLocationCalibration}
            onOpenAddModal={(p) => {
              // Check if place is already saved
              const match = locations.find(
                (l) =>
                  (l.placeId && p.mapboxId && l.placeId === p.mapboxId) ||
                  (l.providerId && p.providerId && l.providerId === p.providerId) ||
                  (Math.abs(l.lat - p.latitude) < 0.0008 && Math.abs(l.lng - p.longitude) < 0.0008)
              );

              if (match) {
                setSelectedLocationId(match.id);
                setEditingLocation(match);
                return;
              }

              // Open EditLocationModal directly for unsaved place
              const tempItem: LocationItem = {
                id: `temp-${Date.now()}`,
                placeId: p.mapboxId || p.providerId,
                providerId: p.providerId || p.mapboxId,
                name: p.name || 'Selected Location',
                address: p.address || `${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}`,
                cityRegion: p.city ? `${p.city}, India` : 'Chennai, India',
                lat: p.latitude,
                lng: p.longitude,
                latitude: p.latitude,
                longitude: p.longitude,
                category: (p.category as any) || 'Travel',
                imageUrl: p.photos?.[0]?.url || '',
                imageAlt: p.name,
                tags: ['#location', '#maply'],
                notes: '',
                isFavorite: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              setEditingLocation(tempItem);
            }}
          />
        )}

        {/* MODALS */}
        {addModalCoords && (
          <AddLocationModal
            isOpen={Boolean(addModalCoords)}
            coords={addModalCoords}
            initialPlace={addModalInitialPlace}
            onClose={() => {
              setAddModalCoords(null);
              setAddModalInitialPlace(null);
            }}
            onSave={handleSaveNewLocation}
          />
        )}

        {editingLocation && (
          <EditLocationModal
            isOpen={Boolean(editingLocation)}
            location={editingLocation}
            onClose={() => setEditingLocation(null)}
            onSave={(updates) => handleSaveEditLocation(editingLocation.id, updates)}
          />
        )}

        {deletingLocationId && (
          <DeleteConfirmDialog
            isOpen={Boolean(deletingLocationId)}
            locationName={
              locations.find((l) => l.id === deletingLocationId)?.name || 'this location'
            }
            onClose={() => setDeletingLocationId(null)}
            onCancel={() => setDeletingLocationId(null)}
            onConfirm={handleConfirmDelete}
          />
        )}

        {isMyPlacesModalOpen && (
          <MyPlacesModal
            isOpen={isMyPlacesModalOpen}
            onClose={() => setIsMyPlacesModalOpen(false)}
            locations={locations}
            selectedLocationId={selectedLocationId}
            onSelectLocation={handleSelectLocation}
            onDeleteLocation={(id) => setDeletingLocationId(id)}
            onEditLocation={(loc) => setEditingLocation(loc)}
            onDirectionsLocation={handleSidebarDirections}
            onToggleFavorite={handleToggleFavorite}
          />
        )}

        {isCategoriesModalOpen && (
          <CategoriesModal
            isOpen={isCategoriesModalOpen}
            onClose={() => setIsCategoriesModalOpen(false)}
            locations={locations}
            onSelectLocation={handleSelectLocation}
          />
        )}

        {/* Global Toast Notifications */}
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};
