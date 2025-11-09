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
    minIntervalMs = 500,
    smoothFactor = 0.25,
  } = opts;

  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [distanceM, setDistanceM] = useState(0);
  const [speedMs, setSpeedMs] = useState<number | null>(null);
  const [avgSpeedMs, setAvgSpeedMs] = useState<number | null>(null);

  const [lastFix, setLastFix] = useState<GeolocationPosition | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const prevRef = useRef<Fix | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const movingTimeRef = useRef<number>(0);  // seconds accumulating while active
  const lastTickRef = useRef<number | null>(null);

  // Start / Pause / Reset
  const start = useCallback(() => setIsActive(true), []);
  const pause = useCallback(() => setIsActive(false), []);
  const reset = useCallback(() => {
    setIsActive(false);
    setDistanceM(0);
    setSpeedMs(null);
    setAvgSpeedMs(null);
    setLastFix(null);
    prevRef.current = null;
    startedAtRef.current = null;
    movingTimeRef.current = 0;
    lastTickRef.current = null;
  }, []);

  // Accumulate moving time while active (based on callbacks)
  useEffect(() => {
    if (!isActive) return;
    const r = () => {
      const now = performance.now();
      if (lastTickRef.current != null) {
        movingTimeRef.current += (now - lastTickRef.current) / 1000;
      }
      lastTickRef.current = now;
      requestAnimationFrame(r);
    };
    lastTickRef.current = performance.now();
    const id = requestAnimationFrame(r);
    return () => cancelAnimationFrame(id);
  }, [isActive]);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setError("Geolocation is not supported by this browser.");
      return;
    }

    const onSuccess = (pos: GeolocationPosition) => {
      setLastFix(pos);
      if (!isActive) return;

      const { latitude, longitude, speed, accuracy } = pos.coords;
      const now = pos.timestamp;

      // Ignore very inaccurate or too-frequent updates
      if ((accuracy ?? Infinity) > minAccuracyM) return;

      const prev = prevRef.current;
      // Initialize timers
      if (!startedAtRef.current) startedAtRef.current = now;

      let s: number | null = (typeof speed === "number" && speed >= 0) ? speed : null;

      if (prev) {
        const dt = (now - prev.t) / 1000;
        if (dt * 1000 < minIntervalMs) return;

        // Compute segment distance
        const d = haversine({ lat: prev.lat, lon: prev.lon }, { lat: latitude, lon: longitude });

        // If native speed missing, compute fallback
        if (s == null && dt > 0) s = d / dt;

        // Add to total distance only if the fix is sane (<= 100 m in 1s ~ 360 km/h cap)
        const unrealistic = d > 100 && dt <= 1;
        if (!unrealistic) {
          setDistanceM((m) => m + d);
        }
      }

      // Smooth current speed
      if (s != null && Number.isFinite(s)) {
        setSpeedMs((v) => (v == null ? s : v + (s - v) * smoothFactor));
      }

      // Average speed over moving time (distance / time)
      const tsec = movingTimeRef.current;
      if (tsec > 2 && distanceM >= 0) {
        const avg = (distanceM) / tsec; // m/s
        setAvgSpeedMs(avg);
      }

      prevRef.current = { t: now, lat: latitude, lon: longitude, acc: accuracy ?? 9999 };
    };

    const onError = (e: GeolocationPositionError) => setError(e.message);

    // Attach watcher only when active
    if (isActive) {
      watchIdRef.current = navigator.geolocation.watchPosition(onSuccess, onError, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      });
    }

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isActive, minAccuracyM, minIntervalMs, smoothFactor, distanceM]);

  const kmh = speedMs == null ? null : speedMs * 3.6;
  const avgKmh = avgSpeedMs == null ? null : avgSpeedMs * 3.6;

  return {
    isActive, start, pause, reset,
    error,
    distanceM,
    speedMs, speedKmh: kmh,
    avgSpeedMs, avgSpeedKmh: avgKmh,
    lastFix,
  };
}
