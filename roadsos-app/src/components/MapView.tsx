import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { CategoryInfo } from '../types';

interface MapViewProps {
  activeCategory: CategoryInfo | null;
  onClose: () => void;
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

// Fallback location (NYC) when geolocation is unavailable
const FALLBACK_LOCATION: [number, number] = [40.7128, -74.006];
const FALLBACK_NAME = 'New York City';

// Generate synthetic nearby locations relative to a center point
function generateLocations(
  centerLat: number,
  centerLng: number,
  cityName: string
): Record<string, LocationData[]> {
  // Approx 1 degree lat ≈ 111km, 1 degree lng ≈ 111*cos(lat) km
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
    const mins = Math.ceil((km / 40) * 60); // assume 40 km/h avg
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
    puncture: [
      { name: `Quick Tire - ${cityName}`, ...d(-1.2, 0.8), eta: eta(1.5), status: 'Open Now', ...offset(-1.2, 0.8) },
      { name: `AutoFix ${cityName} 24h`, ...d(1.0, -2.2), eta: eta(2.4), status: '24 Hour', ...offset(1.0, -2.2) },
    ],
  };
}

// Category color mapping
const CATEGORY_COLORS: Record<string, string> = {
  trauma: '#EF4444',
  police: '#3B82F6',
  towing: '#10B981',
  puncture: '#F59E0B',
};

// Dark popup styles injected once globally
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

