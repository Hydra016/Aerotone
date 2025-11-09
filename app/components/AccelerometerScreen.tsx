'use client';
import { useAccelerometer } from '../hooks/useAccelerometer';

export default function AccelerometerScreen() {
  const { data, error, isSupported, needsPermission, requestPermission } = useAccelerometer();

  const formatValue = (value: number | null | undefined): string => {
    if (value == null) return '—';
    return value.toFixed(1);
  };

  const getMagnitude = (): number => {
    if (!data) return 0;
    return Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2);
  };

  return (
    <div style={{
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: 24,
      maxWidth: 600,
      margin: '0 auto',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
    }}>
      <h1 style={{ margin: '0 0 32px 0', fontSize: 32, fontWeight: 700 }}>
        Accelerometer Data
      </h1>

      {needsPermission && (
        <div style={{
          padding: 16,
          borderRadius: 12,
          background: '#e3f2fd',
          border: '1px solid #2196F3',
          color: '#1565c0',
          marginBottom: 24,
        }}>
          <div style={{ marginBottom: 12 }}>
            <strong>Permission Required</strong>
          </div>
          <div style={{ marginBottom: 12, fontSize: 14 }}>
            This app needs access to your device's motion sensors. Click the button below to grant permission.
          </div>
          <button
            onClick={requestPermission}
            style={{
              padding: '12px 24px',
              borderRadius: 8,
              border: 'none',
              background: '#2196F3',
              color: 'white',
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Allow Motion Access
          </button>
        </div>
      )}

      {error && !needsPermission && (
        <div style={{
          padding: 16,
          borderRadius: 12,
          background: '#ffebee',
          border: '1px solid #ef5350',
          color: '#c62828',
          marginBottom: 24,
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {!isSupported && !error && (
        <div style={{
          padding: 16,
          borderRadius: 12,
          background: '#fff3e0',
          border: '1px solid #ff9800',
          color: '#e65100',
          marginBottom: 24,
        }}>
          <strong>Note:</strong> Accelerometer API requires HTTPS and a compatible browser (Chrome/Edge on mobile devices).
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
        marginBottom: 24,
      }}>
        <DataCard
          label="X-axis"
          value={formatValue(data?.x)}
          unit="m/s²"
          color="#2196F3"
        />
        <DataCard
          label="Y-axis"
          value={formatValue(data?.y)}
          unit="m/s²"
          color="#4CAF50"
        />
        <DataCard
          label="Z-axis"
          value={formatValue(data?.z)}
          unit="m/s²"
          color="#FF9800"
        />
        <DataCard
          label="Magnitude"
          value={formatValue(getMagnitude())}
          unit="m/s²"
          color="#9C27B0"
        />
      </div>

      {data && (
        <div style={{
          padding: 16,
          borderRadius: 12,
          background: 'rgba(0, 0, 0, 0.03)',
          fontSize: 14,
          color: '#666',
        }}>
          <div style={{ marginBottom: 8 }}>
            <strong>Raw values:</strong>
          </div>
          <div style={{ fontFamily: 'monospace' }}>
            x: {data.x.toFixed(6)} m/s²<br />
            y: {data.y.toFixed(6)} m/s²<br />
            z: {data.z.toFixed(6)} m/s²
          </div>
        </div>
      )}
    </div>
  );
}

function DataCard({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div style={{
      padding: 20,
      borderRadius: 16,
      background: 'white',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      border: `2px solid ${color}`,
    }}>
      <div style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 32, fontWeight: 700, color, marginBottom: 4 }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: '#999' }}>
        {unit}
      </div>
    </div>
  );
}

