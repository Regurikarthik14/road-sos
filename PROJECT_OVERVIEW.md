# 🆘 ROADSoS — Project Overview

> **Emergency Roadside Assistance** — Real-time, intelligent, life-saving web application built with React 19 and TypeScript 6.

This document is a deep-dive technical overview of the ROADSoS architecture, component design, data flow, state management, CSS system, sensor integration, and known limitations. It is intended for developers, contributors, and anyone evaluating the project.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Component Tree & View Routing](#2-component-tree--view-routing)
3. [State Management Strategy](#3-state-management-strategy)
4. [Data Flow Diagrams](#4-data-flow-diagrams)
5. [Component API Reference](#5-component-api-reference)
6. [Hook API Reference](#6-hook-api-reference)
7. [CSS Architecture & Design Tokens](#7-css-architecture--design-tokens)
8. [Sensor Fusion: Crash Detection System](#8-sensor-fusion-crash-detection-system)
9. [Map & Routing System](#9-map--routing-system)
10. [Geolocation Strategy](#10-geolocation-strategy)
11. [Emergency Dispatch Flow](#11-emergency-dispatch-flow)
12. [Performance Considerations](#12-performance-considerations)
13. [Security & Privacy](#13-security--privacy)
14. [Browser Compatibility](#14-browser-compatibility)
15. [Known Limitations & Future Work](#15-known-limitations--future-work)

---

## 1. Architecture Overview

### Tech Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Framework | React | ^19.2.6 | UI rendering with hooks & refs |
| Language | TypeScript | ~6.0.2 | Type safety across all modules |
| Build | Vite | ^8.0.12 | Dev server + production bundling |
| Map | Leaflet | ^1.9.4 | Interactive map rendering |
| Map Types | @types/leaflet | ^1.9.21 | Leaflet type definitions |
| Linting | ESLint + typescript-eslint | ^10.x / ^8.x | Code quality |
| Styling | CSS3 with custom properties | — | Design tokens + responsive breakpoints |

### Project Structure

```
roadsos-app/
├── index.html                     # Entry point — meta tags, theme-color, viewport-fit
├── package.json                   # Dependencies & scripts
├── tsconfig.json                  # TS project references (app + node)
├── tsconfig.app.json              # App-specific TS config
├── tsconfig.node.json             # Node (Vite) TS config
├── vite.config.ts                 # Vite: React plugin only
├── README.md                      # User-facing documentation
├── PROJECT_OVERVIEW.md            # This file
└── src/
    ├── main.tsx                   # ReactDOM.createRoot entry
    ├── App.tsx                    # Root: view routing, geolocation, crash detection, alert audio
    ├── App.css                    # Component-level styles, responsive overrides, animations
    ├── index.css                  # Global reset, design tokens, keyframe animations
    ├── types.ts                   # Shared types: AppView, CategoryInfo, MedicalInfo, SOS_MORSE
    ├── hooks/
    │   ├── useGeolocation.ts      # Shared geolocation hook (watchPosition)
    │   └── useCrashDetection.ts   # Sensor-fusion crash detection (accelerometer + mic)
    └── components/
        ├── Dashboard.tsx          # Main dashboard: SOS button, radial dial, chips, chat trigger
        ├── MapView.tsx            # Leaflet map overlay: markers, locations, routes, directions
        ├── FailsafeUI.tsx         # Emergency countdown screen: flashing, haptics, medical card
        ├── ChatCanvas.tsx         # AI chat assistant: messages, voice simulation, network state
        ├── BottomNav.tsx          # 3-tab bottom navigation bar
        ├── MedicalCard.tsx        # Collapsible medical ID card (collapsed / expanded variants)
        └── CrashDetectBanner.tsx  # Crash detection status indicator for the dashboard
```

### Architecture Principles

1. **Self-Contained Components** — Each component owns its rendering, inline styles (via `styles` object), and local state. No external CSS modules or CSS-in-JS libraries.
2. **Ref-Based DOM Access** — Leaflet map instances, DOM elements, and sensor subscriptions are managed through React refs to avoid re-render overhead.
3. **Shared Hooks, Not Prop Drilling** — App-level concerns (geolocation, crash detection) are encapsulated in hooks and consumed by the root `App.tsx`, which passes data down as props.
4. **Immediate-Mode Emergency UI** — The Failsafe screen uses raw DOM intervals (no React state for the flashing effect) to ensure sub-100ms response on emergency trigger.
5. **Graceful Degradation** — Geolocation fallback (NYC coordinates), microphone fallback (impact-only monitoring), and DeviceMotion fallback work independently.

---

## 2. Component Tree & View Routing

### View State Machine

```
                     ┌─────────────┐
                     │  App.tsx    │
                     │  (Root)     │
                     └──────┬──────┘
                            │ activeView ∈ {'dashboard', 'chat', 'failsafe'}
                            │
            ┌───────────────┼───────────────────┐
            │               │                   │
            ▼               ▼                   ▼
    ┌────────────┐  ┌────────────┐  ┌──────────────────┐
    │ Dashboard  │  │ ChatCanvas │  │   FailsafeUI     │
    │            │  │            │  │                  │
    │ • SOS btn  │  │ • Messages │  │ • Countdown      │
    │ • Chips    │  │ • Voice    │  │ • Flashing       │
    │ • Chat trig│  │ • Network  │  │ • Cancel btn     │
    │ • Med card │  │ • Input    │  │ • Medical card   │
    │ • CrashBann│  └────────────┘  │ • Location link  │
    │            │                  └──────────────────┘
    │ • MapView  │
    │ (overlay)  │
    └────────────┘
```

### Routing Logic (in `App.tsx`)

```typescript
type AppView = 'dashboard' | 'chat' | 'failsafe';
```

- `activeView` state determines which component renders
- BottomNav is **hidden** during `failsafe` view (full-screen emergency)
- Back button appears in `chat` view to return to dashboard
- SOS press, crash detection, and `handleNavigate` transitions set `activeView`
- `isEmergencyTriggered` boolean controls the looping alert audio

### Component Composition

| View | Children | Overlays |
|------|----------|----------|
| `dashboard` | `<Dashboard>` → `CrashDetectBanner`, `MedicalCard`, `MapView` (conditional) | MapView (when chip is active) |
| `chat` | `<ChatCanvas>` + back button | — |
| `failsafe` | `<FailsafeUI>` | — |

---

## 3. State Management Strategy

ROADSoS deliberately avoids external state management libraries. All state is managed through:

### Local Component State (`useState`)

| Component | State Variables | Purpose |
|-----------|----------------|---------|
| `App.tsx` | `activeView`, `isEmergencyTriggered`, `isLoading`, `crashTriggered` | View routing + emergency flags |
| `Dashboard.tsx` | `activeChip` | Tracks which category chip is selected |
| `MapView.tsx` | `userLocation`, `geoStatus`, `followUser`, `activeRouteIndex`, `routeInfo`, `isRouting` | Map interactions + geolocation |
| `FailsafeUI.tsx` | `countdown`, `flashState`, `hapticActive` | Emergency countdown + flashing |
| `ChatCanvas.tsx` | `messages`, `inputValue`, `isListening`, `networkState`, `isVoiceActive` | Chat messages + voice state |
| `MedicalCard.tsx` | (none — stateless, accepts `variant` prop) | — |

### Shared Hooks (`useState` + `useEffect`)

| Hook | Returns | Components That Consume It |
|------|---------|---------------------------|
| `useGeolocation()` | `{ userLocation, geoStatus }` | `App.tsx` → passes to `FailsafeUI` |
| `useCrashDetection({ onCrashDetected })` | `{ status, impactDetected, loudDetected, permissionDenied }` | `App.tsx` → passes `crashDetect` to `Dashboard`, `crashTriggered` to `FailsafeUI` |

### Refs (`useRef`) — When State Is Not Needed

| Ref | Purpose | Why Not State |
|-----|---------|---------------|
| `mapRef` | Leaflet map instance | Mutable object, not rendered |
| `layerRef` / `popupMarkersRef` | Leaflet layer references | Imperative API, not rendered |
| `watchIdRef` | Geolocation watch ID | Cleanup only, not rendered |
| `hapticRef` | SOS Morse interval ID | Avoid re-render on interval |
| `audioContextRef` | Alert sound AudioContext | Imperative audio API |
| `getDirRef` | Route handler for popup callbacks | Ensure fresh closures |
| `routePolylineRef` etc. | Route overlay Leaflet objects | Imperative Leaflet API |

### Why This Works

- **Emergency views are independent** — The failsafe screen doesn't share state with the dashboard beyond the `crashTriggered` flag
- **Hooks are singletons** — `useGeolocation` and `useCrashDetection` are instantiated once in `App.tsx` and data flows down via props
- **No cross-component mutations** — State changes are always local or parent → child via props

---

## 4. Data Flow Diagrams

### 4.1 Emergency Trigger Flow (Manual SOS)

```
User taps SOS button
       │
       ▼
Dashboard: onSOSPress()
  ├── startSOSHaptic()  → vibrate SOS Morse pattern
  └── onSOSPress (prop) → App.tsx
       │
       ▼
App.tsx: handleSOSPress()
  ├── setActiveView('failsafe')
  └── setIsEmergencyTriggered(true)
       │
       ▼
App.tsx: useEffect [isEmergencyTriggered]
  ├── Creates AudioContext + sawtooth oscillator (880Hz / 660Hz)
  └── Loops alert tone every 2 seconds
       │
       ▼
FailsafeUI renders
  ├── Countdown starts at 10 (or 3 if crashTriggered)
  ├── Flashing background (red ↔ yellow every 500ms)
  ├── SOS Morse haptic vibration
  ├── Medical card with location from useGeolocation
  └── Cancel button or auto-expire
       │
       ├── Cancel → handleCancelEmergency()
       │   ├── setActiveView('dashboard')
       │   ├── setIsEmergencyTriggered(false)
       │   ├── setCrashTriggered(false)
       │   └── audioContext.close()
       │
       └── Expire (countdown === 0) → handleEmergencyExpire()
           └── (Dispatch logic placeholder — currently just stays on failsafe)
```

### 4.2 Crash Detection Flow

```
useCrashDetection() initializes
       │
       ├── DeviceMotion listener starts (impact detection)
       │   └── Monitors accelerationIncludingGravity > 20 m/s²
       │
       └── After 2s delay → getUserMedia({ audio: true })
           └── AudioContext + AnalyserNode (fftSize: 256)
               └── requestAnimationFrame loop checking avg frequency > 150
                    │
                    ├── Impact detected → impactTimeRef = Date.now()
                    └── Loud noise detected → loudTimeRef = Date.now()
                         │
                         ▼
                    checkCoTrigger()
                    ├── Both timestamps within 2000ms?
                    │   YES → setStatus('triggered')
                    │        → cleanupSensors()
                    │        → onCrashDetected()
                    │            │
                    │            ▼
                    │        App.tsx: handleCrashDetected()
                    │        ├── setCrashTriggered(true)
                    │        ├── setActiveView('failsafe')
                    │        └── setIsEmergencyTriggered(true)
                    │
                    └── NO → wait for other sensor
                              (timestamps expire after 2500ms)
```

### 4.3 Route / Directions Flow

```
User taps "Dir" button on location card
       │
       ▼
fetchRoute(fromLat, fromLng, toLat, toLng, index)
  ├── clearRoute() (remove any existing polyline + markers)
  ├── setIsRouting(true)
  │
  ├── Fetch OSRM API:
  │   https://router.project-osrm.org/route/v1/driving/{lng},{lat};{lng},{lat}?overview=full&geometries=geojson
  │
  ├── Parse response → coordinates, distance, duration
  │
  ├── Draw route:
  │   ├── L.polyline (dashed, category-colored, weight 4)
  │   ├── Start marker (colored circle at user location)
  │   └── End marker (numbered pin at destination)
  │
  ├── map.fitBounds(polyline bounds, padding 15%)
  │
  ├── setRouteInfo({ distance, duration })
  ├── setActiveRouteIndex(index)
  └── setIsRouting(false)
       │
       ▼
  Route info banner shows:
  "Route to {name} — {distance} · {duration} [✕ Clear]"
```

---

## 5. Component API Reference

### `<App />` (Root)

**Internal State:**
```typescript
activeView: AppView                  // 'dashboard' | 'chat' | 'failsafe'
isEmergencyTriggered: boolean        // Controls alert audio loop
isLoading: boolean                   // Loading skeleton (1200ms on mount)
crashTriggered: boolean              // Shortens failsafe countdown to 3s
```

**Key Effects:**
- Mount: `setTimeout` 1200ms → `isLoading = false`
- `isEmergencyTriggered` change: Creates looping sawtooth oscillator (880Hz/660Hz alternating every 2s)
- `useGeolocation()`: Tracks live location app-wide
- `useCrashDetection()`: Monitors sensors, auto-triggers failsafe

---

### `<Dashboard />`

**Props:**
```typescript
interface DashboardProps {
  onSOSPress: () => void;
  onChatPress: () => void;
  crashDetection: {
    status: CrashDetectStatus;
    impactDetected: boolean;
    loudDetected: boolean;
    permissionDenied: boolean;
  };
}
```

**Internal State:**
```typescript
activeChip: CategoryInfo | null     // Currently selected category (opens MapView)
```

**Key Behavior:**
- SOS button triggers `startSOSHaptic()` (Morse vibration pattern via `navigator.vibrate`) on mousedown/touchstart, `stopSOSHaptic()` on release
- Category chips toggle `activeChip`; selecting the same chip again closes the map
- `CrashDetectBanner` renders between hero area and chips
- `MedicalCard` renders in collapsed variant at the bottom

---

### `<MapView />`

**Props:**
```typescript
interface MapViewProps {
  activeCategory: CategoryInfo | null;
  onClose: () => void;
}
```

**Internal State:**
```typescript
userLocation: { lat, lng, name, accuracy? } | null  // Local geolocation (also has own watchPosition)
geoStatus: 'locating' | 'ready' | 'error' | 'denied'
followUser: boolean                                  // Auto-follow toggle
activeRouteIndex: number | null                      // Which card has an active route
routeInfo: { distance: string; duration: string } | null
isRouting: boolean                                   // Loading state for OSRM fetch
```

**Refs:**
```typescript
mapRef: L.Map | null
mapContainerRef: HTMLDivElement | null
locationsRef: HTMLDivElement | null
layerRef: L.Layer[]                                 // All map layers (for cleanup)
popupMarkersRef: L.CircleMarker[]                    // For programmatic popup opening
watchIdRef: number | null
routePolylineRef: L.Polyline | null
routeMarkerStartRef: L.Marker | null
routeMarkerEndRef: L.Marker | null
getDirRef: ((index: number) => void) | null           // Window handler for popup buttons
```

**Key Effects:**
1. **Mount**: Creates Leaflet map with CartoDB dark tiles, no zoom/attribution controls
2. **Mount**: Injects global dark popup CSS styles (once)
3. **Mount**: Starts `watchPosition` with 8s timeout, 10s maxAge
4. `[activeCategory]`: Resets scroll position on location list
5. `[activeCategory, clearRoute]`: Clears any active route when category changes
6. `[activeCategory, userLocation]`: Rebuilds all map markers (accuracy circle, user dot, location markers with popups)
7. `[userLocation, followUser]`: Re-centers map when auto-follow is on

**Synthetic Location Generation:**
The `generateLocations()` function creates realistic nearby service locations relative to the user's position (or NYC fallback). It calculates distance (km/m), compass direction (N/NE/E/etc.), and ETA based on 40 km/h average speed. Categories have different quantities:
- Trauma: 3 locations
- Police: 2 locations
- Towing: 3 locations
- Puncture: 2 locations

---

### `<FailsafeUI />`

**Props:**
```typescript
interface FailsafeUIProps {
  onCancel: () => void;
  onExpire: () => void;
  onNavigate: (view: 'dashboard' | 'chat' | 'failsafe') => void;
  userLocation: UserLocation | null;       // From useGeolocation hook
  crashTriggered?: boolean;                // If true, countdown starts at 3 instead of 10
}
```

**Internal State:**
```typescript
countdown: number                // Starts at INITIAL_COUNTDOWN (10 or 3)
flashState: 'red' | 'yellow'    // Flashing background every 500ms
hapticActive: boolean            // Controls SOS Morse vibration loop
```

**Key Effects:**
1. `[countdown]`: Decrements every 1s; when 0 calls `onExpire()`
2. **Mount**: Starts `setInterval` 500ms toggling `flashState`
3. `[hapticActive]`: Plays SOS Morse pattern (...---...) via `navigator.vibrate`, looping every 2.4s

**Medical Card Layout:**
- Location: Clickable Google Maps link (`https://www.google.com/maps?q=lat,lng`) opening in new tab
- Blood Type: Default "O-"
- Emergency Contact: Default "+1 (555) 000-0000"
- Allergies & Medications: Placeholder values

---

### `<ChatCanvas />`

**Internal State:**
```typescript
messages: ChatMessage[]                    // Array of { id, text, isUser, timestamp }
inputValue: string                         // Text input value
isListening: boolean                       // Voice recognition active
networkState: 'cloud' | 'edge'            // Based on navigator.onLine
isVoiceActive: boolean                     // Wave animation showing
```

**Key Behavior:**
- Welcome message auto-sent on mount
- `sendMessage()` adds user message, then simulates 800ms AI response
- Response keywords: "help", "trauma", "police", "towing", "puncture" — otherwise generic fallback
- Voice toggle simulates 3s voice recognition, then sends "help" message
- Network banner switches between "Cloud Connected" and "Edge AI Active" based on `online`/`offline` events
- Wave animation (`wave-rise` keyframe) during voice activity

---

### `<BottomNav />`

**Props:**
```typescript
interface BottomNavProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
}
```

**Nav Items:**
```typescript
const NAV_ITEMS: NavItem[] = [
  { view: 'dashboard', icon: '⌂', label: 'Dashboard' },
  { view: 'chat', icon: '💬', label: 'AI Chat' },
  { view: 'failsafe', icon: '🆘', label: 'Emergency' },
];
```

**Styling:**
- Active non-emergency: red tinted background + red icon/label
- Active emergency (failsafe): solid red background with glow shadow

---

### `<MedicalCard />`

**Props:**
```typescript
interface MedicalCardProps {
  variant?: 'collapsed' | 'expanded';
}
```

**Collapsed Variant:**
- Single-line strip showing Blood Type + Emergency Contact
- Green border with blurred backdrop

**Expanded Variant:**
- 2×2 grid: Blood Type, Emergency Contact, Allergies, Medications
- Used in `FailsafeUI.tsx` (styled differently with inline style overrides)

---

### `<CrashDetectBanner />`

**Props:**
```typescript
interface CrashDetectBannerProps {
  status: CrashDetectStatus;
  impactDetected: boolean;
  loudDetected: boolean;
  permissionDenied: boolean;
}
```

**Rendering Logic:**
- Hidden when `status === 'inactive'` or `status === 'triggered'`
- Shows different status text based on `status`:
  - `'listening'`: "Crash detection active (impact only — mic unavailable)"
  - `'audio-ready'`: "Crash detection ready — calibrating audio…"
  - `'monitoring'`: "Crash detection active — monitoring impact + audio"
- Status dots: Impact (green/red) + Audio (green/yellow) when monitoring

---

## 6. Hook API Reference

### `useGeolocation()`

```typescript
// Returns:
{
  userLocation: UserLocation | null;
  geoStatus: 'idle' | 'locating' | 'ready' | 'error' | 'denied';
}

// Where:
interface UserLocation {
  lat: number;
  lng: number;
  accuracy: number | null;  // Accuracy radius in meters (null before first fix)
}
```

**Behavior:**
- Calls `navigator.geolocation.watchPosition()` on mount
- Options: `enableHighAccuracy: true`, `timeout: 8000`, `maximumAge: 10000`
- Falls back to `'error'` status after 10s timeout if no position received
- Cleans up `clearWatch()` on unmount
- **Note:** `MapView.tsx` has its own independent geolocation watch (not shared via this hook)

---

### `useCrashDetection({ onCrashDetected })`

```typescript
// Options:
{
  onCrashDetected: () => void;  // Called when crash is confirmed
}

// Returns:
{
  status: 'inactive' | 'listening' | 'audio-ready' | 'monitoring' | 'triggered';
  impactDetected: boolean;    // True if acceleration spike detected since mount
  loudDetected: boolean;      // True if loud noise detected since mount
  permissionDenied: boolean;  // True if mic permission was blocked
}
```

**Configuration Constants:**
```typescript
const IMPACT_THRESHOLD = 20;      // m/s² (~2g). Normal ~9.8, hard drop > 20
const LOUD_THRESHOLD = 150;       // 0-255 scale. Speech ~30-60, loud noise > 150
const CO_TRIGGER_WINDOW = 2000;   // ms — both must occur within 2s
const STALE_TIMEOUT = 2500;       // ms — how long timestamps persist
```

**State Machine:**
```
inactive → listening (if no mic permission or error)
         → audio-ready → monitoring (when both sensors active)
         → triggered (when co-trigger condition met)
```

**Sensor Setup (in order):**
1. **Mount:** `DeviceMotion` event listener added immediately
2. **+2s delay:** `getUserMedia({ audio: true })` → `AudioContext` → `AnalyserNode` (fftSize: 256)
3. **Monitoring:** `requestAnimationFrame` loop reads frequency data each frame
4. **Trigger:** Both `impactTimeRef` and `loudTimeRef` within 2000ms → `cleanupSensors()` + `onCrashDetected()`

**Cleanup:**
- `cleanupSensors()`: Removes devicemotion listener, cancels RAF, stops mic tracks, closes AudioContext
- Called on trigger AND on unmount (via useEffect cleanup + dedicated cleanup effect)

---

## 7. CSS Architecture & Design Tokens

### Design Tokens (`index.css`)

```css
:root {
  /* Backgrounds */
  --bg-primary: #111827;           /* Obsidian — OLED-safe dark */
  --bg-secondary: #1e293b;         /* Slate — card surfaces */
  --bg-tertiary: #0f172a;          /* Deepest shade */

  /* Actions */
  --action-alert: #EF4444;         /* Neon Crimson — emergency */
  --action-hover: #dc2626;         /* Darker red */
  --trust-safe: #10B981;           /* Emerald — safe/connected */

  /* Text */
  --text-primary: #F9FAFB;         /* Off-white */
  --text-secondary: #9ca3af;       /* Muted */
  --text-dim: #4b5563;             /* Dim */

  /* Typography */
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, sans-serif;
  --font-mono: 'SF Mono', 'Fira Code', 'Consolas', monospace;

  /* Safe areas */
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-top: env(safe-area-inset-top, 0px);
}
```

### Responsive Strategy

| Breakpoint | Name | #root max-width | Layout |
|------------|------|----------------|--------|
| < 600px | Mobile | 480px | Full-width content |
| 600–1023px | Tablet | 100% (padded 32px) | Centered with gradient background |
| ≥ 1024px | Desktop | 800px (padded 48px) | Centered with glow + border |

**Responsive Classes** (in `App.css`):
All responsive overrides use `!important` to override inline `style={}` objects. This is intentional — inline styles have highest specificity, so `!important` is the only way for CSS classes to win without refactoring all components to use class-based styling.

Class naming pattern: `.responsive-{component}-{element}`

Key responsive changes:
- SOS button: 130px → 160px → 190px
- Countdown number: 120px → 150px → 180px
- Chat bubbles: 85% → 70% → 65% max-width
- Category chips: larger padding, icons, and labels
- Bottom nav: wider buttons, larger icons

### Animations (defined in `index.css`)

| Animation | Duration | Purpose |
|-----------|----------|---------|
| `pulse-ring` | 3s infinite | Glow ring around SOS button |
| `pulse-glow` | 2s infinite | SOS button shadow glow |
| `slide-up` | 0.3s ease | Map overlay entrance |
| `slide-in-left` | 0.3s ease | Dashboard entrance |
| `fade-in` | 0.3s ease | Chat & failsafe entrance |
| `countdown-pulse` | 0.5s infinite | Countdown number scale |
| `rotate-dial` | 60s linear infinite | Radial dial SVG rotation |
| `wave-rise` | 0.6s infinite alternate | Voice activity bars |
| `skeleton-shimmer` | 1.5s infinite | Loading skeleton effect |
| `user-pulse` | 2s infinite | Map user location dot |
| `dot-pulse` | 1.5s infinite | Location banner dot |
| `message-pop` | 0.25s ease | Chat message entrance |

### Scrollbar Styling
- Webkit only: 4px wide, transparent track, `--text-dim` thumb

---

## 8. Sensor Fusion: Crash Detection System

### Architecture

```
┌──────────────────────┐    ┌──────────────────────────┐
│  DeviceMotion API    │    │  MediaDevices + Web Audio │
│  (Accelerometer)     │    │  (Microphone)             │
│                      │    │                          │
│  event.acceleration  │    │  getUserMedia({audio})   │
│  IncludingGravity    │    │  → AudioContext           │
│                      │    │  → AnalyserNode fft=256  │
│  √(x² + y² + z²)    │    │  → getByteFrequencyData  │
│  > 20 m/s² → impact  │    │  → avg > 150 → loud sound│
└──────────┬───────────┘    └────────────┬─────────────┘
           │                             │
           ▼                             ▼
    impactTimeRef                  loudTimeRef
    = Date.now()                   = Date.now()
           │                             │
           └────────────┬────────────────┘
                        ▼
              checkCoTrigger()
                  │           │
            diff ≤ 2s    diff > 2s
                  │           │
            TRIGGERED      WAIT
                  │      (timestamps
            onCrash      expire after
            Detected()   2.5s)
```

### Design Decisions

1. **Co-trigger requirement** — Both impact AND loud sound must occur within 2 seconds. This prevents false positives from simple drops (silent fall) or loud noises (like a car horn without impact).

2. **`accelerationIncludingGravity`** — Used instead of `acceleration` because it includes the 9.8 m/s² gravity baseline. During free fall, all axes approach 0, then spike sharply on impact. The threshold of 20 m/s² (~2g) ensures only hard impacts trigger.

3. **AnalyserNode with fftSize: 256** — Produces 128 frequency bins. Summing all bins provides a rough proxy for overall loudness. Threshold 150/255 filters out normal speech (~30–60 avg) and captures only loud noises.

4. **2-second delay before mic access** — Allows the app to render fully before requesting microphone permission, avoiding a jarring permission prompt during initial load.

5. **Stale timeout (2.5s)** — Timestamps are cleared after 2.5s to prevent a loud sound from 5 minutes ago matching a new impact event.

6. **Full cleanup on trigger** — All sensors, streams, and animation frames are immediately stopped once a crash is confirmed.

---

## 9. Map & Routing System

### Map Configuration

- **Provider:** CartoDB dark tiles (`https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`)
- **Initial zoom:** 14
- **Controls:** Both `zoomControl` and `attributionControl` are disabled (custom UI)
- **Interactions:** `dragging: true`, `scrollWheelZoom: true`
- **Default markers:** Leaflet Icons loaded from unpkg CDN

### Marker System

| Marker | Type | Visual |
|--------|------|--------|
| User location | 2× `L.circleMarker` | Outer: radius 16, 25% opacity, pulsing; Inner: radius 6, solid red |
| User accuracy | `L.circle` | Radius = accuracy meters, 8% opacity, 1px border |
| User label | `L.marker` + `L.divIcon` | "Your Location" or "You (approx)" |
| Service markers | 2× `L.circleMarker` each | Outer: radius 12, 40% opacity; Inner: radius 4, solid category color |
| Service labels | `L.marker` + `L.divIcon` | Numbered (1, 2, 3…) |
| Route start | `L.marker` + custom divIcon | Category-colored circle, 16px |
| Route end | `L.marker` + custom divIcon | Numbered pin, 22px, category color |

### OSRM Routing

- **API:** `https://router.project-osrm.org/route/v1/driving/{fromLng},{fromLat};{toLng},{toLat}?overview=full&geometries=geojson`
- **Cache:** None — every route request fetches fresh data
- **Error handling:** Silent fail — `catch` block just resets `isRouting`
- **Route rendering:** Dashed polyline (12, 8 pattern), weight 4, 85% opacity, category color
- **Fit bounds:** Polyline bounds padded 15%, max zoom 16

### Window Handler for Popups

Leaflet popups contain HTML strings, so they can't use React event handlers. The solution is a global `window.__roadsosGetDir` function:

```typescript
// Ref-based to avoid stale closures
const getDirRef = useRef<((index: number) => void) | null>(null);
getDirRef.current = (index) => { /* uses latest locations, activeRouteIndex, etc. */ };

// Stable effect — only runs once
useEffect(() => {
  const handler = (index: number) => getDirRef.current?.(index);
  (window as any).__roadsosGetDir = handler;
  return () => { if ((window as any).__roadsosGetDir === handler) delete (window as any).__roadsosGetDir; };
}, []);
```

---

## 10. Geolocation Strategy

### Two Independent Watchers

| Watcher | Location | Purpose | Options |
|---------|----------|---------|---------|
| `useGeolocation()` hook | `App.tsx` | Shared with `FailsafeUI` for emergency dispatch | `enableHighAccuracy: true`, `timeout: 8000`, `maximumAge: 10000` |
| MapView internal | `MapView.tsx` | Map-specific geolocation for markers + auto-follow | Same options |

**Why two watchers?** The shared hook was added later (for SOS location sharing). MapView predates it and has its own state (`geoStatus`, `followUser`) that depends on its watcher. Consolidating into one watcher is possible future work.

### Fallback Behavior

| Scenario | Behavior |
|----------|----------|
| Geolocation denied | `geoStatus = 'denied'` — shows banner with Retry button (page reload) |
| Geolocation error | `geoStatus = 'error'` — shows approximate location banner, uses NYC fallback |
| Timeout (10s) | `geoStatus = 'error'` — same as error |
| No device support | `geoStatus = 'error'` immediately |
| Ready | `geoStatus = 'ready'` — shows "Live location active (±Xm)" |

---

## 11. Emergency Dispatch Flow

### Timings

| Event | Duration | Notes |
|-------|----------|-------|
| Manual SOS countdown | 10 seconds | Default for manual SOS button press |
| Crash-detected countdown | 3 seconds | Shortened because seconds matter in crash scenarios |
| Flash interval | 500ms | Red ↔ yellow alternating background |
| SOS Morse loop | 2.4 seconds | Full ...---... pattern |
| Alert tone loop | 2 seconds | Sawtooth 880Hz → 660Hz → 880Hz → 660Hz |

### Audio Alert

- **Type:** Sawtooth oscillator at 880Hz
- **Pattern:** 880Hz (0s) → 660Hz (0.15s) → 880Hz (0.3s) → 660Hz (0.45s) → fade out (0.6s)
- **Loop:** Repeats every 2 seconds while `isEmergencyTriggered && activeView === 'failsafe'`
- **Volume:** Gain starts at 0.15, fades to 0.001
- **Cleanup:** AudioContext closed on cancel or navigation away

### Visual Effects

- **Background flash:** 500ms interval toggling between `#EF4444` (red) and `#FCD34D` (yellow)
- **Countdown pulse:** `countdown-pulse` keyframe — 0.5s infinite scale oscillation
- **Progress bar:** Linear fill from left to right over the countdown duration

---

## 12. Performance Considerations

### What's Optimized

1. **Event listener cleanup** — All `addEventListener` calls are paired with proper `removeEventListener` in useEffect cleanups
2. **RAF cancellation** — The audio analyzer `requestAnimationFrame` loop is cancelled on trigger and unmount
3. **Layer cleanup** — Map layers are stored in a ref array and removed via `l.remove()` before re-creating markers
4. **No unnecessary re-renders** — State is kept at the appropriate level (e.g., MapView has its own geo state rather than lifting everything to App)
5. **`useCallback` for stable references** — `clearRoute`, `fetchRoute`, `handleCrashDetected`, etc.
6. **Refs for imperative APIs** — Leaflet instances, interval IDs, audio context — none of these trigger re-renders
7. **CSS animations** — `will-change` is not explicitly set, but animations use `transform` and `opacity` (GPU-composited properties)

### What's Not Optimized

1. **MapView geolocation** — A second `watchPosition` call duplicates the shared hook (runs two GPS trackers simultaneously)
2. **Synthetic locations** — Generated fresh on every render of MapView, not memoized
3. **Popup bindings** — Re-bound on every marker re-render (when category or location changes)
4. **CSS `!important` overrides** — 40+ `!important` declarations in responsive CSS; works but not elegant
5. **No lazy loading** — All components are eagerly loaded (no `React.lazy` or code splitting)
6. **OSRM API** — No client-side caching of route responses; re-fetches on every request

---

## 13. Security & Privacy

### Geolocation

- Location data is used **client-side only** — never sent to a server in the current implementation
- The Google Maps link in FailsafeUI opens `https://www.google.com/maps?q=lat,lng` — this sends coordinates to Google when clicked
- Permission denied is handled gracefully; app still functions with NYC fallback coordinates

### Microphone Access

- Microphone is requested 2 seconds after the app mounts (crash detection)
- Permission can be denied without breaking the app (falls to impact-only detection)
- Stream is stopped immediately (`track.stop()`) when crash is triggered or component unmounts
- Audio data is processed entirely in the browser — never transmitted

### External APIs

| API | Data Sent | Purpose |
|-----|-----------|---------|
| CartoDB tile server | Tile coordinates + IP | Map tile rendering |
| unpkg.com (Leaflet icons) | IP only | Default marker icon images |
| router.project-osrm.org | Start/end coordinates | Driving route calculation |
| google.com/maps (user click) | Coordinates | Open in Google Maps (user-initiated) |

### Safe Links

- All `target="_blank"` links include `rel="noopener noreferrer"` (Google Maps in FailsafeUI)

---

## 14. Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge | Notes |
|---------|--------|---------|--------|------|-------|
| **Geolocation** `watchPosition` | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Requires HTTPS or localhost |
| **DeviceMotion** API | ✅ | ✅ | ✅ (iOS 13+) | ✅ | iOS requires `DeviceOrientationEvent.requestPermission()` |
| **getUserMedia** (mic) | ✅ | ✅ | ✅ | ✅ | Requires HTTPS; iOS requires gesture |
| **Vibration** API | ✅ | ❌ | ❌ | ✅ | Firefox and Safari don't implement |
| **AudioContext** | ✅ | ✅ | ✅ | ✅ | May require user gesture on iOS |
| **CSS env(safe-area-inset)** | ✅ | ✅ | ✅ | ✅ | iPhone X+ notch support |
| **CSS `backdrop-filter`** | ✅ | ✅ | ✅ (Safari 9+) | ✅ | Used in cancel button + medical cards |

### Mobile-Specific Considerations

- `viewport-fit=cover` meta tag enables full-screen rendering on notched devices
- `-webkit-tap-highlight-color: transparent` disables default tap highlight on iOS
- `env(safe-area-inset-top/bottom)` applied to header padding, bottom nav, and location lists
- `user-scalable=no, maximum-scale=1.0` prevents accidental zoom on emergency screens
- SOS button uses both `onMouseDown`/`onMouseUp` AND `onTouchStart`/`onTouchEnd` for cross-device support

---

## 15. Known Limitations & Future Work

### Current Limitations

| Area | Limitation | Impact |
|------|-----------|--------|
| **Dispatch logic** | Emergency expire handler is a no-op | No actual emergency services are called |
| **Location data** | Synthetic locations generated locally | Not real service provider data |
| **Crash detection** | Co-trigger may not work on iOS without gesture | iOS requires user gesture before mic access |
| **Duplicate GPS** | `MapView` has its own `watchPosition` | Two concurrent GPS trackers |
| **No backend** | All data is client-side mock data | No real authentication, storage, or dispatch |
| **No PWA** | No service worker or manifest | Can't be installed as a standalone app |
| **No offline** | Network-dependent for map tiles | Map fails without internet |
| **No notifications** | No push notifications | Can't alert emergency contacts |
| **No testing** | No unit or integration tests | Manual testing only |

### Future Roadmap

1. **Backend integration** — Connect to real emergency dispatch API with user authentication
2. **Real service provider data** — Integrate with Google Places / Overpass API for real hospitals, police stations
3. **Push notifications** — Alert emergency contacts when SOS is triggered
4. **PWA support** — Service worker for offline cache + installable manifest
5. **Consolidated geolocation** — Merge MapView's GPS tracker with shared `useGeolocation` hook
6. **Route caching** — Cache OSRM responses in `sessionStorage` or IndexedDB
7. **iOS sensor permissions** — Add `DeviceOrientationEvent.requestPermission()` flow for iOS
8. **Unit tests** — Add Vitest + React Testing Library for hook and component tests
9. **Accessibility audit** — Ensure screen reader support, focus management, and ARIA labels are complete
10. **Internationalization** — Support multiple languages for emergency instructions
11. **Theme support** — Alternate light theme (only needed for non-emergency modes)
12. **Automated crash testing** — Desktop-only simulation mode for crash detection testing without a real device

---

<div align="center">
  <br />
  <p><strong>🆘 ROADSoS</strong> — Built with urgency, designed for trust.</p>
  <p><sub>Made with ❤️ for emergency responders and everyone on the road.</sub></p>
  <br />
</div>
