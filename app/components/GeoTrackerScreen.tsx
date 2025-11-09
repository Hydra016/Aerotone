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
    permissionStatus,
    distanceM,
    speedKmh,
    avgSpeedKmh,
    lastFix,
  } = useGeoTracker({
    minAccuracyM: 60,
    minIntervalMs: 100,  // More frequent updates for real-time feel
    smoothFactor: 0.3,   // More responsive smoothing
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

      {error && (
        <div style={{
          padding: 12,
          borderRadius: 8,
          background: "#ffebee",
          border: "1px solid #ef5350",
          marginTop: 16,
          color: "#c62828"
        }}>
          <strong>Error:</strong> {error}
          {permissionStatus === 'denied' && (
            <div style={{ marginTop: 8, fontSize: 14 }}>
              <p><strong>To fix this:</strong></p>
              <ul style={{ margin: "8px 0", paddingLeft: 20 }}>
                <li>Check your browser's location permission settings</li>
                <li>On mobile: Go to Settings → Privacy → Location Services</li>
                <li>Make sure the app is served over HTTPS (required for geolocation)</li>
                <li>Try refreshing the page after granting permission</li>
              </ul>
            </div>
          )}
        </div>
      )}

      {permissionStatus === 'prompt' && !error && (
        <div style={{
          padding: 12,
          borderRadius: 8,
          background: "#fff3e0",
          border: "1px solid #ff9800",
          marginTop: 16,
          color: "#e65100"
        }}>
          <strong>Note:</strong> Click "Start" to request location permission. Make sure to allow access when prompted.
        </div>
      )}

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
