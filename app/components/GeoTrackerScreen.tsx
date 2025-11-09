'use client';
// GeoTrackerScreen.tsx
import React from "react";
import { useGeoTracker } from "../hooks/useGeoTracker";

function fmt(n: number | null | undefined, digits = 1) {
  return n == null ? "—" : n.toFixed(digits);
}

export default function GeoTrackerScreen() {
  const {
    isActive, start, pause, reset,
    error,
    distanceM,
    speedKmh,
    avgSpeedKmh,
    lastFix,
  } = useGeoTracker({
    minAccuracyM: 60,
    minIntervalMs: 500,
    smoothFactor: 0.25,
  });

  return (
    <div style={{ fontFamily: "system-ui", padding: 16, maxWidth: 480, margin: "0 auto" }}>
      <h2 style={{ margin: "8px 0" }}>Distance & Speed</h2>

      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 12,
        marginTop: 12
      }}>
        <Stat label="Current speed" value={`${fmt(speedKmh)} km/h`} />
        <Stat label="Avg speed" value={`${fmt(avgSpeedKmh)} km/h`} />
        <Stat label="Distance" value={`${(distanceM/1000).toFixed(3)} km`} />
        <Stat label="Accuracy" value={lastFix?.coords.accuracy ? `${Math.round(lastFix.coords.accuracy)} m` : "—"} />
      </div>

      {error && <p style={{ color: "#c62828", marginTop: 10 }}>Error: {error}</p>}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        {!isActive ? (
          <button onClick={start} style={btn("#1565c0")}>Start</button>
        ) : (
          <button onClick={pause} style={btn("#ef6c00")}>Pause</button>
        )}
        <button onClick={reset} style={btn("#455a64")}>Reset</button>
      </div>

      <small style={{ display: "block", marginTop: 12, opacity: 0.8 }}>
        Use over HTTPS on a real phone for best accuracy. Indoors GPS may be noisy.
      </small>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      padding: 12,
      borderRadius: 12,
      background: "rgba(0,0,0,0.06)"
    }}>
      <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

const btn = (bg: string) => ({
  padding: "12px 16px",
  borderRadius: 12,
  border: "none",
  color: "white",
  background: bg,
  fontSize: 16,
});
