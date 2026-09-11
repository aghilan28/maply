# Maply — High-Fidelity Location Intelligence & Exploration

Maply is a state-of-the-art location-exploration web application built with Mapbox GL JS, TypeScript, React, and TailwindCSS. It features a liquid glassmorphic interface with floating panels, cinematic satellite view, real place reverse geocoding, rich place details, category filtering, and offline-first persistence.

---

## 1. Quick Start & Authentication

### Installation & Launch

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The application will start immediately on **`http://localhost:3000`**.

### Demo Credentials & Evaluation Access

Maply provides two seamless ways for evaluators to access the interactive map:

1. **Continue as Guest (Recommended for instant evaluation):**
   - On the login page, click **"Continue as Guest (No password required)"**.
   - Enter any name (e.g. `Alex` or `Evaluator`) to immediately launch the full interactive map view.

2. **Demo User Account:**
   - **Email:** `aghilan@maply.com`
   - **Password:** `password123`
   - You can also click the **"Auto-Fill"** button on the login screen to automatically populate these credentials.

3. **User Registration:**
   - Registration creates instant accounts with local persistence (`localStorage`).

---

## 2. Environment Variables Configuration

Create a `.env` file in the root directory (refer to `.env.example`):

```env
# Mapbox public access token (starts with pk.eyJ...)
# Required for vector satellite tiles, 3D terrain, and Mapbox Geocoding API.
# Obtain from https://account.mapbox.com
VITE_MAPBOX_TOKEN=your_mapbox_public_token_here

# (Optional) Google Places Platform API Key
# Enables Google Places (New) API for business details, reviews, and photos.
VITE_GOOGLE_PLACES_API_KEY=your_google_places_api_key_here

# (Optional) Foursquare Places API service token
VITE_FOURSQUARE_API_KEY=your_foursquare_api_key_here
```

> **Zero-Config Fallback:** If `VITE_MAPBOX_TOKEN` is omitted, Maply gracefully defaults to Esri World Imagery satellite raster tiles with OpenStreetMap Nominatim reverse geocoding and search, ensuring 100% zero-downtime exploration out of the box.

---

## 3. Core Requirements Implementation Audit

| Requirement | Implementation Details | Status |
| :--- | :--- | :---: |
| **1. Interactive Map** | Mapbox GL JS engine (`src/components/map/MapView.tsx`) with raster satellite fallback, smooth camera `flyTo`, zoom controls, click-to-pin reverse geocoding, and custom Liquid Glass markers. | ✅ PASS |
| **2. Saved Locations Sidebar** | `src/components/layout/Sidebar.tsx` shares single `locations` state of truth with map. Shows location name, category badge, thumbnail, city/region, and exact `lat, lng` coordinates subtitle. | ✅ PASS |
| **3. Location Selection** | Selecting a location highlights the sidebar item, triggers smooth camera `flyTo(lat, lng, 13.5)`, and expands a prominent glass badge marker on the map. | ✅ PASS |
| **4. Edit Location** | `EditLocationModal.tsx` allows editing location name (required validation), category, address, city/region, tags, notes, and photos with immediate state & storage update. | ✅ PASS |
| **5. Remove Location** | Location deletion via sidebar menu or details panel triggers `DeleteConfirmDialog` and updates map markers immediately with an **Undo Toast** restore option. | ✅ PASS |
| **6. Search Locations** | `TopSearchBar.tsx` (global search with Mapbox suggestions & `⌘K` shortcut) and `Sidebar.tsx` (list filter with distinct empty state vs. no-matches message). | ✅ PASS |
| **7. Favorite Persistence** | `src/services/locationStorage.ts` provides `localStorage` persistence under key `maply:locations` with error handling, automatic reload on refresh, and favorite toggles. | ✅ PASS |

---

## 4. Architecture & Technical Design

Maply follows a modular **Provider-Service-UI** architecture:

```
                      UI Layer (React 18 + TailwindCSS)
 [MapView]  [TopSearchBar]  [LocationDetailsPanel]  [Sidebar]  [ActionDock]
                             │
                             ▼
              PlaceService Facade & In-Memory Cache
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
    MapboxPlaceProvider           GooglePlacesProvider (Optional)
   (Mapbox / OSM Nominatim)          (Places API v1)
```

### Key Architectural Highlights
1. **Single Source of Truth (`locations` state in `LandingPage.tsx`):**
   - The map markers, sidebar list items, search engine, modal views, and persistence repository all derive from the `locations` state. Ephemeral pins (`discoveredPlace`/`temporaryPin`) remain isolated from saved data.
2. **Repository Pattern (`src/repositories/locationRepository.ts`):**
   - Decouples UI components from persistence logic (`localStorage` / API backend).
3. **Responsive Glassmorphic Design System:**
   - Dynamic liquid glass cards (`liquid-glass`), backdrop blurs, responsive drawers for mobile screens (down to 320px width), dark/light mode switcher, and custom brand SVG icons.

---

## 5. Implemented Optional Enhancements

- [x] **Reverse Geocoding on Map Click:** Clicking any coordinate on the map dynamically resolves street, city, region, postal code, and country.
- [x] **Category Tagging & Filtering:** Interactive category pills (Travel, Work, Home, Food, Nature, History) with liquid glass badges.
- [x] **Rich Floating Location Details Panel:** Multi-tab drawer featuring Overview, Photo Galleries, and Nearby Places discovery with distance calculations.
- [x] **Custom Liquid Glass Map Markers:** Glowing category icons with animated radar pulse rings and selected state badges.
- [x] **Undo Location Deletion:** Toast notification action allowing users to instantly restore deleted places.
- [x] **Multi-Style Map Engine:** Toggle seamlessly between Aerial HD Satellite, Street Map, and Dark Vector views.
- [x] **Keyboard Accessibility:** Global `⌘K` / `Ctrl+K` search shortcut, ESC key panel dismiss, and keyboard navigation.
- [x] **Direct URL Sharing:** Shareable location URLs via URL search params (`?loc=...`).
- [x] **Guest Evaluation Mode:** One-click instant guest access requiring only a name for quick grading.
- [x] **Brand SVG Tab Logo (Favicon):** Customized 3D liquid glass cube SVG favicon in browser tab header.

---

## 6. Build Verification

To verify production build and type safety:

```bash
# Type check & lint
npx tsc --noEmit

# Production build
npm run build
```
