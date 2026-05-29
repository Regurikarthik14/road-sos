<div align="center">
  <br />
  <h1>🛡️ Raksha</h1>
  <p><strong>Emergency Response Assistant — Real-Time. Intelligent. Life-Saving.</strong></p>
  <br />
</div>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-6-3178C6?style=flat&logo=typescript&logoColor=white" alt="TypeScript 6" />
  <img src="https://img.shields.io/badge/Vite-8-646CFF?style=flat&logo=vite&logoColor=white" alt="Vite 8" />
  <img src="https://img.shields.io/badge/Leaflet-1.9-199900?style=flat&logo=leaflet&logoColor=white" alt="Leaflet 1.9" />
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" />
</p>

<br />

## 📋 Overview

**Raksha** (meaning "protection" in Sanskrit) is a modern, real-time emergency response web application built with React 19 and TypeScript. It provides instant access to nearby trauma centers, police stations, towing services, and puncture repair shops — all rendered on an interactive dark-themed map powered by Leaflet.

The app features live geolocation tracking, an SOS emergency dispatch system with countdown, crash detection via device sensors, an AI-powered chat assistant with voice mode, real-time temperature/fire monitoring, and hardware health tracking.

> 🛡️ *Raksha — Protecting you when every second counts.*

---

## ✨ Features

### 🚨 Emergency SOS Dispatch
- **One-tap SOS button** — Triggers an emergency countdown with flashing screen, haptic vibration (SOS Morse pattern), and audio alert
- **10-second (or 3-second crash) countdown** — Dispatches emergency services with your live location
- **Paramedic Quick-Read card** — Displays blood type, emergency contact, allergies, and medications for first responders
- **Location sharing** — Live coordinates with accuracy radius shared with emergency services via Google Maps link

### 🗺️ Interactive Map
- **Real-time user location** — Continuous `watchPosition` tracking with accuracy visualization circle
- **Service markers** — Categorized locations (Trauma, Police, Towing, Puncture) with distance, direction, and ETA
- **Auto-follow mode** — Toggle crosshair button re-centers the map on your position as you move
- **Smooth scroll-to-top** — Location list scrolls to the top when switching categories
- **Dark-themed tiles** — CartoDB dark map tiles with custom dark popup styling

### 📱 Responsive Design
- **Three breakpoints** — Optimized for mobile (< 600px), tablet (600–1023px), and desktop (1024px+)
- **Progressive scaling** — SOS button, countdown number, chips, and text scale up on larger screens
- **Centered layouts** — Content max-width constrained and centered on tablet/desktop
- **Touch-optimized** — `-webkit-tap-highlight-color` disabled, button press animations, safe area insets

### 💬 AI Chat Assistant
- **Voice mode** — Tap the microphone to simulate voice recognition
- **Emergency responses** — Type "trauma", "police", "towing", or "puncture" for instant service info
- **Network awareness** — Displays cloud vs. edge connection state with live indicators

### 📳 Crash Detection
- **Impact sensing** — Monitors `DeviceMotionEvent` for sudden acceleration spikes (> 20 m/s²)
- **Loud sound detection** — Uses microphone `AnalyserNode` to detect loud noises (> 150 avg frequency)
- **Co-trigger logic** — Both impact AND loud sound must occur within a 2-second window to trigger
- **Auto-dispatch** — 3-second countdown on crash detection, sends location to first responders

### 🌡️ Fire Detection
- **Real-time temperature monitoring** — Simulated ambient temperature readings with realistic variance
- **Fire alert** — If temperature exceeds 50°C, automatic fire & ambulance dispatch
- **Elevated warning** — Temperature 35-50°C triggers monitoring warning

### ⚙️ Hardware Health Monitoring
- **CPU, Battery & Sensor tracking** — Real-time health percentage with visual bars
- **Damage detection** — Gradual degradation simulation with detailed diagnostics
- **Owner call protocol** — On critical damage, calls owner with 15-second countdown
- **Auto-action** — If no owner response, autonomously triggers emergency dispatch

### 🎤 Voice Tuning
- **Speech-to-Text** — Real voice recognition via Web Speech API
- **Text-to-Speech** — AI responses spoken aloud with configurable pitch & rate
- **Voice settings** — Tune voice output with pitch and rate sliders

### 🏥 Medical ID
- **Collapsible card** — Always-visible compact medical ID strip on the dashboard
- **Full quick-read** — Expanded view with blood type, emergency contact, allergies, and medications

---

## 🖼️ Screenshots

| Dashboard | Emergency | Map View |
|:---:|:---:|:---:|
| SOS button, category chips, chat trigger, medical ID | Flashing countdown, cancel button, paramedic card | Real-time markers, location cards, auto-follow toggle |
| *(See `screenshots/` directory)* | *(See `screenshots/` directory)* | *(See `screenshots/` directory)* |

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **React 19** | UI framework with hooks, refs, and memoization |
| **TypeScript 6** | Type safety across all components and hooks |
| **Vite 8** | Lightning-fast dev server and build tool |
| **Leaflet 1.9** | Interactive map rendering with custom markers and popups |
| **CSS3** | Responsive design with CSS custom properties and media queries |
| **Web APIs** | `Geolocation.watchPosition`, `DeviceMotionEvent`, `MediaDevices.getUserMedia`, `AudioContext`, `SpeechRecognition`, `SpeechSynthesis` |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 18.x
- **npm** >= 9.x (or **pnpm** / **yarn**)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/roadsos.git
cd road-sos

