import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { CategoryInfo } from '../types';

interface MapViewProps {
  activeCategory: CategoryInfo | null;
  onClose: () => void;
  userLocation: { lat: number; lng: number; accuracy: number | null } | null;
  geoStatus: string;
}

interface LocationData {
  name: string;
  distance: string;
  distanceKm: number;
  direction: string;
  eta: string;
  status: string;
  lat: number;
  lng: number;
}

// Default fallback location (Bangalore, India) — used when GPS is unavailable
const DEFAULT_LOCATION = { lat: 12.9716, lng: 77.5946 };
const DEFAULT_CITY = 'Bangalore';

// Traffic segment colors (simulated — like Google Maps)
type TrafficColor = '#22C55E' | '#EAB308' | '#EF4444';  // green, yellow, red

interface TrafficSegment {
  coords: [number, number][];
  color: TrafficColor;
}

// Simulate a multi-traffic route: start green, middle yellow, end red (near city center)
function generateTrafficSegments(coords: [number, number][]): TrafficSegment[] {
  if (coords.length < 6) {
    // Too short for meaningful segments — all green
    return [{ coords, color: '#22C55E' }];
  }

  // Split into 8-12 segments
  const numSegments = Math.min(12, Math.max(6, Math.floor(coords.length / 5)));
  const segmentSize = Math.floor(coords.length / numSegments);
  const segments: TrafficSegment[] = [];

  // Simulated traffic pattern: 
  // - First 3 segments: mostly green (outskirts → city approach)
  // - Middle segments: mix of green/yellow (city outer ring)
  // - Last segments: mix of yellow/red (city center)
  // Each segment has a random variance so it doesn't look uniform

  for (let i = 0; i < numSegments; i++) {
    const start = i * segmentSize;
    const end = i === numSegments - 1 ? coords.length : (i + 1) * segmentSize;
    const segmentCoords = coords.slice(start, end);
    if (segmentCoords.length === 0) continue;

    // Normalized position 0→1 along the route
    const t = i / (numSegments - 1);
    const random = Math.random() * 0.3 - 0.15; // ±0.15 randomness
    const trafficScore = t * 0.8 + random; // 0 = clear, ~1 = heavy

    let color: TrafficColor;
    if (trafficScore < 0.35) {
      color = '#22C55E'; // green - clear
    } else if (trafficScore < 0.65) {
      color = '#EAB308'; // yellow - moderate
    } else {
      color = '#EF4444'; // red - heavy
    }

    segments.push({ coords: segmentCoords, color });
  }

  return segments;
}

// Generate synthetic nearby locations relative to a center point
function generateLocations(
  centerLat: number,
  centerLng: number,
  cityName: string
): Record<string, LocationData[]> {
  const latKm = 111;
  const lngKm = 111 * Math.cos((centerLat * Math.PI) / 180);

  const offset = (kmLat: number, kmLng: number): { lat: number; lng: number } => ({
    lat: centerLat + kmLat / latKm,
    lng: centerLng + kmLng / lngKm,
  });

  const dist = (kmLat: number, kmLng: number): { text: string; km: number } => {
    const d = Math.sqrt(kmLat * kmLat + kmLng * kmLng);
    return {
      text: d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`,
      km: d,
    };
  };

  const eta = (km: number): string => {
    const mins = Math.ceil((km / 40) * 60);
    return `${mins} min`;
  };

  const getCompassDir = (kmLat: number, kmLng: number): string => {
    const deg = Math.atan2(kmLng, kmLat) * (180 / Math.PI);
    const normalized = ((deg + 360) % 360);
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return dirs[Math.round(normalized / 45) % 8];
  };

  const d = (kmLat: number, kmLng: number) => {
    const r = dist(kmLat, kmLng);
    return { distance: r.text, distanceKm: r.km, direction: getCompassDir(kmLat, kmLng) };
  };

  return {
    trauma: [
      { name: `${cityName} General Hospital`, ...d(1.8, 1.2), eta: eta(2.2), status: 'Open 24h', ...offset(1.8, 1.2) },
      { name: `St. Mary's ER - ${cityName}`, ...d(-0.5, 2.5), eta: eta(2.7), status: 'Open 24h', ...offset(-0.5, 2.5) },
      { name: `${cityName} University Medical`, ...d(-2.0, -1.0), eta: eta(2.4), status: 'Open 24h', ...offset(-2.0, -1.0) },
    ],
    police: [
      { name: `${cityName} Central Precinct`, ...d(0.8, -1.0), eta: eta(1.3), status: 'Dispatch Active', ...offset(0.8, -1.0) },
      { name: `${cityName} Highway Patrol`, ...d(-1.5, 1.8), eta: eta(2.4), status: 'En Route', ...offset(-1.5, 1.8) },
    ],
    towing: [
      { name: `Quick Tow ${cityName}`, ...d(0.3, -0.8), eta: eta(0.9), status: 'Available', ...offset(0.3, -0.8) },
      { name: `Apex Towing ${cityName}`, ...d(2.2, -2.0), eta: eta(3.0), status: 'Available', ...offset(2.2, -2.0) },
      { name: `${cityName} City Wrecker`, ...d(-2.8, 0.5), eta: eta(2.9), status: 'On Call', ...offset(-2.8, 0.5) },
    ],
    ambulance: [
      { name: `${cityName} Emergency Medical Services`, ...d(0.5, -1.5), eta: eta(1.6), status: 'Available 24/7', ...offset(0.5, -1.5) },
      { name: `${cityName} Urgent Care Response`, ...d(-1.8, 0.3), eta: eta(1.9), status: 'En Route Ready', ...offset(-1.8, 0.3) },
    ],
    puncture: [
      { name: `Quick Tire - ${cityName}`, ...d(-1.2, 0.8), eta: eta(1.5), status: 'Open Now', ...offset(-1.2, 0.8) },
      { name: `AutoFix ${cityName} 24h`, ...d(1.0, -2.2), eta: eta(2.4), status: '24 Hour', ...offset(1.0, -2.2) },
    ],
  };
}

