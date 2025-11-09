'use client';
import { useCallback, useEffect, useRef, useState } from "react";
import haversine from "haversine-distance";

type Fix = { t: number; lat: number; lon: number; acc: number };

export type GeoTrackerOptions = {
  minAccuracyM?: number;     // discard fixes worse than this
  minIntervalMs?: number;    // ignore updates faster than this
  smoothFactor?: number;     // 0..1 EMA for speed smoothing
};

export function useGeoTracker(opts: GeoTrackerOptions = {}) {
  const {
    minAccuracyM = 60,
    minIntervalMs = 100,  // Reduced from 500ms for more frequent updates
    smoothFactor = 0.3,   // Slightly more responsive
  } = opts;

  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<PermissionState | 'unknown'>('unknown');

  // Display values - updated frequently for smooth UI
  const [displayDistanceM, setDisplayDistanceM] = useState(0);
  const [displaySpeedKmh, setDisplaySpeedKmh] = useState<number | null>(null);
  const [displayAvgSpeedKmh, setDisplayAvgSpeedKmh] = useState<number | null>(null);

  const [lastFix, setLastFix] = useState<GeolocationPosition | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const prevRef = useRef<Fix | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const movingTimeRef = useRef<number>(0);
  const lastTickRef = useRef<number | null>(null);
  
  // Raw values from GPS
  const distanceRef = useRef<number>(0);
  const speedMsRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  
  // For interpolation
  const lastSpeedUpdateRef = useRef<number>(0);

  // Start / Pause / Reset
  const start = useCallback(() => setIsActive(true), []);
  const pause = useCallback(() => setIsActive(false), []);
  const reset = useCallback(() => {
    setIsActive(false);
    setDisplayDistanceM(0);
    distanceRef.current = 0;
    setDisplaySpeedKmh(null);
    setDisplayAvgSpeedKmh(null);
    speedMsRef.current = null;
    setLastFix(null);
    prevRef.current = null;
    startedAtRef.current = null;
    movingTimeRef.current = 0;
    lastTickRef.current = null;
    lastUpdateTimeRef.current = 0;
    lastSpeedUpdateRef.current = 0;
  }, []);

  // High-frequency UI update loop - runs every frame for smooth display
  useEffect(() => {
    if (!isActive) return;
    
    const r = () => {
      const now = performance.now();
      const dt = lastTickRef.current != null ? (now - lastTickRef.current) / 1000 : 0;
      
      if (lastTickRef.current != null && dt > 0) {
        movingTimeRef.current += dt;
      }
      lastTickRef.current = now;
      
      // Update displayed distance immediately (smooth interpolation)
      setDisplayDistanceM(distanceRef.current);
      
      // Interpolate speed smoothly between GPS updates
      if (speedMsRef.current != null) {
        const currentSpeedKmh = speedMsRef.current * 3.6;
        setDisplaySpeedKmh(currentSpeedKmh);
      } else {
        setDisplaySpeedKmh(null);
      }
      
      // Update average speed in real-time
      const tsec = movingTimeRef.current;
      if (tsec > 0.5 && distanceRef.current >= 0) {
        const avgMs = distanceRef.current / tsec;
        setDisplayAvgSpeedKmh(avgMs * 3.6);
      }
      
      requestAnimationFrame(r);
    };
    
    lastTickRef.current = performance.now();
    const id = requestAnimationFrame(r);
    return () => cancelAnimationFrame(id);
  }, [isActive]);

  // Check permission status
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => setError("Geolocation is not supported by this browser."), 0);
      return;
    }

    // Check permissions API if available
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((result) => {
        setPermissionStatus(result.state);
        if (result.state === 'granted') {
          setError(null);
        }
        result.onchange = () => {
          setPermissionStatus(result.state);
          if (result.state === 'granted') {
            setError(null);
          }
        };
      }).catch(() => {
        // Permissions API not fully supported, ignore
        setPermissionStatus('unknown');
      });
    }
  }, []);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => setError("Geolocation is not supported by this browser."), 0);
      return;
    }

    const onSuccess = (pos: GeolocationPosition) => {
      setLastFix(pos);
      setError(null); // Clear any previous errors on success
      if (!isActive) return;

      const { latitude, longitude, speed, accuracy } = pos.coords;
      const now = pos.timestamp;

      // Ignore very inaccurate fixes
      if ((accuracy ?? Infinity) > minAccuracyM) return;

      const prev = prevRef.current;
      const nowMs = Date.now();
      
      // Initialize timers
      if (!startedAtRef.current) startedAtRef.current = now;

      let s: number | null = (typeof speed === "number" && speed >= 0) ? speed : null;

      if (prev) {
        const dt = (now - prev.t) / 1000;
        
        // Allow more frequent updates (minIntervalMs is now 100ms)
        if (dt * 1000 < minIntervalMs) return;

        // Compute segment distance
        const d = haversine({ lat: prev.lat, lon: prev.lon }, { lat: latitude, lon: longitude });

        // If native speed missing, compute fallback
        if (s == null && dt > 0) s = d / dt;

        // Add to total distance only if the fix is sane (<= 100 m in 1s ~ 360 km/h cap)
        const unrealistic = d > 100 && dt <= 1;
        if (!unrealistic) {
          distanceRef.current += d;
          // Don't call setState here - let the animation loop handle it
        }
      }

      // Smooth current speed with exponential moving average
      if (s != null && Number.isFinite(s)) {
        const currentSpeed = speedMsRef.current;
        if (currentSpeed == null) {
          speedMsRef.current = s;
        } else {
          // EMA smoothing
          speedMsRef.current = currentSpeed + (s - currentSpeed) * smoothFactor;
        }
        lastSpeedUpdateRef.current = nowMs;
      } else if (s == null && prev) {
        // If no speed from GPS, keep last known speed briefly, then decay
        const timeSinceUpdate = (nowMs - lastSpeedUpdateRef.current) / 1000;
        if (timeSinceUpdate > 2) {
          speedMsRef.current = null;
        }
      }

      prevRef.current = { t: now, lat: latitude, lon: longitude, acc: accuracy ?? 9999 };
      lastUpdateTimeRef.current = nowMs;
    };

    const onError = (e: GeolocationPositionError) => {
      let errorMessage = e.message;
      
      if (e.code === e.PERMISSION_DENIED) {
        errorMessage = "Location permission denied. Please enable location access in your browser settings and try again.";
        setPermissionStatus('denied');
      } else if (e.code === e.POSITION_UNAVAILABLE) {
        errorMessage = "Location information unavailable. Make sure location services are enabled on your device.";
      } else if (e.code === e.TIMEOUT) {
        errorMessage = "Location request timed out. Please try again.";
      }
      
      setError(errorMessage);
    };

    // Attach watcher only when active
    if (isActive) {
      watchIdRef.current = navigator.geolocation.watchPosition(onSuccess, onError, {
        enableHighAccuracy: true,
        maximumAge: 100,  // Allow slightly stale data for smoother updates
        timeout: 5000,    // Reduced timeout for faster response
      });
    } else {
      // Clear watcher when paused
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    }

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isActive, minAccuracyM, minIntervalMs, smoothFactor]);

  return {
    isActive, start, pause, reset,
    error,
    permissionStatus,
    distanceM: displayDistanceM,
    speedKmh: displaySpeedKmh,
    avgSpeedKmh: displayAvgSpeedKmh,
    lastFix,
  };
}