# Install dependencies
npm install

# Start the development server
npm run dev
```

The app will be available at **`http://localhost:5173`** by default.

### Production Build

```bash
npm run build
npm run preview
```

---

## 📁 Project Structure

```
├── index.html                 # Entry HTML with meta tags & dark theme
├── package.json               # Dependencies & scripts
├── tsconfig.json              # TypeScript configuration
├── vite.config.ts             # Vite build configuration
└── src/
    ├── main.tsx               # React entry point
    ├── App.tsx                # Root component with view routing & SOS logic
    ├── App.css                # Global styles & responsive CSS classes
    ├── index.css              # Design tokens, reset, animations
    ├── types.ts               # Shared TypeScript types & constants
    ├── hooks/
    │   ├── useGeolocation.ts  # Real-time location tracking hook
    │   └── useCrashDetection.ts # Accelerometer + mic crash detection hook
    └── components/
        ├── Dashboard.tsx       # Main dashboard with SOS button & chips
        ├── MapView.tsx         # Leaflet map with markers & location cards
        ├── FailsafeUI.tsx      # Emergency dispatch countdown screen
        ├── ChatCanvas.tsx      # AI chat assistant interface
        ├── BottomNav.tsx       # Bottom navigation bar
        ├── MedicalCard.tsx     # Collapsible medical ID card
        └── CrashDetectBanner.tsx # Crash detection status indicator
```

---

## 🧩 Component Architecture

```
App.tsx
├── Dashboard.tsx
│   ├── CrashDetectBanner.tsx
│   ├── MapView.tsx (overlay, when chip active)
│   └── MedicalCard.tsx
├── ChatCanvas.tsx
├── FailsafeUI.tsx
└── BottomNav.tsx
```

- **`App.tsx`** — Root component managing view routing (`dashboard`, `chat`, `failsafe`), SOS trigger, crash detection, and alert audio
- **`useGeolocation`** — Shared hook providing real-time location to both `MapView` and `FailsafeUI`
- **`useCrashDetection`** — Sensor fusion hook combining accelerometer and microphone data

---

## 🔧 How It Works

### Emergency Flow

1. **Tap SOS** → Dashboard triggers haptic Morse pattern & switches to failsafe view
2. **Countdown** → 10-second countdown with red/yellow flashing background
3. **Cancel or Dispatch** → Tap cancel to abort, or let countdown expire to dispatch
4. **Location Shared** — Live coordinates with accuracy displayed in paramedic quick-read card

### Crash Detection Flow

1. **Monitoring** — App continuously monitors `DeviceMotionEvent` (impact) and microphone (loud sound)
2. **Co-trigger** — Both impact AND loud sound within 2 seconds triggers crash alert
3. **Auto-dispatch** — 3-second countdown auto-navigates to failsafe screen with crash context

### Map Interaction

1. **Tap a chip** (Trauma / Police / Towing / Puncture) → Opens map overlay with nearby locations
2. **Location cards** show distance, direction (N/NE/E/etc.), and ETA sorted by proximity
3. **Tap a card** → Map flies to that location and opens popup with details
4. **Toggle auto-follow** → Crosshair button keeps map centered on your live position

---

## 🌐 Browser Support

| Feature | Chrome | Firefox | Safari | Edge |
|---------|:------:|:-------:|:------:|:----:|
| Geolocation (GPS) | ✅ | ✅ | ✅ | ✅ |
| DeviceMotion API | ✅ | ✅ | ✅ | ✅ |
| Microphone Access | ✅ | ✅ | ✅ | ✅ |
| Vibration API | ✅ | ❌ | ❌ | ✅ |
| CSS `env(safe-area-inset)` | ✅ | ✅ | ✅ | ✅ |

> **Note:** Crash detection requires a device with accelerometer. It works best on smartphones and tablets. Microphone permission is requested on first crash detection activation.

---

## ⚙️ Configuration

### Geolocation Options

In `useGeolocation.ts`:
```ts
const options = {
  enableHighAccuracy: true,     // Use GPS when available
  timeout: 8000,                // Fail after 8 seconds
  maximumAge: 10000,            // Accept 10-second-old positions
};
```

### Crash Detection Thresholds

In `useCrashDetection.ts`:
```ts
const IMPACT_THRESHOLD = 20;    // m/s² (~2g minimum for triggering)
const LOUD_THRESHOLD = 150;     // Average frequency level (0-255)
const CO_TRIGGER_WINDOW = 2000; // Milliseconds for co-trigger window
```

---

## 📝 Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with HMR |
| `npm run build` | TypeScript check + production build |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint on all source files |

---

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

1. **Fork** the repository
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit your changes** (`git commit -m 'Add amazing feature'`)
4. **Push to the branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### Development Tips

- Run `npm run dev` for hot reload during development
- Run `npm run build` to verify TypeScript and build before committing
- Test crash detection on a real device (not emulator) for accelerometer data

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.

---

## 🙏 Acknowledgments

- [Leaflet](https://leafletjs.com/) — Interactive map library
- [CartoDB](https://carto.com/basemaps) — Dark map tile provider
- [Vite](https://vitejs.dev/) — Build tool
- SOS Morse pattern — Inspired by real-world emergency signaling

---

<div align="center">
  <br />
  <p>
    <strong>🆘 ROADSoS</strong> — Built with urgency, designed for trust.
  </p>
  <p>
    <sub>Made with ❤️ for emergency responders and everyone on the road.</sub>
  </p>
</div>