const CATEGORY_COLORS: Record<string, string> = {
  trauma: '#EF4444',
  police: '#3B82F6',
  ambulance: '#EC4899',
  towing: '#10B981',
  puncture: '#F59E0B',
};

interface RouteInfoExt {
  distance: string;
  duration: string;
  trafficSummary: string;
  greenCount: number;
  yellowCount: number;
  redCount: number;
}

const POPUP_STYLES_ID = 'roadsos-leaflet-popup-styles';

function injectPopupStyles() {
  if (document.getElementById(POPUP_STYLES_ID)) return;
  const style = document.createElement('style');
  style.id = POPUP_STYLES_ID;
  style.textContent = `
    .leaflet-popup-content-wrapper {
      background: #1e293b !important;
      color: #F9FAFB !important;
      border-radius: 12px !important;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4) !important;
      border: 1px solid rgba(249,250,251,0.1) !important;
    }
    .leaflet-popup-tip {
      background: #1e293b !important;
    }
    .leaflet-popup-close-button {
      color: #9ca3af !important;
      font-size: 16px !important;
      padding: 4px 8px !important;
    }
    .leaflet-popup-close-button:hover {
      color: #F9FAFB !important;
    }
    .map-user-label, .map-location-label {
      background: none !important;
      border: none !important;
    }
  `;
  document.head.appendChild(style);
}

