# Maply — High-Fidelity Location Intelligence & Exploration

Maply is a modern location-exploration web application built with Mapbox GL JS, TypeScript, and React. It features a liquid glassmorphic interface with floating panels, cinematic satellite view, real place geocoding and reverse geocoding, and rich place details (Google Earth/Google Maps depth).

---

## 1. Environment Variables Configuration

Create a `.env` file in the root directory (or configure secrets in your deployment environment):

```env
# Mapbox public access token (starts with pk.eyJ...)
# Required for full Mapbox vector satellite tiles, 3D terrain, and Mapbox Geocoding API.
# Obtain from https://account.mapbox.com
VITE_MAPBOX_TOKEN=your_mapbox_public_token_here

# (Optional) Google Maps Platform API Key
# Enables Google Places (New) API for rich business details, reviews, photos, and live hours.
# Obtain from Google Cloud Console: https://console.cloud.google.com
VITE_GOOGLE_PLACES_API_KEY=your_google_places_api_key_here
```

> **Zero-Config Fallback:** If `VITE_MAPBOX_TOKEN` is not provided, Maply gracefully defaults to high-resolution satellite raster tiles with OpenStreetMap Nominatim reverse geocoding and POI search, ensuring immediate zero-downtime exploration.

---

## 2. API Setup & Restrictions

### Mapbox Token Setup
1. Create a free account at [mapbox.com](https://www.mapbox.com).
2. Go to **Account Tokens** and copy your default public token (`pk.eyJ...`).
3. For production, add your domain (or `localhost`) to the allowed URL list in your Mapbox token settings.

### Google Places API Enablement (Optional Enhancement)
1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Enable the **Places API (New)**.
3. Under **Credentials**, create an API key and restrict it to HTTP referrers matching your application URL.
4. Set `VITE_GOOGLE_PLACES_API_KEY` in your environment.

---

## 3. Architecture Overview

Maply separates concerns through a resilient **Provider-Service-UI** architecture:

```
UI Layer (MapView, TopSearchBar, LocationDetailsPanel, Sidebar)
                          │
                          ▼
             PlaceService Facade & In-Memory Cache
                          │
             ┌────────────┴────────────┐
             ▼                         ▼
   MapboxPlaceProvider       GooglePlacesProvider (Optional)
  (Mapbox / OSM Nominatim)        (Places API v1)
```

### Core Abstractions
1. **Place vs SavedLocation Data Separation:**
   - **`Place` (Ephemeral / Discovered Place):** Represents any real geographical place on Earth, discovered via search, POI click, or arbitrary coordinate reverse geocoding.
   - **`SavedLocation` (`LocationItem`):** Represents a place explicitly saved by the user into their personal Maply organizer (with tags, notes, category, favorite status, and local persistence).
2. **`PlaceProvider` Interface:**
   - Standardized contract defining `search()`, `getPlaceDetails()`, `reverseGeocode()`, and `getNearbyPlaces()`.
   - The UI never couples directly to third-party SDK specifics.
3. **`PlaceService` Facade & Cache:**
   - Handles intelligent provider resolution, in-memory caching (`Map<string, CacheEntry>`), distance calculations (Haversine formula), and data normalization.
4. **Cinematic Mapbox GL JS Engine:**
   - Mapbox GL JS with smooth fly-to animations, custom HTML pin markers with pulsing radar rings, 3D building and terrain pitch, and multi-style switching (Satellite, Satellite Streets, Dark).

---

## 4. Acceptance Testing & Verification

1. **Search Flow:**
   - Type in the top search bar (e.g. `Marina Beach`, `Bangalore Palace`, `Ooty`, `Kapaleeshwarar Temple`).
   - Results show suggestions with categories and administrative localities.
   - Press Enter or click a suggestion: the camera smoothly glides to the location, opens the details panel, and shows coordinates, administrative hierarchy, and photos.
2. **Reverse Geocoding Flow:**
   - Click anywhere on the map: a cyan pinpoint appears immediately with a loading shimmer in the details panel.
   - Real reverse geocoded locality, city, state, postal code, and country appear in the panel.
3. **Save to Maply Flow:**
   - Click **Save to Maply** in the details panel: the place is saved to your personal collection with persistent local storage.
   - The location appears in the left sidebar list and displays a saved marker badge.
4. **Nearby Places Exploration:**
   - Click the **Nearby** tab in the details panel to view neighboring landmarks with exact distance badges. Clicking any nearby place transitions the camera and loads its data.
