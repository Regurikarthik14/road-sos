import { useState, useEffect, useRef } from 'react';

export interface UserLocation {
  lat: number;
  lng: number;
  accuracy: number | null;
}

export type GeoStatus = 'idle' | 'locating' | 'ready' | 'error' | 'denied';

export function useGeolocation() {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>('locating');
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoStatus('error');
      return;
    }

    const timeoutId = setTimeout(() => {
      setGeoStatus(prev => prev === 'locating' ? 'error' : prev);
    }, 10000);

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        clearTimeout(timeoutId);
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
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
        maximumAge: 10000,
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

  return { userLocation, geoStatus };
}
