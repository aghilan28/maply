# Maply — High-Fidelity Location Intelligence & Exploration

![React](https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646cff?logo=vite&logoColor=white)
![Mapbox GL JS](https://img.shields.io/badge/Mapbox_GL_JS-3.30-000000?logo=mapbox&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06b6d4?logo=tailwindcss&logoColor=white)

Maply is a React + TypeScript web application for saving, organizing, and revisiting
favorite locations on an interactive map. Users click the map (or search) to preview
a place, save it with a name, and manage it afterward — renaming, deleting,
favoriting, or jumping back to it — with the sidebar list and the map markers always
reflecting the same underlying data.

Built for the **cit-frontend-eval-2026 — Frontend Engineer Assignment**.


## Table of Contents

- [1. Quick Start](#1-quick-start)
- [2. Environment Variables](#2-environment-variables)
- [3. Requirement Coverage](#3-requirement-coverage)
- [4. Architecture & Key Decisions](#4-architecture--key-decisions)
- [5. Features & Optional Enhancements](#5-features--optional-enhancements)
- [6. Project Structure](#6-project-structure)
- [7. Verification Checklist](#7-verification-checklist)
- [8. Evaluation Criteria Mapping](#8-evaluation-criteria-mapping)
- [9. Known Limitations & Future Work](#9-known-limitations--future-work)
- [10. Author](#10-author)

---

## 1. Quick Start

### Prerequisites

- **Node.js** v18.0.0 or higher
- **npm** v9.0.0 or higher
- No API keys required — the app runs fully in zero-config mode (see §2)

### Install & run

```bash
npm install       # install dependencies
npm run dev       # starts Express + Vite on http://localhost:3000
```

`npm run dev` boots `server.ts` (an Express server), not a plain `vite dev`
process — this serves the app and the small API proxy routes together on port 3000.

### Build & type check

```bash
npm run build     # vite build + esbuild bundle of server.ts to dist/
npx tsc --noEmit  # type check (currently 0 errors)
```

### Demo access

No signup is required to evaluate the app:

- **Guest mode (recommended):** on the login screen, click **Continue as Guest**,
  enter any name (e.g. `Evaluator`), and you're dropped straight into the map.
- **Seeded demo account:** email `aghilan@maply.com`, password `password123`
  (username `aghilan`).
- **Register:** the registration flow also works and persists to `localStorage`
  under `maply_registered_users`.

---

## 2. Environment Variables

All variables are optional — the app is fully usable with zero configuration.
To configure them, copy the example file and fill in values:

```bash
cp .env.example .env
```

| Variable | Required? | Purpose |
|---|:---:|---|
| `VITE_MAPBOX_TOKEN` | No | Mapbox public token (`pk.eyJ...`) for vector tiles, geocoding, and search. |
| `VITE_GOOGLE_PLACES_API_KEY` | No | Optional enrichment via Google Places (New). |
| `VITE_FOURSQUARE_API_KEY` / `FOURSQUARE_API_KEY` | No | Optional venue photos, proxied through `/api/foursquare` in `server.ts`. |
| `GEMINI_API_KEY` | No | Reserved key, currently unused. |

**Fallback behavior:** if `VITE_MAPBOX_TOKEN` is omitted, the app automatically falls
back to Esri World Imagery satellite tiles with Carto labels for the basemap, and
OpenStreetMap Nominatim for reverse geocoding and search. Every core requirement
(add, view, select, search, edit, delete, persist) works in this zero-config mode.

---

## 3. Requirement Coverage

| # | Requirement | Where | Status |
|---|---|---|---|
| 1 | Interactive map (pan, zoom, click-to-add) | `src/components/map/MapView.tsx` | ✅ |
| 2 | Saved location has id / name / lat / lng | `src/types/location.ts` | ✅ |
| 3 | Sidebar list in sync with map | `src/pages/LandingPage/LandingPage.tsx`, `src/components/layout/Sidebar.tsx` | ✅ |
| 4 | Select from sidebar → focus + highlight map | `LandingPage.tsx` (`handleSelectLocation`, `flyToCoordinates`), `MapView.tsx` | ✅ |
| 5 | Edit location info | `src/components/locations/EditLocationModal.tsx`, `handleSaveEditLocation` | ✅ |
| 6 | Remove location | `src/components/locations/DeleteConfirmDialog.tsx`, `handleConfirmDelete` | ✅ |
| 7 | Search saved locations, dynamic, handles no-match | `src/components/layout/TopSearchBar.tsx`, `Sidebar.tsx` (`listSearch`) | ✅ |
| 8 | Persistence across reload | `src/services/locationStorage.ts` | ✅ |
| 9 | All 10 expected user flows | See [Verification Checklist](#7-verification-checklist) | ✅ |

Loading/error states and responsive design are additionally covered in
[§8 Evaluation Criteria Mapping](#8-evaluation-criteria-mapping).

---

## 4. Architecture & Key Decisions

```text
UI Layer (MapView, TopSearchBar, LocationDetailsPanel, Sidebar, ActionDock)
                          │
                          ▼
             PlaceService facade + in-memory cache
                          │
             ┌────────────┴────────────┐
             ▼                         ▼
   MapboxPlaceProvider         GooglePlacesProvider (optional)
 (Mapbox / OSM Nominatim fallback)

             LocationRepository ──► locationStorage
                (per-user localStorage keys)
```

- **Single source of truth.** All saved locations live in one `locations` state
  array in `src/pages/LandingPage/LandingPage.tsx`. Map markers, the sidebar list,
  search, and storage writes all derive from this one array — nothing is duplicated
  or independently re-fetched, which is what the assignment explicitly asks for
  ("avoid maintaining multiple independent sources of truth").
- **Ephemeral vs. saved data, kept deliberately separate.** A map click or search
  result first becomes a `discoveredPlace` / `temporaryPin` — a preview that is
  *not* persisted. Only `handleSaveNewLocation` promotes it into the real
  `locations` array. This avoids polluting saved data with places the user was
  only browsing.
- **Repository pattern for storage.** `src/services/locationRepository.ts` exposes
  `getLocations` / `createLocation` / `updateLocation` / `deleteLocation` /
  `restoreLocation` and is scoped per user via `setActiveUser(userId)`. UI
  components never touch `localStorage` directly, so the persistence mechanism can
  change without touching component code.
- **Provider abstraction with graceful fallback.** `PlaceService` sits in front of
  `MapboxPlaceProvider` (which itself falls back to OSM Nominatim when no token is
  present) and an optional `GooglePlacesProvider`. Components call one interface
  regardless of which provider is actually active.
- **Per-user storage isolation.** `src/services/locationStorage.ts` keys data as
  `maply:locations:<userId>` (e.g. `maply:locations:guest_default` for guests),
  migrates legacy data from the old flat `maply:locations` key, and returns `[]`
  instead of throwing if stored JSON is corrupted.

---

## 5. Features & Optional Enhancements

**Core**

- [x] Click map to add a location, named and saved
- [x] Markers on map + matching sidebar list
- [x] Select from sidebar: highlight + map fly-to
- [x] Edit location name (and other fields)
- [x] Delete a location, including the currently selected one

**Search**

- [x] Global search bar: saved matches + live Mapbox suggestions, debounced 260ms
- [x] Keyboard navigation (Arrow Up/Down, Enter, Cmd/Ctrl+K to focus, Esc to close)
- [x] Sidebar-local filter with a distinct "no matches" state
- [x] Loading and "no places found" states

**Persistence**

- [x] Per-user `localStorage`, corruption-safe, legacy-key migration

**Optional enhancements implemented**

- [x] Reverse geocoding on map click
- [x] Categories, tags, and category-pill filtering
- [x] Rich location details panel with a "Nearby" tab and distances
- [x] Custom glass-style markers with a pulse animation
- [x] Undo after delete (toast-based restore)
- [x] Multiple map styles (satellite / streets / dark)
- [x] Keyboard accessibility (Cmd+K, Esc, arrow keys)
- [x] URL-based sharing (`?loc=` and `?lat=&lng=&name=`)
- [x] Guest mode with per-user data isolation
- [x] User-location calibration

---

## 6. Project Structure

```text
server.ts                                         Express server, port 3000, /api/health, /api/foursquare proxy
.env.example                                      Documented optional environment variables
index.html                                        App shell, fonts, favicon
public/favicon.svg                                Brand mark (browser tab icon)

src/App.tsx                                       View router: landing → login → map, session restore
src/pages/Auth/LoginPage.tsx                      Login / register / Continue as Guest
src/pages/LandingPage/LandingPage.tsx             Main app screen; owns `locations` state and all handlers

src/components/map/MapView.tsx                   Mapbox GL init, fallback style, custom markers, temp pin
src/components/map/MapControls.tsx               Zoom / locate / fit-all controls
src/components/map/MapCloudOverlay.tsx           Cinematic map overlay treatment

src/components/layout/Sidebar.tsx                Saved location list, local search, empty/no-match states
src/components/layout/TopSearchBar.tsx            Global search across saved + live suggestions
src/components/layout/TopRightControls.tsx        View controls, notifications, user menu
src/components/layout/ActionDock.tsx              Primary action bar

src/components/locations/AddLocationModal.tsx        Save-new-location form, validation, reverse-geocode prefill
src/components/locations/EditLocationModal.tsx       Edit form, name validation
src/components/locations/DeleteConfirmDialog.tsx     Delete confirmation
src/components/locations/LocationDetailsPanel.tsx    Floating panel: Save / Edit / Delete / Favorite / Nearby
src/components/locations/MyPlacesModal.tsx           All-saved-places browser
src/components/locations/CategoriesModal.tsx         Category management
src/components/locations/PlaceHeroImage.tsx          Place photo hero with loading states

src/components/ui/CategoryPills.tsx               Category filter pills
src/components/ui/Toast.tsx                       Save/update/delete/favorite/share notifications
src/components/ui/MaplyCubeIcon.tsx               Brand cube icon
src/components/glass/GlassPanel.tsx               Shared glassmorphism panel
src/components/glass/GlassButton.tsx              Shared glassmorphism button

src/services/authService.ts                       Guest login, register, session
src/services/locationRepository.ts                CRUD facade over storage, per-user scoped
src/services/locationStorage.ts                   localStorage persistence, per-user keys
src/services/placeService.ts                      Provider-agnostic place lookups
src/services/mapboxPlaceService.ts                searchSuggestions / getPlaceDetails / reverseLookup
src/services/placeImageService.ts                 Place photo resolution
src/services/wikimediaImageService.ts             Wikimedia image fallback
src/services/visuals/PlaceVisualResolver.ts       Resolves marker/photo visuals

src/hooks/useUserLocation.ts                      Geolocation with calibration
src/types/location.ts                             LocationItem data model
src/types/place.ts                                Place / DiscoveredPlace models
```

---

## 7. Verification Checklist

Follow these steps to verify every required flow end to end:

1. Run `npm install && npm run dev`, then open `http://localhost:3000`.
2. Click **Continue as Guest** and enter `Evaluator`.
3. Click the map → a temp pin and details panel appear → **Save to Maply** →
   the item appears in the sidebar and as a marker.
4. Click that sidebar item → the map flies to it and it is visually highlighted.
5. Search `marina` in the top bar → select a saved result → the map focuses it.
   Type gibberish → the "no results" state is shown.
6. Open the `...` menu on a saved item → rename it → sidebar and marker update
   immediately.
7. Delete a location via the `...` menu → confirm → it disappears from sidebar
   and map → an Undo toast appears → Undo restores it.
8. Refresh the page → saved locations persist. Delete the currently-selected
   location → the details panel closes cleanly.

---

## 8. Evaluation Criteria Mapping

| Criterion | Evidence |
|---|---|
| Functional correctness | All flows in the [Verification Checklist](#7-verification-checklist) pass end to end |
| React fundamentals | Function components, hooks (`useState` / `useEffect` / custom `useUserLocation`), controlled forms in `AddLocationModal` / `EditLocationModal` |
| State management | Single `locations` array in `LandingPage.tsx`; ephemeral preview state kept separate (see §4) |
| Component architecture | Layout / map / locations / ui component groups, each with a narrow responsibility (see §6) |
| Code quality and maintainability | Repository pattern (`locationRepository.ts`), provider abstraction (`placeService.ts`), typed data model (`location.ts`) |
| User experience | Toasts for every mutation, Undo on delete, keyboard shortcuts, reverse-geocode prefill on add |
| Responsive design | Mobile hamburger drawer sidebar (`showMobileSidebar`), search bar sized `w-[calc(100vw-32px)]`, controls repositioned `right-[16px]` (mobile) vs `right-[365px]` (desktop) |
| Error and edge-case handling | Inline validation on empty names, `locationStorage.ts` returns `[]` on corrupted JSON rather than throwing, distinct empty vs. no-match sidebar states |
| Map integration | Mapbox GL JS with an automatic raster/Nominatim fallback when no token is configured |
| Search, editing, and persistence | `TopSearchBar` + `Sidebar` filter, `EditLocationModal`, per-user `localStorage` in `locationStorage.ts` |

Core requirements were treated as non-negotiable; optional enhancements (§5) were
only pursued after every core flow above was verified working, in line with the
assignment's note that additional features do not compensate for missing core
requirements.

---

## 9. Known Limitations & Future Work

- The production bundle is currently around 2.5 MB; code-splitting the map and
  modal chunks would meaningfully improve initial load time.
- A `SortOption` type already exists in the codebase, but no sort UI is wired up
  yet — sorting saved locations by name/date is a natural next step.
- Shared URLs (`?loc=`) resolve against the currently active user's saved
  locations, so a shared link works as expected when opened by that same
  account/guest session.

---

## 10. Author

Built by **Aghilan M** as an internship submission for the cit-frontend-eval-2026
Frontend Engineer Assignment. This repository is submitted for evaluation purposes only.
