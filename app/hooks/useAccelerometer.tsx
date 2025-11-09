'use client';
import { useEffect, useState, useRef } from 'react';

export interface AccelerometerData {
  x: number;
  y: number;
  z: number;
  timestamp: number;
}

// TypeScript definitions for Accelerometer API
interface SensorErrorEvent extends Event {
  error: DOMException;
}

interface AccelerometerSensor extends EventTarget {
  readonly x: number | null;
  readonly y: number | null;
  readonly z: number | null;
  readonly timestamp: number;
  start(): void;
  stop(): void;
  addEventListener(type: 'reading' | 'error', listener: (event: Event) => void): void;
}

interface AccelerometerConstructor {
  new (options?: { frequency?: number }): AccelerometerSensor;
}

declare global {
  interface Window {
    Accelerometer: AccelerometerConstructor;
  }
}

export function useAccelerometer() {
  const [data, setData] = useState<AccelerometerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const sensorRef = useRef<AccelerometerSensor | null>(null);

  useEffect(() => {
    // Check if Accelerometer API is supported
    const supported = 'Accelerometer' in window;
    
    // Use setTimeout to avoid synchronous setState in effect
    setTimeout(() => setIsSupported(supported), 0);
    
    if (supported) {
      try {
        const Accelerometer = window.Accelerometer;
        const sensor = new Accelerometer({ frequency: 60 }); // 60Hz updates
        
        sensor.addEventListener('reading', () => {
          setData({
            x: sensor.x ?? 0,
            y: sensor.y ?? 0,
            z: sensor.z ?? 0,
            timestamp: Date.now(),
          });
        });

        sensor.addEventListener('error', (e: Event) => {
          const errorEvent = e as SensorErrorEvent;
          if (errorEvent.error?.name === 'NotAllowedError') {
            setError('Permission denied. Please allow motion sensor access.');
          } else if (errorEvent.error?.name === 'NotReadableError') {
            setError('Sensor is not readable. It may be in use by another app.');
          } else {
            setError(`Sensor error: ${errorEvent.error?.message || 'Unknown error'}`);
          }
        });

        sensor.start();
        sensorRef.current = sensor;

        return () => {
          sensor.stop();
        };
      } catch (err) {
        setTimeout(() => {
          setError(`Failed to initialize accelerometer: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }, 0);
      }
    } else {
      setTimeout(() => {
        setError('Accelerometer API is not supported in this browser. Try using Chrome or Edge on a mobile device.');
      }, 0);
    }
  }, []);

  return { data, error, isSupported };
}