export default function MapView({ activeCategory, onClose }: MapViewProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const locationsRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<L.Layer[]>([]);
  const popupMarkersRef = useRef<L.CircleMarker[]>([]);
  const watchIdRef = useRef<number | null>(null);

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; name: string; accuracy?: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState<'locating' | 'ready' | 'error' | 'denied'>('locating');
  const [followUser, setFollowUser] = useState(false);
  const [activeRouteIndex, setActiveRouteIndex] = useState<number | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [isRouting, setIsRouting] = useState(false);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const routeMarkerStartRef = useRef<L.Marker | null>(null);
  const routeMarkerEndRef = useRef<L.Marker | null>(null);

  // Ref-based handler for Leaflet popup HTML buttons — avoids stale closures
  const getDirRef = useRef<((index: number) => void) | null>(null);
  getDirRef.current = (index: number) => {
    const loc = locations[index];
    if (!loc) return;
    if (activeRouteIndex === index) {
      clearRoute();
    } else {
      fetchRoute(center[0], center[1], loc.lat, loc.lng, index);
    }
  };

  // Expose route fetcher globally for Leaflet popup HTML buttons
  useEffect(() => {
    const handler = (index: number) => getDirRef.current?.(index);
    (window as unknown as Record<string, unknown>).__roadsosGetDir = handler;
    return () => {
      if ((window as unknown as Record<string, unknown>).__roadsosGetDir === handler) {
        delete (window as unknown as Record<string, unknown>).__roadsosGetDir;
      }
    };
  }, []);

  // Inject Leaflet popup dark styles once
  useEffect(() => { injectPopupStyles(); }, []);

  // Request geolocation on mount — watchPosition for continuous real-time tracking
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoStatus('error');
      return;
    }

    const timeoutId = setTimeout(() => {
      if (geoStatus === 'locating') {
        setGeoStatus('error');
      }
    }, 10000);

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        clearTimeout(timeoutId);
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          name: 'Your Location',
          accuracy: position.coords.accuracy,
        });
        setGeoStatus('ready');
      },
      (err) => {
        clearTimeout(timeoutId);
        if (err.code === err.PERMISSION_DENIED) {
          setGeoStatus('denied');
        } else {
          setGeoStatus('error');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 10000, // 10 sec cache — faster updates
      },
    );

    watchIdRef.current = watchId;

    return () => {
      clearTimeout(timeoutId);
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  // Build locations from user position or fallback
  const center = userLocation
    ? ([userLocation.lat, userLocation.lng] as [number, number])
    : FALLBACK_LOCATION;

  const locations = activeCategory
    ? (generateLocations(center[0], center[1], userLocation?.name ?? FALLBACK_NAME)[activeCategory.id] ?? []).sort((a, b) => a.distanceKm - b.distanceKm)
    : [];

  // Create map once on mount
  useEffect(() => {
    if (!mapContainerRef.current) return;

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

    // Disable auto-follow when user manually drags or zooms the map
    map.on('dragstart', () => setFollowUser(false));
    map.on('zoomstart', () => setFollowUser(false));

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
      subdomains: ['a', 'b', 'c', 'd'],
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = [];
      popupMarkersRef.current = [];
    };
  }, []);

  // Update map center when user location resolves or moves (if auto-follow is on)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userLocation || !followUser) return;
    map.setView([userLocation.lat, userLocation.lng], map.getZoom());
  }, [userLocation, followUser]);

  // Scroll locations list to top when category changes
  useEffect(() => {
    locationsRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeCategory]);

  // Clear any active route overlay
  const clearRoute = useCallback(() => {
    if (routePolylineRef.current) {
      routePolylineRef.current.remove();
      routePolylineRef.current = null;
    }
    if (routeMarkerStartRef.current) {
      routeMarkerStartRef.current.remove();
      routeMarkerStartRef.current = null;
    }
    if (routeMarkerEndRef.current) {
      routeMarkerEndRef.current.remove();
      routeMarkerEndRef.current = null;
    }
    setActiveRouteIndex(null);
    setRouteInfo(null);
  }, []);

  // Fetch driving route from OSRM and draw on map
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

      setRouteInfo({
        distance: distKm < 1 ? `${Math.round(route.distance)} m` : `${distKm.toFixed(1)} km`,
        duration: durMin < 1 ? '<1 min' : `${durMin} min`,
      });
      setActiveRouteIndex(index);

      // Draw the route polyline with category-colored dashes
      const polyline = L.polyline(coords, {
        color: catColor,
        weight: 4,
        opacity: 0.85,
        dashArray: '12, 8',
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);
      routePolylineRef.current = polyline;

      // Start marker (direction circle on user location)
      const startIcon = L.divIcon({
        className: 'route-start-icon',
        html: `<svg width="16" height="16" viewBox="0 0 24 24" fill="${catColor}" stroke="#fff" stroke-width="2.5"><circle cx="12" cy="12" r="6"/></svg>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      const startMarker = L.marker([fromLat, fromLng], { icon: startIcon, interactive: false }).addTo(map);
      routeMarkerStartRef.current = startMarker;

      // End marker (destination pin with number)
      const endIcon = L.divIcon({
        className: 'route-end-icon',
        html: `<div style="width:22px;height:22px;border-radius:50%;background:${catColor};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;color:#fff;">${index + 1}</div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      const endMarker = L.marker([toLat, toLng], { icon: endIcon, interactive: false }).addTo(map);
      routeMarkerEndRef.current = endMarker;

      // Fit bounds to show the entire route
      map.fitBounds(polyline.getBounds().pad(0.15), { maxZoom: 16 });
    } catch {
      // Route fetch failed silently
    } finally {
      setIsRouting(false);
    }
  }, [clearRoute, activeCategory]);

  // Clear route when category changes
  useEffect(() => {
    clearRoute();
  }, [activeCategory, clearRoute]);

  // Update markers when category or user location changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !activeCategory) return;

    const catLocations = locations;
    const color = CATEGORY_COLORS[activeCategory.id] || '#EF4444';

    // Clear existing layers
    layerRef.current.forEach(l => l.remove());
    layerRef.current = [];
    popupMarkersRef.current = [];

    const allPoints: L.LatLngExpression[] = [center];

    // User location — accuracy radius circle
    if (userLocation?.accuracy) {
      const accuracyCircle = L.circle(center, {
        radius: userLocation.accuracy,
        color: '#EF4444',
        weight: 1,
        opacity: 0.3,
        fillColor: '#EF4444',
        fillOpacity: 0.08,
        interactive: false,
      }).addTo(map);
      layerRef.current.push(accuracyCircle);
    }

    // User location — outer pulsing ring
    const userOuter = L.circleMarker(center, {
      radius: 16,
      fillColor: '#EF4444',
      color: '#fff',
      weight: 3,
      opacity: 1,
      fillOpacity: 0.25,
      className: 'user-location-pulse',
    }).addTo(map);

    // User location — inner solid dot
    const userInner = L.circleMarker(center, {
      radius: 6,
      fillColor: '#EF4444',
      color: '#EF4444',
      weight: 2,
      fillOpacity: 1,
    }).addTo(map);

    const locationLabel = userLocation
      ? 'Your Location'
      : 'You (approx)';
    const userLabel = L.marker(center, {
      icon: L.divIcon({
        className: 'map-user-label',
        html: `<span style="color:#F9FAFB;font-size:10px;font-weight:700;text-shadow:0 1px 4px rgba(0,0,0,0.8);background:rgba(239,68,68,0.2);padding:2px 6px;border-radius:4px;white-space:nowrap;">${locationLabel}</span>`,
        iconSize: [30, 16],
        iconAnchor: [15, 20],
      }),
    }).addTo(map);

    layerRef.current.push(userOuter, userInner, userLabel);

    // Service location markers
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
              ${isActiveRoute ? '✕ Clear Route' : '🗺️ Show Directions'}
            </button>
          </div>
        </div>`,
        { closeButton: true, className: 'roadsos-popup' },
      );

      layerRef.current.push(outer, inner, label);
      popupMarkersRef.current.push(outer);
    });

    // Fit bounds to show all markers
    if (allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
    }

    return () => {
      layerRef.current.forEach(l => l.remove());
      layerRef.current = [];
      popupMarkersRef.current = [];
    };
  }, [activeCategory, userLocation]);

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
        {/* Auto-follow toggle */}
        <button
          onClick={() => setFollowUser(prev => !prev)}
          title={followUser ? 'Auto-follow is on — map re-centers on your location' : 'Auto-follow is off — tap to re-center on your location'}
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

      {/* Route info banner — shown when a route is active */}
      {routeInfo && activeRouteIndex !== null && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px',
          background: `${color}18`,
          borderBottom: `1px solid ${color}30`,
          zIndex: 1000,
        }}>
          <span style={{ fontSize: '14px' }}>🗺️</span>
          <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', flex: 1 }}>
            Route to {locations[activeRouteIndex]?.name || 'destination'}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', fontFamily: 'var(--font-mono)' }}>
            {routeInfo.distance} · {routeInfo.duration}
          </span>
          <button
            onClick={clearRoute}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              border: '1px solid rgba(249,250,251,0.12)',
              background: 'rgba(249,250,251,0.06)',
              color: 'var(--text-secondary)',
              fontSize: '11px',
              fontWeight: '600',
              cursor: 'pointer',
              outline: 'none',
              WebkitTapHighlightColor: 'transparent',
            }}
            aria-label="Clear route"
          >
            ✕ Clear
          </button>
        </div>
      )}

      {/* Geolocation status banners */}
      {geoStatus === 'locating' && (
        <div style={styles.locationBanner}>
          <span className="location-pulsing-dot" />
          <span style={styles.locationBannerText}>Finding your location…</span>
        </div>
      )}
      {geoStatus === 'denied' && !userLocation && (
        <div style={{ ...styles.locationBanner, background: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.25)' }}>
          <span style={{ fontSize: '12px' }}>⚠️</span>
          <span style={styles.locationBannerText}>Location access denied — enable in browser settings</span>
          <button
            onClick={() => {
              setGeoStatus('locating');
              window.location.reload();
            }}
            style={{
              marginLeft: 'auto',
              padding: '3px 10px',
              borderRadius: '6px',
              border: '1px solid rgba(249,250,251,0.15)',
              background: 'rgba(249,250,251,0.08)',
              color: '#F9FAFB',
              fontSize: '11px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}
      {geoStatus === 'error' && !userLocation && (
        <div style={{ ...styles.locationBanner, background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)' }}>
          <span style={{ fontSize: '12px' }}>⚠️</span>
          <span style={styles.locationBannerText}>Location unavailable — showing approximate area</span>
          <button
            onClick={() => {
              setGeoStatus('locating');
              window.location.reload();
            }}
            style={{
              marginLeft: 'auto',
              padding: '3px 10px',
              borderRadius: '6px',
              border: '1px solid rgba(249,250,251,0.15)',
              background: 'rgba(249,250,251,0.08)',
              color: '#F9FAFB',
              fontSize: '11px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}
      {geoStatus === 'ready' && userLocation && (
        <div style={{ ...styles.locationBanner, background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.15)' }}>
          <span style={{ fontSize: '12px' }}>📍</span>
          <span style={styles.locationBannerText}>
            Live location active
            {userLocation.accuracy ? ` (within ${Math.round(userLocation.accuracy)}m)` : ''}
          </span>
        </div>
      )}

      {/* Leaflet Map */}
      <div ref={mapContainerRef} style={styles.mapContainer} className="responsive-map-container" />

      {/* Location cards */}
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
            {/* Directions button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
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
        /* User location pulsing ring animation */
        .user-location-pulse {
          animation: user-pulse 2s ease-in-out infinite !important;
          transform-origin: center;
        }
        @keyframes user-pulse {
          0%   { opacity: 0.2; }
          50%  { opacity: 0.5; }
          100% { opacity: 0.2; }
        }
        /* Active route card highlight */
        .roadsos-location-card-active {
          box-shadow: 0 0 0 1px ${color} !important;
          background: ${color}10 !important;
        }
        /* Route start/end marker icons */
        .route-start-icon, .route-end-icon {
          background: none !important;
          border: none !important;
        }
        /* Live location pulsing dot in banner */
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
  headerSpacer: {
    width: '32px',
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
  },
  locationMeta: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    fontWeight: '500',
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