export default function MapView({ activeCategory, onClose, userLocation: sharedLocation, geoStatus }: MapViewProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const locationsRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<L.Layer[]>([]);
  const popupMarkersRef = useRef<L.CircleMarker[]>([]);
  const mapInitializedRef = useRef(false);

  const [mapReady, setMapReady] = useState(false);
  const [followUser, setFollowUser] = useState(true);
  const [activeRouteIndex, setActiveRouteIndex] = useState<number | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfoExt | null>(null);
  const [isRouting, setIsRouting] = useState(false);
  const [useDemoLocation, setUseDemoLocation] = useState(false);
  const [demoAutoTriggered, setDemoAutoTriggered] = useState(false);
  const routeOutlineRef = useRef<L.Polyline | null>(null);
  const routeGlowRef = useRef<L.Polyline | null>(null);
  const routeMarkerStartRef = useRef<L.Marker | null>(null);
  const routeMarkerEndRef = useRef<L.Marker | null>(null);
  const trafficSegmentsRef = useRef<L.Polyline[]>([]);
  const hasFittedBoundsRef = useRef(false);
  // Separate refs for user location markers — updated in-place to avoid blinking
  const userAccuracyRef = useRef<L.Circle | null>(null);
  const userOuterRef = useRef<L.CircleMarker | null>(null);
  const userInnerRef = useRef<L.CircleMarker | null>(null);
  const userLabelRef = useRef<L.Marker | null>(null);
  // Stable category center — captured once when category opens, NOT on every GPS tick
  const categoryCenterRef = useRef<[number, number] | null>(null);

  // Determine effective center: real GPS, fallback demo, or wait
  const isDemoMode = useDemoLocation || (!sharedLocation && demoAutoTriggered);
  const effectiveCenter: [number, number] | null = sharedLocation
    ? [sharedLocation.lat, sharedLocation.lng]
    : isDemoMode
      ? [DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng]
      : null;

  // Auto-trigger demo location after 8 seconds if no GPS
  useEffect(() => {
    if (sharedLocation || demoAutoTriggered) return;
    const timer = setTimeout(() => {
      setDemoAutoTriggered(true);
    }, 8000);
    return () => clearTimeout(timer);
  }, [sharedLocation, demoAutoTriggered]);

  // Ref-based handler for Leaflet popup HTML buttons
  const getDirRef = useRef<((index: number) => void) | null>(null);
  getDirRef.current = (index: number) => {
    const loc = locations[index];
    if (!loc || !effectiveCenter) return;
    if (activeRouteIndex === index) {
      clearRoute();
    } else {
      fetchRoute(effectiveCenter[0], effectiveCenter[1], loc.lat, loc.lng, index);
    }
  };

  useEffect(() => {
    const handler = (index: number) => getDirRef.current?.(index);
    (window as unknown as Record<string, unknown>).__roadsosGetDir = handler;
    return () => {
      if ((window as unknown as Record<string, unknown>).__roadsosGetDir === handler) {
        delete (window as unknown as Record<string, unknown>).__roadsosGetDir;
      }
    };
  }, []);

  useEffect(() => { injectPopupStyles(); }, []);

  // Resolved center for generating locations
  const center = effectiveCenter;

  const locations = activeCategory && center
    ? (generateLocations(center[0], center[1], isDemoMode ? DEFAULT_CITY : 'Your Location')[activeCategory.id] ?? []).sort((a, b) => a.distanceKm - b.distanceKm)
    : [];

  // Create Leaflet map when we have a center point
  useEffect(() => {
    if (!mapContainerRef.current || !center || mapInitializedRef.current) return;

    delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    const map = L.map(mapContainerRef.current, {
      center,
      zoom: 14,
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      scrollWheelZoom: true,
    });

    map.on('dragstart', () => setFollowUser(false));
    map.on('zoomstart', () => setFollowUser(false));

    // Use OpenStreetMap tiles — more reliable than CartoDB
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 20,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    mapRef.current = map;
    mapInitializedRef.current = true;
    setMapReady(true);

    // Small delay to ensure container is rendered before invalidating size
    requestAnimationFrame(() => {
      map.invalidateSize();
    });

    return () => {
      map.remove();
      mapRef.current = null;
      mapInitializedRef.current = false;
      setMapReady(false);
      layerRef.current = [];
      popupMarkersRef.current = [];
    };
  }, [center]);

  // Update map center when user location changes (if auto-follow is on)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !sharedLocation || !followUser) return;
    map.setView([sharedLocation.lat, sharedLocation.lng], map.getZoom());
  }, [sharedLocation, followUser]);

  // Invalidate map size when map becomes ready (fixes layout issues)
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;
    // Invalidate after render to ensure proper dimensions
    const timer = setTimeout(() => map.invalidateSize(), 200);
    return () => clearTimeout(timer);
  }, [mapReady]);

  // Invalidate size when container resizes
  useEffect(() => {
    if (!mapReady) return;
    const handleResize = () => {
      mapRef.current?.invalidateSize();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [mapReady]);

  useEffect(() => {
    locationsRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeCategory]);

  const clearRoute = useCallback(() => {
    if (routeOutlineRef.current) {
      routeOutlineRef.current.remove();
      routeOutlineRef.current = null;
    }
    if (routeGlowRef.current) {
      routeGlowRef.current.remove();
      routeGlowRef.current = null;
    }
    if (routeMarkerStartRef.current) {
      routeMarkerStartRef.current.remove();
      routeMarkerStartRef.current = null;
    }
    if (routeMarkerEndRef.current) {
      routeMarkerEndRef.current.remove();
      routeMarkerEndRef.current = null;
    }
    // Clean up traffic segment polylines
    trafficSegmentsRef.current.forEach((seg) => seg.remove());
    trafficSegmentsRef.current = [];
    setActiveRouteIndex(null);
    setRouteInfo(null);
  }, []);

  const fetchRoute = useCallback(async (fromLat: number, fromLng: number, toLat: number, toLng: number, index: number) => {
    const map = mapRef.current;
    if (!map) return;

    setIsRouting(true);
    clearRoute();

    const catColor = activeCategory ? CATEGORY_COLORS[activeCategory.id] || '#EF4444' : '#EF4444';

    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();

      if (!data.routes || data.routes.length === 0) {
        setIsRouting(false);
        return;
      }

      const route = data.routes[0];
      const coords: [number, number][] = route.geometry.coordinates.map(
        (c: number[]) => [c[1], c[0]] as [number, number]
      );

      const distKm = route.distance / 1000;
      const durMin = Math.round(route.duration / 60);

      // Generate traffic-colored segments once (reused for both banner counts and rendering)
      const trafficSegments = generateTrafficSegments(coords);
      const greenCount = trafficSegments.filter(s => s.color === '#22C55E').length;
      const yellowCount = trafficSegments.filter(s => s.color === '#EAB308').length;
      const redCount = trafficSegments.filter(s => s.color === '#EF4444').length;
      const totalCount = trafficSegments.length;
      const trafficSummary = redCount > totalCount * 0.4 ? 'Heavy traffic'
        : yellowCount > totalCount * 0.4 ? 'Moderate traffic'
        : 'Light traffic';

      setRouteInfo({
        distance: distKm < 1 ? `${Math.round(route.distance)} m` : `${distKm.toFixed(1)} km`,
        duration: durMin < 1 ? '<1 min' : `${durMin} min`,
        trafficSummary,
        greenCount,
        yellowCount,
        redCount,
      });
      setActiveRouteIndex(index);

      // === Google Maps-style route line: outer glow + traffic-colored segments ===

      // Outer glow/outline layer (thicker, semi-transparent)
      const outline = L.polyline(coords, {
        color: catColor,
        weight: 9,
        opacity: 0.25,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
      }).addTo(map);
      routeOutlineRef.current = outline;

      // Middle glow layer
      const glow = L.polyline(coords, {
        color: catColor,
        weight: 6,
        opacity: 0.4,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
      }).addTo(map);
      routeGlowRef.current = glow;

      // Traffic-colored segments (green/yellow/red) replacing the single white line
      const trafficPolylines: L.Polyline[] = [];
      trafficSegments.forEach((seg) => {
        const segLine = L.polyline(seg.coords, {
          color: seg.color,
          weight: 4,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);
        trafficPolylines.push(segLine);
      });
      trafficSegmentsRef.current = trafficPolylines;

      // === Google Maps-style start marker (teardrop pin) ===
      const startSvg = `<svg width="28" height="40" viewBox="0 0 28 40" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="start-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.3"/>
          </filter>
        </defs>
        <path d="M14 0C6.3 0 0 6.3 0 14c0 8 5.5 14.5 14 26C22.5 28.5 28 22 28 14 28 6.3 21.7 0 14 0z" fill="#111827" filter="url(#start-shadow)"/>
        <path d="M14 2C7.4 2 2 7.4 2 14c0 7 4.8 12.8 12 23.2C21.2 26.8 26 21 26 14 26 7.4 20.6 2 14 2z" fill="${catColor}"/>
        <circle cx="14" cy="13" r="5" fill="#fff" opacity="0.95"/>
      </svg>`;

      const startIcon = L.divIcon({
        className: 'route-start-icon',
        html: startSvg,
        iconSize: [28, 40],
        iconAnchor: [14, 40],
      });
      const startMarker = L.marker([fromLat, fromLng], { icon: startIcon, interactive: false, zIndexOffset: 1000 }).addTo(map);
      routeMarkerStartRef.current = startMarker;

      // === Google Maps-style destination marker (inverted teardrop with number) ===
      const endSvg = `<svg width="30" height="42" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="end-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.3"/>
          </filter>
        </defs>
        <path d="M15 0C6.7 0 0 6.7 0 15c0 8.5 5.9 15.5 15 27C24.1 30.5 30 23.5 30 15 30 6.7 23.3 0 15 0z" fill="#111827" filter="url(#end-shadow)"/>
        <path d="M15 2C8.4 2 3 7.4 3 15c0 7.5 5.2 13.7 12 24.2C21.8 28.7 27 22.5 27 15 27 7.4 21.6 2 15 2z" fill="${catColor}"/>
        <circle cx="15" cy="14" r="6.5" fill="#fff" opacity="0.95"/>
        <text x="15" y="16.5" text-anchor="middle" fill="${catColor}" font-size="10" font-weight="800">${index + 1}</text>
      </svg>`;

      const endIcon = L.divIcon({
        className: 'route-end-icon',
        html: endSvg,
        iconSize: [30, 42],
        iconAnchor: [15, 42],
      });
      const endMarker = L.marker([toLat, toLng], { icon: endIcon, interactive: false, zIndexOffset: 1000 }).addTo(map);
      routeMarkerEndRef.current = endMarker;

      // Fit map to show the full route
      map.fitBounds(outline.getBounds().pad(0.15), { maxZoom: 16 });

      // === Route drawing animation (Google Maps-style reveal) ===
      // Uses SVG stroke-dasharray/dashoffset to draw the line from start to end
      requestAnimationFrame(() => {
        // Animate the outer outline and glow layers
        const baseLayers = [
          { layer: outline, delay: 0.2 },
          { layer: glow, delay: 0.5 },
        ];

        baseLayers.forEach(({ layer, delay }) => {
          const el = layer.getElement();
          if (!el) return;
          const pathEl: SVGPathElement | null = el.tagName === 'path' ? (el as SVGPathElement) : el.querySelector('path') as SVGPathElement | null;
          if (!pathEl) return;

          try {
            const length = pathEl.getTotalLength();
            pathEl.style.strokeDasharray = String(length);
            pathEl.style.strokeDashoffset = String(length);
            pathEl.style.animation = `route-draw ${1.2}s ease-out ${delay}s forwards`;

            const onAnimEnd = () => {
              pathEl.style.strokeDasharray = '';
              pathEl.style.strokeDashoffset = '';
              pathEl.style.animation = '';
              pathEl.removeEventListener('animationend', onAnimEnd);
            };
            pathEl.addEventListener('animationend', onAnimEnd);
          } catch {
            // getTotalLength may fail on some SVG renderers — skip animation
          }
        });

        // Animate each traffic segment with a staggered delay based on its position
        trafficSegmentsRef.current.forEach((segPolyline, segIndex) => {
          const el = segPolyline.getElement();
          if (!el) return;
          const pathEl: SVGPathElement | null = el.tagName === 'path' ? (el as SVGPathElement) : el.querySelector('path') as SVGPathElement | null;
          if (!pathEl) return;

          try {
            const length = pathEl.getTotalLength();
            const segDelay = 0.8 + (segIndex / trafficSegmentsRef.current.length) * 0.6;
            pathEl.style.strokeDasharray = String(length);
            pathEl.style.strokeDashoffset = String(length);
            pathEl.style.animation = `route-draw ${1.0}s ease-out ${segDelay}s forwards`;

            const onAnimEnd = () => {
              pathEl.style.strokeDasharray = '';
              pathEl.style.strokeDashoffset = '';
              pathEl.style.animation = '';
              pathEl.removeEventListener('animationend', onAnimEnd);
            };
            pathEl.addEventListener('animationend', onAnimEnd);
          } catch {
            // skip animation on this segment
          }
        });
      });
    } catch {
      // Route fetch failed silently
    } finally {
      setIsRouting(false);
    }
  }, [clearRoute, activeCategory]);

  useEffect(() => {
    clearRoute();
    // Reset bounds fitting flag so the next setup fits bounds for the new category
    hasFittedBoundsRef.current = false;
    // Capture the center once when category opens — stabilizes the reference
    // so the category markers effect doesn't re-run on every GPS tick
    if (center) {
      categoryCenterRef.current = center;
    }
  }, [activeCategory, clearRoute, center]);

  // Create user location markers once (on category open)
  // Does NOT depend on sharedLocation — accuracy is updated separately via setLatLng effect
  const createUserMarkers = useCallback((map: L.Map, latlng: L.LatLngExpression, accuracy?: number | null) => {
    // Clean up any existing user markers first
    if (userAccuracyRef.current) { userAccuracyRef.current.remove(); userAccuracyRef.current = null; }
    if (userOuterRef.current) { userOuterRef.current.remove(); userOuterRef.current = null; }
    if (userInnerRef.current) { userInnerRef.current.remove(); userInnerRef.current = null; }
    if (userLabelRef.current) { userLabelRef.current.remove(); userLabelRef.current = null; }

    if (accuracy) {
      const accuracyCircle = L.circle(latlng, {
        radius: accuracy,
        color: '#EF4444', weight: 1, opacity: 0.3,
        fillColor: '#EF4444', fillOpacity: 0.08,
        interactive: false,
      }).addTo(map);
      userAccuracyRef.current = accuracyCircle;
    }

    const userOuter = L.circleMarker(latlng, {
      radius: 16, fillColor: '#EF4444', color: '#fff',
      weight: 3, opacity: 1, fillOpacity: 0.25,
      className: 'user-location-pulse',
    }).addTo(map);
    userOuterRef.current = userOuter;

    const userInner = L.circleMarker(latlng, {
      radius: 6, fillColor: '#EF4444', color: '#EF4444',
      weight: 2, fillOpacity: 1,
    }).addTo(map);
    userInnerRef.current = userInner;

    const userLabelText = isDemoMode ? 'Demo Location' : 'Your Location';
    const userLabel = L.marker(latlng, {
      icon: L.divIcon({
        className: 'map-user-label',
        html: `<span style="color:#F9FAFB;font-size:10px;font-weight:700;text-shadow:0 1px 4px rgba(0,0,0,0.8);background:rgba(239,68,68,0.2);padding:2px 6px;border-radius:4px;white-space:nowrap;">${userLabelText}</span>`,
        iconSize: [30, 16], iconAnchor: [15, 20],
      }),
    }).addTo(map);
    userLabelRef.current = userLabel;
  }, [isDemoMode]);

  // Smoothly move user markers in-place on GPS update — no destroy/recreate = no blink
  useEffect(() => {
    if (!mapRef.current || !center || !activeCategory) return;
    const latlng: L.LatLngExpression = [center[0], center[1]];

    if (userOuterRef.current) {
      userOuterRef.current.setLatLng(latlng);
    }
    if (userInnerRef.current) {
      userInnerRef.current.setLatLng(latlng);
    }
    if (userLabelRef.current) {
      userLabelRef.current.setLatLng(latlng);
    }
    if (userAccuracyRef.current && sharedLocation?.accuracy) {
      userAccuracyRef.current.setLatLng(latlng);
      userAccuracyRef.current.setRadius(sharedLocation.accuracy);
    }
  }, [sharedLocation?.lat, sharedLocation?.lng, activeCategory]);

  // Update category markers — only depends on activeCategory, NOT on center/GPS
  // Uses categoryCenterRef (captured once when category opens) to avoid re-creating
  // all markers on every GPS tick or React render
  useEffect(() => {
    const map = mapRef.current;
    const catCenter = categoryCenterRef.current;
    if (!map || !activeCategory || !catCenter) return;

    const catLocations = activeCategory && catCenter
      ? (generateLocations(catCenter[0], catCenter[1], isDemoMode ? DEFAULT_CITY : 'Your Location')[activeCategory.id] ?? []).sort((a, b) => a.distanceKm - b.distanceKm)
      : [];
    const color = CATEGORY_COLORS[activeCategory.id] || '#EF4444';

    // Remove only category markers (not user markers)
    layerRef.current.forEach(l => l.remove());
    layerRef.current = [];
    popupMarkersRef.current = [];

    const mapCenter: [number, number] = [catCenter[0], catCenter[1]];
    const allPoints: L.LatLngExpression[] = [mapCenter];

    // Create fresh user markers for this category
    createUserMarkers(map, mapCenter, sharedLocation?.accuracy);

    catLocations.forEach((loc, i) => {
      allPoints.push([loc.lat, loc.lng]);

      const outer = L.circleMarker([loc.lat, loc.lng], {
        radius: 12,
        fillColor: color,
        color: '#F9FAFB',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.4,
      }).addTo(map);

      const inner = L.circleMarker([loc.lat, loc.lng], {
        radius: 4,
        fillColor: color,
        color,
        weight: 2,
        fillOpacity: 1,
      }).addTo(map);

      const label = L.marker([loc.lat, loc.lng], {
        icon: L.divIcon({
          className: 'map-location-label',
          html: `<span style="color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;width:24px;height:24px;text-shadow:0 1px 3px rgba(0,0,0,0.6);">${i + 1}</span>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
      }).addTo(map);

      const arrowMap: Record<string, string> = { N: '↑', NE: '↗', E: '→', SE: '↘', S: '↓', SW: '↙', W: '←', NW: '↖' };
      const isActiveRoute = activeRouteIndex === i;
      outer.bindPopup(
        `<div style="font-family:system-ui,sans-serif;padding:4px 0;min-width:180px;">
          <div style="font-size:14px;font-weight:700;margin-bottom:4px;">${i + 1}. ${loc.name}</div>
          <div style="font-size:12px;color:#9ca3af;margin-bottom:2px;">${arrowMap[loc.direction] || '●'} ${loc.direction} · ${loc.distance} · ⏱ ${loc.eta}</div>
          <div style="font-size:12px;color:#10B981;font-weight:600;margin-bottom:6px;">${loc.status}</div>
          <div style="display:flex;gap:6px;margin-top:4px;">
            <button onclick="window.__roadsosGetDir && window.__roadsosGetDir(${i})" style="flex:1;padding:6px 0;border-radius:6px;border:1px solid ${color}50;background:${color}18;color:#F9FAFB;font-size:11px;font-weight:700;cursor:pointer;">
              ${isActiveRoute ? '✕ Clear Route' : '🗺️ Directions'}
            </button>
          </div>
        </div>`,
        { closeButton: true, className: 'roadsos-popup' },
      );

      layerRef.current.push(outer, inner, label);
      popupMarkersRef.current.push(outer);
    });

    // Only fit bounds the first time for a given category
    if (!hasFittedBoundsRef.current) {
      hasFittedBoundsRef.current = true;
      if (allPoints.length > 0) {
        const bounds = L.latLngBounds(allPoints);
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
      }
    }

    return () => {
      // Only clean up category markers — user markers persist across GPS updates
      layerRef.current.forEach(l => l.remove());
      layerRef.current = [];
      popupMarkersRef.current = [];
    };
  }, [activeCategory, createUserMarkers]);

  if (!activeCategory) return null;

  const color = CATEGORY_COLORS[activeCategory.id] || '#EF4444';

  return (
    <div style={styles.overlay}>
      {/* Header */}
      <div style={styles.header} className="responsive-map-header">
        <button style={styles.closeBtn} onClick={onClose} aria-label="Close map">
          ✕
        </button>
        <span style={styles.headerTitle} className="responsive-map-title">
          {activeCategory.icon} {activeCategory.label}
        </span>
        <button
          onClick={() => setFollowUser(prev => !prev)}
          title={followUser ? 'Auto-follow is on' : 'Auto-follow is off'}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            border: followUser
              ? `2px solid ${color}`
              : '1px solid rgba(249,250,251,0.1)',
            background: followUser
              ? `${color}22`
              : 'var(--bg-primary)',
            color: followUser ? color : 'var(--text-secondary)',
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            outline: 'none',
            WebkitTapHighlightColor: 'transparent',
            transition: 'all 0.2s ease',
            flexShrink: 0,
            boxShadow: followUser ? `0 0 0 1px ${color}22` : 'none',
          }}
          aria-label={followUser ? 'Disable auto-follow' : 'Enable auto-follow'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4" />
            <path d="M12 18v4" />
            <path d="M2 12h4" />
            <path d="M18 12h4" />
          </svg>
        </button>
      </div>

      {/* Google Maps-style route info banner */}
      {routeInfo && activeRouteIndex !== null && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '10px 16px',
          background: `linear-gradient(135deg, ${color} 0%, #000000 350%)`,
          borderBottom: `1px solid ${color}60`,
          zIndex: 1000,
          boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
        }}>
          {/* ETA — big and bold like Google Maps */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '22px', fontWeight: '800', color: '#fff', lineHeight: 1.2, letterSpacing: '-0.5px' }}>
              {routeInfo.duration}
            </span>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)', fontWeight: '500' }}>
              {routeInfo.distance} · {locations[activeRouteIndex]?.direction || ''}
            </span>
          </div>

          {/* Destination name + traffic indicator */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1px' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#fff' }}>
              {locations[activeRouteIndex]?.name || 'Destination'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {/* Traffic color dots */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <span style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: '#22C55E', opacity: routeInfo.greenCount > 0 ? 1 : 0.2,
                }} />
                <span style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: '#EAB308', opacity: routeInfo.yellowCount > 0 ? 1 : 0.2,
                }} />
                <span style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: '#EF4444', opacity: routeInfo.redCount > 0 ? 1 : 0.2,
                }} />
              </div>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', fontWeight: '500' }}>
                {routeInfo.trafficSummary}
              </span>
            </div>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontWeight: '500' }}>
              {locations[activeRouteIndex]?.status || ''}
            </span>
          </div>

          {/* Clear button */}
          <button
            onClick={clearRoute}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.3)',
              background: 'rgba(0,0,0,0.2)',
              color: '#fff',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              outline: 'none',
              WebkitTapHighlightColor: 'transparent',
              flexShrink: 0,
              transition: 'all 0.2s ease',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
            }}
            aria-label="Clear route"
          >
            ✕
          </button>
        </div>
      )}

      {/* Demo mode banner */}
      {isDemoMode && (
        <div style={styles.demoBanner}>
          <span style={{ fontSize: '12px' }}>🧪</span>
          <span style={styles.demoBannerText}>Showing demo locations for {DEFAULT_CITY} — allow GPS for live results</span>
          {!sharedLocation && (
            <button
              onClick={() => { navigator.geolocation.getCurrentPosition(() => {}); }}
              style={styles.demoRetryBtn}
            >
              Retry GPS
            </button>
          )}
        </div>
      )}

      {/* Geolocation status banners */}
      {geoStatus === 'locating' && !isDemoMode && (
        <div style={styles.locationBanner}>
          <span className="location-pulsing-dot" />
          <span style={styles.locationBannerText}>Finding your location…</span>
        </div>
      )}
      {geoStatus === 'denied' && !sharedLocation && !isDemoMode && (
        <div style={{ ...styles.locationBanner, background: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.25)' }}>
          <span style={{ fontSize: '12px' }}>⚠️</span>
          <span style={styles.locationBannerText}>Location access denied — using demo location</span>
        </div>
      )}
      {geoStatus === 'error' && !sharedLocation && !isDemoMode && (
        <div style={{ ...styles.locationBanner, background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)' }}>
          <span style={{ fontSize: '12px' }}>⚠️</span>
          <span style={styles.locationBannerText}>Location unavailable — showing demo map</span>
        </div>
      )}
      {geoStatus === 'ready' && sharedLocation && !isDemoMode && (
        <div style={{ ...styles.locationBanner, background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.15)' }}>
          <span style={{ fontSize: '12px' }}>📍</span>
          <span style={styles.locationBannerText}>
            Live location active
            {sharedLocation.accuracy ? ` (within ${Math.round(sharedLocation.accuracy)}m)` : ''}
          </span>
        </div>
      )}

      {/* Loading state — shown while waiting for GPS or demo mode selection */}
      {!center && (
        <div style={styles.mapContainer}>
          <div style={styles.loadingOverlay}>
            <div style={styles.loadingSpinner} />
            <span style={styles.loadingText}>
              {geoStatus === 'locating' ? 'Getting your current location…' : 'Waiting for GPS signal…'}
            </span>
            <span style={styles.loadingSubtext}>
              Please allow location access when prompted, or use the demo option below
            </span>
            <button
              onClick={() => {
                setUseDemoLocation(true);
              }}
              style={styles.demoButton}
            >
              🗺️ Show Demo Location ({DEFAULT_CITY})
            </button>
          </div>
        </div>
      )}

      {/* Leaflet Map container — always rendered with proper height */}
      <div
        ref={mapContainerRef}
        style={{
          ...styles.mapContainer,
          display: center ? 'block' : 'none',
        }}
        className="responsive-map-container"
      />

      {/* Location cards */}
      {center && (
        <div ref={locationsRef} style={styles.locationsList} className="responsive-location-cards">
          {locations.map((loc, i) => (
            <div
              key={i}
              className={`roadsos-location-card ${activeRouteIndex === i ? 'roadsos-location-card-active' : ''}`}
            >
              <div className="roadsos-card-accent" style={{ background: color }} />
              <div
                style={{ ...styles.locationNumber, background: color, cursor: 'pointer' }}
                onClick={() => {
                  mapRef.current?.flyTo([loc.lat, loc.lng], 16, { duration: 0.8 });
                  popupMarkersRef.current[i]?.openPopup();
                }}
              >
                {i + 1}
              </div>
              <div
                style={styles.locationInfo}
                onClick={() => {
                  mapRef.current?.flyTo([loc.lat, loc.lng], 16, { duration: 0.8 });
                  popupMarkersRef.current[i]?.openPopup();
                }}
              >
                <span style={styles.locationName}>{loc.name}</span>
                <span style={styles.locationMeta}>
                  <span style={{ fontSize: '10px', color }}>{loc.direction}</span> · {loc.distance} · {loc.eta}
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!center) return;
                  if (activeRouteIndex === i) {
                    clearRoute();
                  } else {
                    fetchRoute(center[0], center[1], loc.lat, loc.lng, i);
                  }
                }}
                disabled={isRouting}
                title={activeRouteIndex === i ? 'Clear route' : `Get directions to ${loc.name}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 10px',
                  borderRadius: '8px',
                  border: activeRouteIndex === i
                    ? `1px solid ${color}60`
                    : '1px solid rgba(249,250,251,0.08)',
                  background: activeRouteIndex === i
                    ? `${color}22`
                    : 'rgba(249,250,251,0.04)',
                  color: activeRouteIndex === i ? color : 'var(--text-secondary)',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: isRouting ? 'wait' : 'pointer',
                  outline: 'none',
                  WebkitTapHighlightColor: 'transparent',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
                aria-label={activeRouteIndex === i ? 'Clear route' : `Get directions to ${loc.name}`}
              >
                {isRouting ? (
                  <span style={{ fontSize: '12px' }}>⏳</span>
                ) : activeRouteIndex === i ? (
                  <span style={{ fontSize: '12px' }}>✕</span>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 8 14 12" />
                    <polyline points="22 12 18 16 14 12" />
                    <path d="M2 18h6a4 4 0 0 0 4-4V8" />
                  </svg>
                )}
                <span>{activeRouteIndex === i ? 'Route' : 'Dir'}</span>
              </button>
              <span style={styles.locationStatus}>{loc.status}</span>
            </div>
          ))}
        </div>
      )}

      {/* Interactive styles */}
      <style>{`
        .roadsos-location-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border-radius: 12px;
          background: var(--bg-secondary);
          border: 1px solid rgba(249,250,251,0.06);
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }
        .roadsos-location-card:hover {
          background: #334155;
          border-color: rgba(249,250,251,0.15);
          box-shadow: 0 2px 12px rgba(0,0,0,0.2);
          transform: translateY(-1px);
        }
        .roadsos-location-card:active {
          transform: scale(0.97);
          box-shadow: 0 1px 4px rgba(0,0,0,0.15);
        }
        .roadsos-card-accent {
          position: absolute;
          left: 0;
          top: 8px;
          bottom: 8px;
          width: 3px;
          border-radius: 2px;
          opacity: 0;
          transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1), top 0.25s ease, bottom 0.25s ease;
        }
        .roadsos-location-card:hover .roadsos-card-accent {
          opacity: 0.8;
          top: 4px;
          bottom: 4px;
        }
        .user-location-pulse {
          animation: user-pulse 2s ease-in-out infinite !important;
          transform-origin: center;
        }
        @keyframes user-pulse {
          0%   { opacity: 0.2; }
          50%  { opacity: 0.5; }
          100% { opacity: 0.2; }
        }
        .route-start-icon, .route-end-icon {
          background: none !important;
          border: none !important;
        }
        /* Route drawing animation — reveals path from start to end */
        @keyframes route-draw {
          to {
            stroke-dashoffset: 0;
          }
        }
        .location-pulsing-dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #10B981;
          animation: dot-pulse 1.5s ease-in-out infinite;
        }
        @keyframes dot-pulse {
          0%   { opacity: 1; transform: scale(1); }
          50%  { opacity: 0.4; transform: scale(0.6); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'absolute',
    inset: 0,
    zIndex: 50,
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-primary)',
    animation: 'slide-up 0.3s ease',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))',
    borderBottom: '1px solid rgba(249,250,251,0.06)',
    background: 'var(--bg-secondary)',
    zIndex: 1000,
  },
  closeBtn: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    border: '1px solid rgba(249,250,251,0.1)',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    fontSize: '14px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    outline: 'none',
    WebkitTapHighlightColor: 'transparent',
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: '16px',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  demoBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 16px',
    background: 'rgba(245, 158, 11, 0.12)',
    borderBottom: '1px solid rgba(245, 158, 11, 0.2)',
    zIndex: 1000,
  },
  demoBannerText: {
    fontSize: '11px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    flex: 1,
  },
  demoRetryBtn: {
    padding: '4px 10px',
    borderRadius: '6px',
    border: '1px solid rgba(249,250,251,0.15)',
    background: 'rgba(249,250,251,0.08)',
    color: '#F9FAFB',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    outline: 'none',
    WebkitTapHighlightColor: 'transparent',
  },
  locationBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 16px',
    background: 'rgba(16,185,129,0.1)',
    borderBottom: '1px solid rgba(16,185,129,0.15)',
    zIndex: 1000,
  },
  locationBannerText: {
    fontSize: '12px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
  },
  mapContainer: {
    flex: 1,
    minHeight: '200px',
    zIndex: 1,
  },
  loadingOverlay: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: '16px',
    background: 'var(--bg-primary)',
    padding: '32px 24px',
  },
  loadingSpinner: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    border: '3px solid rgba(239,68,68,0.15)',
    borderTopColor: '#EF4444',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
  },
  loadingSubtext: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
    opacity: 0.6,
    textAlign: 'center',
    maxWidth: '280px',
  },
  demoButton: {
    marginTop: '8px',
    padding: '12px 24px',
    borderRadius: '12px',
    border: '2px solid rgba(239,68,68,0.3)',
    background: 'rgba(239,68,68,0.08)',
    color: 'var(--text-primary)',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    outline: 'none',
    WebkitTapHighlightColor: 'transparent',
    transition: 'all 0.2s ease',
  },
  locationsList: {
    padding: '12px 16px',
    paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    background: 'var(--bg-primary)',
    maxHeight: '40%',
    overflowY: 'auto',
    zIndex: 1000,
    borderTop: '1px solid rgba(249,250,251,0.06)',
  },
  locationNumber: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    color: '#fff',
    fontSize: '12px',
    fontWeight: '800',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  locationInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  locationName: {
    fontSize: '14px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    transition: 'color 0.2s ease',
  },
  locationMeta: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    fontWeight: '500',
    transition: 'color 0.2s ease',
  },
  locationStatus: {
    fontSize: '11px',
    fontWeight: '700',
    color: 'var(--trust-safe)',
    padding: '4px 8px',
    borderRadius: '6px',
    background: 'rgba(16,185,129,0.1)',
    flexShrink: 0,
  },
};
