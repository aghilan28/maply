import React, { useState, useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { LocationItem, MapStyleType } from '../../types/location';
import { Place, DiscoveredPlace, NormalizedPlace } from '../../types/place';
import { normalizeMapboxFeature } from '../../services/normalizeMapboxFeature';
import { UserLocation, computeDistanceMeters } from '../../hooks/useUserLocation';
import { getMarkerCategoryStyle, CATEGORY_STYLES } from '../../utils/categoryStyles';

interface MapViewProps {
  locations: LocationItem[];
  selectedLocationId: string | null;
  selectedPlace?: Place | DiscoveredPlace | null;
  temporaryPin: { latitude: number; longitude: number; label?: string } | null;
  userLocation?: UserLocation | null;
  onSelectLocation: (id: string) => void;
  onSelectPlace?: (place: DiscoveredPlace) => void;
  onPoiClick?: (poi: DiscoveredPlace) => void;
  onMapClick: (lat: number, lng: number) => void;
  onUserLocationClick?: (coords?: UserLocation) => void;
  onUserLocationCalibrate?: (lat: number, lng: number) => void;
  onUserInteract?: () => void;
  onMapReady?: (map: mapboxgl.Map) => void;
  isAddingMode: boolean;
  mapStyle: MapStyleType;
  mapRefExternal?: React.MutableRefObject<mapboxgl.Map | null>;
}

// Category styling for saved locations matching the UI reference
// Strictly uses authentic category icons (Compass for Travel, Landmark for History, Tree for Nature, etc.)
// No category ever uses an airplane or airport-style icon for non-airport places.


// Fallback high-resolution satellite style object for Mapbox GL JS if token is not provided or fails
const FALLBACK_SATELLITE_STYLE: any = {
  version: 8,
  sources: {
    'esri-imagery': {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: 'Esri, Maxar, Earthstar Geographics',
      maxzoom: 19,
    },
    'carto-labels': {
      type: 'raster',
      tiles: [
        'https://cartodb-basemaps-a.global.ssl.fastly.net/dark_only_labels/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      maxzoom: 19,
    }
  },
  layers: [
    {
      id: 'satellite-tiles',
      type: 'raster',
      source: 'esri-imagery',
      minzoom: 0,
      maxzoom: 22,
    },
    {
      id: 'labels-tiles',
      type: 'raster',
      source: 'carto-labels',
      minzoom: 3,
      maxzoom: 22,
    }
  ],
};

export const MapView: React.FC<MapViewProps> = ({
  locations,
  selectedLocationId,
  selectedPlace,
  temporaryPin,
  userLocation,
  onSelectLocation,
  onSelectPlace,
  onPoiClick,
  onMapClick,
  onUserLocationClick,
  onUserLocationCalibrate,
  onUserInteract,
  onMapReady,
  isAddingMode,
  mapStyle,
  mapRefExternal,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const tempMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const onPoiClickRef = useRef(onPoiClick);
  const onMapClickRef = useRef(onMapClick);
  const onUserLocationClickRef = useRef(onUserLocationClick);
  const onUserLocationCalibrateRef = useRef(onUserLocationCalibrate);
  const onUserInteractRef = useRef(onUserInteract);
  const onMapReadyRef = useRef(onMapReady);
  const isAddingModeRef = useRef(isAddingMode);
  const hasUserInteractedRef = useRef(false);

  useEffect(() => {
    onUserLocationClickRef.current = onUserLocationClick;
    onUserLocationCalibrateRef.current = onUserLocationCalibrate;
  }, [onUserLocationClick, onUserLocationCalibrate]);

  useEffect(() => {
    onPoiClickRef.current = onPoiClick;
    onMapClickRef.current = onMapClick;
    onUserInteractRef.current = onUserInteract;
    onMapReadyRef.current = onMapReady;
    isAddingModeRef.current = isAddingMode;
  }, [onPoiClick, onMapClick, onUserInteract, onMapReady, isAddingMode]);

  const token = (import.meta.env.VITE_MAPBOX_TOKEN as string) || '';

  // Configure Mapbox Standard / Standard Satellite basemap properties
  const configureStandardBasemap = useCallback((map: mapboxgl.Map) => {
    if (!map || typeof (map as any).setConfigProperty !== 'function') return;

    // Standard Basemap configuration properties
    // Keeps POI badges, transit icons, landmarks, and 3d objects active
    const standardConfigs: Record<string, boolean | string> = {
      showPlaceLabels: true,
      showPointOfInterestLabels: true,
      showRoadLabels: true,
      showTransitLabels: true,
      showLandmarkIcons: true,
      showLandmarkIconLabels: true,
      showPedestrianRoads: false,
      show3dObjects: true,
      theme: 'default',
      // Natural cartographic low-saturation road and boundary tones
      colorRoads: 'hsl(220, 20%, 75%)',
      colorMotorways: 'hsl(220, 20%, 80%)',
      colorTrunks: 'hsl(220, 20%, 80%)',
      colorAdminBoundaries: 'rgba(148, 163, 184, 0.35)',
    };

    for (const [key, value] of Object.entries(standardConfigs)) {
      try {
        (map as any).setConfigProperty('basemap', key, value);
      } catch {
        // Gracefully ignore unsupported properties on minor versions
      }
    }
  }, []);

  // Road Visual Refinement & Unwanted Orange Overlay Audit/Removal
  const refineRoadVisualHierarchy = useCallback((map: mapboxgl.Map) => {
    if (!map) return;
    try {
      const style = map.getStyle();
      if (!style || !style.layers) return;

      // 1. Audit and remove any unwanted custom orange overlay, route, path, glow, or boundary layers
      style.layers.forEach((layer) => {
        const id = layer.id.toLowerCase();
        const type = layer.type;

        const isUnwantedOrangeOrFakeOverlay =
          id.includes('route') ||
          id.includes('path-overlay') ||
          id.includes('highlight') ||
          id.includes('orange') ||
          id.includes('glow') ||
          id.includes('marina-overlay') ||
          id.includes('fake') ||
          id.includes('custom-overlay');

        if (
          isUnwantedOrangeOrFakeOverlay &&
          !id.includes('road-path') &&
          !id.includes('tunnel-path') &&
          !id.includes('bridge-path')
        ) {
          try {
            if (map.getLayer(layer.id)) {
              map.removeLayer(layer.id);
              console.log('[Maply] removed unwanted geographic overlay:', layer.id);
            }
          } catch {
            // Ignore if layer not removable
          }
        }

        // Check for any line or fill paint properties with unnatural orange/amber colors
        if (type === 'line' || type === 'fill') {
          try {
            const lineColor = map.getPaintProperty(layer.id, 'line-color');
            const fillColor = map.getPaintProperty(layer.id, 'fill-color');
            const isOrangeColor = (val: any) => {
              if (typeof val === 'string') {
                const s = val.toLowerCase();
                return (
                  s.includes('#f97316') ||
                  s.includes('#fb923c') ||
                  s.includes('#ff8a00') ||
                  s.includes('#ff9800') ||
                  s.includes('#ea580c') ||
                  s.includes('#d97706') ||
                  s.includes('orange') ||
                  s.includes('rgb(255, 1')
                );
              }
              return false;
            };

            if (isOrangeColor(lineColor)) {
              map.setPaintProperty(layer.id, 'line-color', 'rgba(203, 213, 225, 0.4)');
              console.log('[Maply] removed unwanted geographic overlay:', layer.id);
            }
            if (isOrangeColor(fillColor)) {
              map.setPaintProperty(layer.id, 'fill-color', 'rgba(203, 213, 225, 0.15)');
              console.log('[Maply] removed unwanted geographic overlay:', layer.id);
            }
          } catch {
            // Expression or slot based
          }
        }

        // 2. Refine natural road hierarchy (subtle, low-saturation, non-distracting)
        const isRoadLine =
          type === 'line' &&
          (id.includes('road') ||
            id.includes('street') ||
            id.includes('highway') ||
            id.includes('motorway') ||
            id.includes('trunk') ||
            id.includes('primary') ||
            id.includes('secondary') ||
            id.includes('tertiary') ||
            id.includes('tunnel') ||
            id.includes('bridge') ||
            id.includes('transit') ||
            id.includes('link'));

        if (isRoadLine) {
          const isMajor =
            id.includes('motorway') ||
            id.includes('trunk') ||
            id.includes('primary') ||
            id.includes('freeway');
          const isSecondary =
            id.includes('secondary') ||
            id.includes('tertiary') ||
            id.includes('main');

          // Tone down line-opacity to be subtle, elegant, and integrated with aerial imagery
          try {
            const targetOpacity = isMajor ? 0.55 : isSecondary ? 0.38 : 0.24;
            map.setPaintProperty(layer.id, 'line-opacity', targetOpacity);
          } catch {
            // Expression or slot based
          }

          // Soften line-color to a muted, low-saturation neutral tone
          try {
            const subtleColor = isMajor
              ? 'rgba(241, 245, 249, 0.70)' // Translucent slate-100 for major highways
              : isSecondary
              ? 'rgba(203, 213, 225, 0.48)' // Muted slate-300 for secondary arterials
              : 'rgba(148, 163, 184, 0.30)'; // Low-saturation slate-400 for minor streets
            map.setPaintProperty(layer.id, 'line-color', subtleColor);
          } catch {
            // Expression or slot based
          }
        }

        // 3. Check for road labels / street names
        const isRoadLabel =
          type === 'symbol' &&
          (id.includes('road') || id.includes('street') || id.includes('highway'));

        if (isRoadLabel) {
          try {
            map.setPaintProperty(layer.id, 'text-opacity', 0.68);
            map.setPaintProperty(layer.id, 'text-halo-color', 'rgba(11, 17, 26, 0.85)');
            map.setPaintProperty(layer.id, 'text-halo-width', 1.2);
            map.setPaintProperty(layer.id, 'text-color', 'rgba(226, 232, 240, 0.88)');
          } catch {
            // Ignore
          }
        }
      });

      // Remove any lingering custom route sources if present
      if (typeof (map as any).getSource === 'function') {
        ['route', 'marina-route', 'orange-overlay', 'custom-overlay'].forEach((sId) => {
          try {
            if ((map as any).getSource(sId)) {
              (map as any).removeSource(sId);
              console.log('[Maply] removed unwanted geographic overlay:', sId);
            }
          } catch {
            // Ignore
          }
        });
      }
    } catch (err) {
      console.warn('Road visual hierarchy refinement error:', err);
    }
  }, []);

  // Resolve Mapbox style url or fallback style
  const getMapStyle = useCallback(() => {
    if (token) {
      if (mapStyle === 'satellite') {
        // Mapbox Standard Satellite: High-res aerial imagery + rich geographic info system
        return 'mapbox://styles/mapbox/standard-satellite';
      }
      if (mapStyle === 'standard') {
        // Clean vector basemap with standard features
        return 'mapbox://styles/mapbox/standard';
      }
      if (mapStyle === 'dark') {
        return 'mapbox://styles/mapbox/dark-v11';
      }
      if (mapStyle === 'satellite-streets') {
        return 'mapbox://styles/mapbox/standard-satellite';
      }
      return 'mapbox://styles/mapbox/standard-satellite';
    }
    return FALLBACK_SATELLITE_STYLE;
  }, [token, mapStyle]);

  const currentStyleRef = useRef<string | object>(getMapStyle());

  // Initialize Mapbox Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    if (token) {
      mapboxgl.accessToken = token;
    }

    // Initial camera: If userLocation is already available at startup, start directly on it!
    let initialCenter: [number, number] = [0, 20];
    let initialZoom = 2.2;
    let initialPitch = 0;
    let initialBearing = 0;

    if (userLocation) {
      initialCenter = [userLocation.longitude, userLocation.latitude];
      initialZoom = 14;
      initialPitch = 32;
      initialBearing = -5;
    } else {
      try {
        const savedCamera = localStorage.getItem('maply_last_camera');
        if (savedCamera) {
          const parsed = JSON.parse(savedCamera);
          if (Array.isArray(parsed.center) && parsed.center.length === 2) {
            initialCenter = [parsed.center[0], parsed.center[1]];
            initialZoom = typeof parsed.zoom === 'number' ? parsed.zoom : 13;
            initialPitch = typeof parsed.pitch === 'number' ? parsed.pitch : 32;
            initialBearing = typeof parsed.bearing === 'number' ? parsed.bearing : -5;
          }
        }
      } catch {
        // Ignore
      }
    }

    const initialStyle = getMapStyle();
    currentStyleRef.current = initialStyle;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: initialStyle,
      center: initialCenter,
      zoom: initialZoom,
      pitch: initialPitch,
      bearing: initialBearing,
      projection: { name: 'mercator' }, // Explicit mercator projection eliminates adaptive projection crashes on startup
      attributionControl: false,
    });

    mapInstanceRef.current = map;
    if (mapRefExternal) {
      mapRefExternal.current = map;
    }

    const onReadyHandler = () => {
      setIsMapLoaded(true);
      configureStandardBasemap(map);
      refineRoadVisualHierarchy(map);
      console.log('[Maply] map ready');
      if (onMapReadyRef.current) {
        onMapReadyRef.current(map);
      }
    };

    // Mark loaded when style has loaded and apply Standard Basemap configs & road refinement
    map.on('style.load', onReadyHandler);
    map.on('load', onReadyHandler);

    // Track user camera interaction
    map.on('movestart', (e) => {
      if (e.originalEvent) {
        hasUserInteractedRef.current = true;
        onUserInteractRef.current?.();
      }
    });

    // Save camera to localStorage on moveend (only if user interacted)
    map.on('moveend', () => {
      if (!hasUserInteractedRef.current) return;
      try {
        const center = map.getCenter();
        const zoom = map.getZoom();
        const pitch = map.getPitch();
        const bearing = map.getBearing();
        localStorage.setItem(
          'maply_last_camera',
          JSON.stringify({
            center: [center.lng, center.lat],
            zoom,
            pitch,
            bearing,
          })
        );
      } catch {
        // Ignore
      }
    });

    // Gracefully handle token or network errors
    map.on('error', (e) => {
      const status = (e as any)?.error?.status;
      if (status === 401 || status === 403) {
        console.warn('Mapbox token error, falling back to raster satellite tiles:', e);
        if (currentStyleRef.current !== FALLBACK_SATELLITE_STYLE) {
          currentStyleRef.current = FALLBACK_SATELLITE_STYLE;
          try {
            map.setStyle(FALLBACK_SATELLITE_STYLE);
          } catch (err) {
            console.warn('Fallback setStyle error:', err);
          }
        }
      }
    });

    // Helper: Identify actual POI/label layer id(s) from current Mapbox style
    const getPoiLayerIds = (): string[] => {
      try {
        const style = map.getStyle();
        if (!style || !style.layers) return [];

        const poiLayers = style.layers
          .map((l) => l.id)
          .filter((id) => {
            const lower = id.toLowerCase();
            // Strictly exclude non-POI layers: roads, streets, highways, buildings, raster, landuse, boundaries
            if (
              lower.includes('road') ||
              lower.includes('street') ||
              lower.includes('highway') ||
              lower.includes('motorway') ||
              lower.includes('building') ||
              lower.includes('satellite') ||
              lower.includes('raster') ||
              lower.includes('background') ||
              lower.includes('landuse') ||
              lower.includes('admin') ||
              lower.includes('boundary') ||
              lower.includes('waterway')
            ) {
              return false;
            }
            return (
              lower === 'poi-label' ||
              lower === 'poi' ||
              lower.startsWith('poi-') ||
              lower.endsWith('-poi') ||
              lower.includes('point-of-interest') ||
              lower === 'transit-label'
            );
          });

        if (poiLayers.length > 0) return poiLayers;
        if (map.getLayer('poi-label')) return ['poi-label'];
        return [];
      } catch {
        return [];
      }
    };

    // Helper: Safely resolve feature coordinates (WGS84 degrees vs local vector tile units)
    const getFeatureCoordinates = (
      feature: mapboxgl.MapboxGeoJSONFeature,
      fallbackLngLat: mapboxgl.LngLat
    ): [number, number] => {
      const geom = feature.geometry;
      if (
        geom &&
        geom.type === 'Point' &&
        Array.isArray(geom.coordinates) &&
        typeof geom.coordinates[0] === 'number' &&
        typeof geom.coordinates[1] === 'number'
      ) {
        const [gLng, gLat] = geom.coordinates;
        if (Math.abs(gLng) <= 180 && Math.abs(gLat) <= 90 && (gLng !== 0 || gLat !== 0)) {
          return [gLng, gLat];
        }
      }
      return [fallbackLngLat.lng, fallbackLngLat.lat];
    };

    // Map Click Listener - Step 1: Query actual rendered POI feature FIRST
    map.on('click', (e) => {
      const point = e.point;

      if (isAddingModeRef.current) {
        onMapClickRef.current?.(e.lngLat.lat, e.lngLat.lng);
        return;
      }

      // Small tolerance bounding box (6px) matching Mapbox POI click guidelines
      const bbox: [mapboxgl.PointLike, mapboxgl.PointLike] = [
        [point.x - 6, point.y - 6],
        [point.x + 6, point.y + 6],
      ];

      const poiLayers = getPoiLayerIds();
      let poiFeatures: mapboxgl.MapboxGeoJSONFeature[] = [];

      try {
        if (poiLayers.length > 0) {
          poiFeatures = map.queryRenderedFeatures(bbox, { layers: poiLayers });
        }
      } catch (err) {
        console.warn('[Maply] Querying POI layers failed:', err);
      }

      // If specific layer query was empty, check if 'poi-label' exists directly
      if (poiFeatures.length === 0 && map.getLayer('poi-label')) {
        try {
          poiFeatures = map.queryRenderedFeatures(bbox, { layers: ['poi-label'] });
        } catch {
          // ignore
        }
      }

      // Fallback: If style uses unconventional layer names, search rendered symbol features
      // with a POI class and name, strictly excluding roads/buildings/streets
      if (poiFeatures.length === 0) {
        try {
          const allFeatures = map.queryRenderedFeatures(bbox);
          const candidate = allFeatures.find((f) => {
            const p = f.properties || {};
            const name = p.name || p.name_en || p['name:latin'] || p.name_preferred;
            if (!name) return false;
            const lid = (f.layer?.id || '').toLowerCase();
            if (
              lid.includes('road') ||
              lid.includes('street') ||
              lid.includes('highway') ||
              lid.includes('building') ||
              lid.includes('satellite') ||
              lid.includes('background') ||
              lid.includes('admin')
            ) {
              return false;
            }
            return (
              lid.includes('poi') ||
              lid.includes('transit') ||
              Boolean(p.class && !lid.includes('road')) ||
              Boolean(p.maki)
            );
          });
          if (candidate) {
            poiFeatures = [candidate];
          }
        } catch {
          // ignore
        }
      }

      // Step 2: If clicked on a POI, check if it matches an existing saved location first
      if (poiFeatures.length > 0) {
        const feature = poiFeatures[0];
        const [lng, lat] = getFeatureCoordinates(feature, e.lngLat);
        const properties = feature.properties ?? {};

        const name =
          properties.name ??
          properties.name_en ??
          properties['name:latin'] ??
          properties.name_preferred ??
          'Unknown place';

        // Check if this POI is directly underneath/overlapping an existing saved location
        const matchingSaved = locations.find(
          (l) =>
            (Math.abs(l.lat - lat) < 0.0008 && Math.abs(l.lng - lng) < 0.0008) ||
            l.name.toLowerCase() === String(name).toLowerCase()
        );
        if (matchingSaved) {
          onSelectLocation(matchingSaved.id);
          return;
        }

        const category =
          properties.class ??
          properties.type ??
          properties.category ??
          properties.maki ??
          'Point of Interest';

        const normalizedPlace: NormalizedPlace = {
          featureType: 'poi',
          name: String(name),
          latitude: lat,
          longitude: lng,
          category: String(category),
          providerId: properties.mapbox_id ? String(properties.mapbox_id) : undefined,
          mapboxId: properties.mapbox_id ? String(properties.mapbox_id) : undefined,
          source: 'mapbox-poi-click',
          rawProviderData: properties,
        };

        onPoiClickRef.current?.(normalizedPlace);
        return;
      }

      // Step 4: No POI feature under the click — fall back to reverse geocoding for a
      // plain address/street click, which is the only case this should be used for.
      onMapClickRef.current?.(e.lngLat.lat, e.lngLat.lng);
    });

    // Cursor pointer on interactive POI elements
    map.on('mousemove', (e) => {
      if (isAddingMode) return;
      try {
        const bbox: [mapboxgl.PointLike, mapboxgl.PointLike] = [
          [e.point.x - 6, e.point.y - 6],
          [e.point.x + 6, e.point.y + 6],
        ];
        const poiLayers = getPoiLayerIds();
        let hasPoi = false;
        if (poiLayers.length > 0) {
          const hits = map.queryRenderedFeatures(bbox, { layers: poiLayers });
          hasPoi = hits.length > 0;
        } else if (map.getLayer('poi-label')) {
          const hits = map.queryRenderedFeatures(bbox, { layers: ['poi-label'] });
          hasPoi = hits.length > 0;
        }
        const canvas = map.getCanvas();
        if (canvas) {
          canvas.style.cursor = hasPoi ? 'pointer' : 'grab';
        }
      } catch {
        // Ignore
      }
    });

    map.on('mouseenter', () => {
      const canvas = map.getCanvas();
      if (canvas) {
        canvas.style.cursor = isAddingMode ? 'crosshair' : 'grab';
      }
    });

    return () => {
      setIsMapLoaded(false);
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();
      if (tempMarkerRef.current) {
        tempMarkerRef.current.remove();
        tempMarkerRef.current = null;
      }
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      map.remove();
      mapInstanceRef.current = null;
      if (mapRefExternal) {
        mapRefExternal.current = null;
      }
    };
  }, []);

  // Update cursor style when isAddingMode changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    try {
      const canvas = map.getCanvas();
      if (canvas) {
        canvas.style.cursor = isAddingMode ? 'crosshair' : 'grab';
      }
    } catch {
      // Ignored if canvas destroyed
    }
  }, [isAddingMode]);

  // Update map style ONLY after map is loaded and style has actually changed
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isMapLoaded) return;

    const targetStyle = getMapStyle();
    if (currentStyleRef.current === targetStyle) return;

    currentStyleRef.current = targetStyle;
    try {
      map.setStyle(targetStyle);
      map.once('style.load', () => {
        configureStandardBasemap(map);
        refineRoadVisualHierarchy(map);
      });
    } catch (err) {
      console.warn('Map style update failed:', err);
    }
  }, [getMapStyle, isMapLoaded, configureStandardBasemap, refineRoadVisualHierarchy]);

  // Render Saved Location Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isMapLoaded) return;

    const currentMarkerIds = new Set(locations.map((l) => l.id));

    // Remove markers that are no longer in locations
    markersRef.current.forEach((marker, id) => {
      if (!currentMarkerIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    // Create or update markers - exactly ONE marker per location ID
    locations.forEach((loc) => {
      const isSelected = loc.id === selectedLocationId;
      const categoryStyle = getMarkerCategoryStyle(loc);

      let marker = markersRef.current.get(loc.id);

      // Create DOM element for marker
      const el = document.createElement('div');
      el.className = 'maply-marker-wrapper cursor-pointer select-none';
      el.setAttribute('data-location-id', loc.id);

      if (isSelected) {
        // Liquid Glass selected place marker badge with glowing stem pointer
        el.innerHTML = `
          <div class="relative flex flex-col items-center pointer-events-auto">
            <div class="relative flex items-center gap-2 px-3 py-1.5 rounded-2xl border backdrop-blur-2xl shadow-2xl transition-transform duration-200 hover:scale-105"
                 style="background: linear-gradient(135deg, ${categoryStyle.glassBg}, rgba(11, 19, 36, 0.92)); border-color: ${categoryStyle.border}; box-shadow: 0 0 22px ${categoryStyle.glow}, inset 0 1px 1px rgba(255, 255, 255, 0.35);">
              <span class="shrink-0 flex items-center justify-center" style="color: ${categoryStyle.iconColor}; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">${categoryStyle.iconSvg}</span>
              <span class="text-[12px] font-bold text-white tracking-tight whitespace-nowrap">${loc.name}</span>
            </div>
            <div class="w-0.5 h-3" style="background-color: ${categoryStyle.border}; opacity: 0.9;"></div>
            <div class="w-3 h-3 rounded-full border-2 border-slate-900 shadow-md -mt-1" style="background-color: ${categoryStyle.border}; box-shadow: 0 0 12px ${categoryStyle.glow};"></div>
          </div>
        `;
      } else {
        // Liquid Glass unselected map marker badge
        el.innerHTML = `
          <div class="relative flex flex-col items-center pointer-events-auto group">
            <div class="w-9 h-9 rounded-2xl flex items-center justify-center backdrop-blur-xl border transition-all duration-300 group-hover:scale-115 group-hover:-translate-y-1 shadow-2xl"
                 style="background: linear-gradient(135deg, ${categoryStyle.glassBg}, rgba(11, 19, 36, 0.88)); border-color: ${categoryStyle.border}; box-shadow: 0 6px 20px ${categoryStyle.glow}, inset 0 1px 1px rgba(255, 255, 255, 0.3);">
              <span class="flex items-center justify-center" style="color: ${categoryStyle.iconColor}; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">${categoryStyle.iconSvg}</span>
            </div>
            <div class="w-0.5 h-2.5 transition-colors" style="background-color: ${categoryStyle.border}; opacity: 0.8;"></div>
            <div class="w-2.5 h-2.5 rounded-full border border-slate-900 shadow-md -mt-1" style="background-color: ${categoryStyle.border}; box-shadow: 0 0 8px ${categoryStyle.glow};"></div>
            <div class="absolute -top-8 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none px-2.5 py-1 rounded-xl bg-slate-950/90 backdrop-blur-md text-[11px] font-semibold text-white whitespace-nowrap border border-white/20 shadow-2xl">
              ${loc.name}
            </div>
          </div>
        `;
      }

      const bindMarkerEvents = (markerEl: HTMLElement) => {
        markerEl.onclick = (e: MouseEvent) => {
          e.stopPropagation();
          onSelectLocation(loc.id);
        };
        markerEl.onmousedown = (e: MouseEvent) => e.stopPropagation();
        markerEl.onmouseup = (e: MouseEvent) => e.stopPropagation();
        markerEl.ontouchstart = (e: TouchEvent) => e.stopPropagation();
        markerEl.ontouchend = (e: TouchEvent) => e.stopPropagation();
      };

      if (marker) {
        marker.setLngLat([loc.lng, loc.lat]);
        // Update DOM element and re-attach click handler to active marker element
        const markerEl = marker.getElement();
        markerEl.innerHTML = el.innerHTML;
        bindMarkerEvents(markerEl);
      } else {
        bindMarkerEvents(el);
        marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([loc.lng, loc.lat])
          .addTo(map);
        markersRef.current.set(loc.id, marker);
      }
    });
  }, [locations, selectedLocationId, onSelectLocation, isMapLoaded]);

  // Render Temporary Pin (for arbitrary map clicks or search discoveries not yet saved)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isMapLoaded) return;

    if (!temporaryPin) {
      if (tempMarkerRef.current) {
        tempMarkerRef.current.remove();
        tempMarkerRef.current = null;
      }
      return;
    }

    // If temporary pin is already at the same location as the selected saved location, don't show duplicate
    const matchingSaved = locations.find(
      (l) =>
        Math.abs(l.lat - temporaryPin.latitude) < 0.0001 &&
        Math.abs(l.lng - temporaryPin.longitude) < 0.0001
    );
    if (matchingSaved && selectedLocationId === matchingSaved.id) {
      if (tempMarkerRef.current) {
        tempMarkerRef.current.remove();
        tempMarkerRef.current = null;
      }
      return;
    }

    // Calculate distance from current reported GPS location
    const distFromUserMeters = userLocation
      ? computeDistanceMeters(
          userLocation.latitude,
          userLocation.longitude,
          temporaryPin.latitude,
          temporaryPin.longitude
        )
      : Infinity;

    // Proximity constraint: ONLY show calibration action if within 250 meters of reported GPS
    // (i.e. fine-tuning the exact building or house on your street).
    // Everywhere else on the map, the pin remains a pristine, uncluttered place label without buttons.
    const isWithinCalibrationMeters = distFromUserMeters <= 250;

    const pinContent = isWithinCalibrationMeters
      ? `
      <div class="relative flex flex-col items-center pointer-events-auto">
        <div class="relative flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full shadow-2xl bg-cyan-600 border border-cyan-300 text-white font-semibold text-[11px] whitespace-nowrap transition-transform duration-150 hover:scale-105">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m16 12-4-4-4 4"/><path d="M12 16V8"/></svg>
          <span class="max-w-[200px] truncate">${temporaryPin.label || 'Inspecting Place'}</span>
          <button
            id="temp-pin-set-location-btn"
            class="ml-1 px-2 py-0.5 rounded-full bg-cyan-950/90 hover:bg-black border border-cyan-200/60 text-[10px] text-cyan-200 hover:text-white flex items-center gap-1 transition-all cursor-pointer shadow-md hover:scale-105 active:scale-95"
            title="Fine-tune GPS to this exact building (${Math.round(distFromUserMeters)}m from current GPS)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
            <span>Set as My Location</span>
          </button>
        </div>
        <div class="w-0.5 h-3 bg-cyan-400"></div>
        <div class="w-2.5 h-2.5 rounded-full bg-cyan-300 border-2 border-cyan-900 shadow-md -mt-1"></div>
      </div>
    `
      : `
      <div class="relative flex flex-col items-center pointer-events-auto">
        <div class="relative flex items-center gap-1.5 px-2.5 py-1 rounded-full shadow-2xl bg-cyan-600 border border-cyan-300 text-white font-semibold text-[11px] whitespace-nowrap transition-transform duration-150 hover:scale-105">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m16 12-4-4-4 4"/><path d="M12 16V8"/></svg>
          <span class="max-w-[220px] truncate">${temporaryPin.label || 'Inspecting Place'}</span>
        </div>
        <div class="w-0.5 h-3 bg-cyan-400"></div>
        <div class="w-2.5 h-2.5 rounded-full bg-cyan-300 border-2 border-cyan-900 shadow-md -mt-1"></div>
      </div>
    `;

    // Custom marker click handler
    const bindTempPinEvents = (markerEl: HTMLElement) => {
      const setLocBtn = markerEl.querySelector('#temp-pin-set-location-btn') as HTMLElement | null;
      if (setLocBtn) {
        setLocBtn.onclick = (e: MouseEvent) => {
          e.stopPropagation();
          e.preventDefault();
          if (onUserLocationCalibrateRef.current) {
            onUserLocationCalibrateRef.current(temporaryPin.latitude, temporaryPin.longitude);
          }
        };
      }

      markerEl.onclick = (e: MouseEvent) => {
        e.stopPropagation();
        if (selectedPlace && onSelectPlace) {
          onSelectPlace(selectedPlace as DiscoveredPlace);
        } else if (onSelectPlace) {
          onSelectPlace({
            name: temporaryPin.label || 'Inspecting Place',
            latitude: temporaryPin.latitude,
            longitude: temporaryPin.longitude,
            address: temporaryPin.label || `${temporaryPin.latitude.toFixed(5)}, ${temporaryPin.longitude.toFixed(5)}`,
            category: 'Address',
            featureType: 'address',
            source: 'mapbox',
          });
        }
      };
      markerEl.onmousedown = (e: MouseEvent) => e.stopPropagation();
      markerEl.onmouseup = (e: MouseEvent) => e.stopPropagation();
      markerEl.ontouchstart = (e: TouchEvent) => e.stopPropagation();
      markerEl.ontouchend = (e: TouchEvent) => e.stopPropagation();
    };

    if (tempMarkerRef.current) {
      tempMarkerRef.current.setLngLat([temporaryPin.longitude, temporaryPin.latitude]);
      const currentEl = tempMarkerRef.current.getElement();
      currentEl.innerHTML = pinContent;
      bindTempPinEvents(currentEl);
    } else {
      const el = document.createElement('div');
      el.className = 'temporary-discovery-marker cursor-pointer select-none';
      el.innerHTML = pinContent;
      bindTempPinEvents(el);
      tempMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([temporaryPin.longitude, temporaryPin.latitude])
        .addTo(map);
    }
  }, [temporaryPin, userLocation, locations, selectedLocationId, selectedPlace, onSelectPlace, isMapLoaded]);

  // Render Dedicated User Location Marker (fixed navigation puck, clean click to inspect)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isMapLoaded) return;

    if (!userLocation) {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      return;
    }

    const isCalibrated = Boolean(userLocation.isCalibrated);
    const markerTitle = 'Your Current Location — Click for address and details';

    const el = document.createElement('div');
    el.className =
      'maply-user-location-marker relative flex items-center justify-center pointer-events-auto cursor-pointer select-none';
    el.setAttribute('title', markerTitle);
    el.innerHTML = `
      <div class="relative flex items-center justify-center p-2.5 transition-transform duration-200 hover:scale-125 active:scale-95 group">
        <!-- Subtle pulsing accuracy wave ring (pointer-events-none prevents click jitter) -->
        <div class="absolute w-9 h-9 rounded-full ${isCalibrated ? 'bg-cyan-400/35 border border-cyan-300/60' : 'bg-blue-500/30 border border-blue-400/50'} animate-ping opacity-80 pointer-events-none"></div>
        <!-- Soft ambient glow -->
        <div class="absolute w-8 h-8 rounded-full ${isCalibrated ? 'bg-cyan-500/30' : 'bg-blue-500/25'} blur-[3px] pointer-events-none"></div>
        <!-- High-contrast navigation dot with outer ring -->
        <div class="relative w-5 h-5 rounded-full ${isCalibrated ? 'bg-cyan-600 border-[2.5px] border-white shadow-xl shadow-cyan-900/80' : 'bg-blue-600 border-[2.5px] border-white shadow-xl shadow-black/80'} flex items-center justify-center group-hover:brightness-110 transition-colors pointer-events-auto">
          <div class="w-1.5 h-1.5 rounded-full bg-white"></div>
        </div>
      </div>
    `;

    const handleUserClick = (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (onUserLocationClickRef.current) {
        onUserLocationClickRef.current(userLocation);
      }
    };

    const bindUserMarkerEvents = (markerEl: HTMLElement) => {
      markerEl.onclick = handleUserClick;
    };

    if (userMarkerRef.current) {
      userMarkerRef.current.setLngLat([userLocation.longitude, userLocation.latitude]);
      const markerElement = userMarkerRef.current.getElement();
      markerElement.innerHTML = el.innerHTML;
      bindUserMarkerEvents(markerElement);
      markerElement.setAttribute('title', markerTitle);
    } else {
      bindUserMarkerEvents(el);
      const marker = new mapboxgl.Marker({
        element: el,
        anchor: 'center',
        draggable: false,
      })
        .setLngLat([userLocation.longitude, userLocation.latitude])
        .addTo(map);

      userMarkerRef.current = marker;
    }
  }, [userLocation, isMapLoaded]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#070b10]">
      {/* Real Interactive Mapbox GL Container */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Subtle cinematic vignette matching reference design */}
      <div className="pointer-events-none absolute inset-0 bg-radial-[ellipse_at_center,_transparent_50%,_rgba(5,9,14,0.65)_100%]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#05080c]/80 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#05080c]/80 to-transparent" />
    </div>
  );
};
