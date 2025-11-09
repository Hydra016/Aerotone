'use client';
import { useEffect, useState, useRef } from 'react';

export interface AccelerometerData {
  x: number;
  y: number;
  z: number;
  timestamp: number;
}

// Type definitions for DeviceMotionEvent permission API (iOS 13+)
declare global {
  interface Window {
    DeviceMotionEvent: {
      new (type: string, eventInitDict?: DeviceMotionEventInit): DeviceMotionEvent;
      requestPermission?: () => Promise<'granted' | 'denied' | 'default'>;
    };
  }
}

export function useAccelerometer() {
  const [data, setData] = useState<AccelerometerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [needsPermission, setNeedsPermission] = useState<boolean>(false);
  const eventHandlerRef = useRef<((e: DeviceMotionEvent) => void) | null>(null);

  useEffect(() => {
    // Check if DeviceMotionEvent is supported (works on iOS Safari/Chrome)
    const deviceMotionSupported = 'DeviceMotionEvent' in window;
    
    // Also check for modern Accelerometer API (works on Android Chrome)
    const accelerometerSupported = 'Accelerometer' in window;
    
    const supported = deviceMotionSupported || accelerometerSupported;
    
    setTimeout(() => setIsSupported(supported), 0);
    
    if (!supported) {
      setTimeout(() => {
        setError('Motion sensors are not supported in this browser.');
      }, 0);
      return;
    }

    // Try modern Accelerometer API first (Android Chrome)
    if (accelerometerSupported && 'Accelerometer' in window) {
      try {
        interface AccelerometerSensor {
          x: number | null;
          y: number | null;
          z: number | null;
          addEventListener(type: 'reading', handler: () => void): void;
          addEventListener(type: 'error', handler: (e: Event) => void): void;
          removeEventListener(type: 'reading', handler: () => void): void;
          removeEventListener(type: 'error', handler: (e: Event) => void): void;
          start(): void;
          stop(): void;
        }
        
        interface AccelerometerConstructor {
          new (options?: { frequency?: number }): AccelerometerSensor;
        }
        
        const Accelerometer = (window as unknown as { Accelerometer: AccelerometerConstructor }).Accelerometer;
        const sensor = new Accelerometer({ frequency: 60 });
        
        const readingHandler = () => {
          setData({
            x: sensor.x ?? 0,
            y: sensor.y ?? 0,
            z: sensor.z ?? 0,
            timestamp: Date.now(),
          });
        };

        interface SensorErrorEvent extends Event {
          error?: DOMException;
        }

        const errorHandler = (e: Event) => {
          const errorEvent = e as SensorErrorEvent;
          if (errorEvent.error?.name === 'NotAllowedError') {
            setError('Permission denied. Please allow motion sensor access.');
          } else {
            setError(`Sensor error: ${errorEvent.error?.message || 'Unknown error'}`);
          }
        };

        sensor.addEventListener('reading', readingHandler);
        sensor.addEventListener('error', errorHandler);
        sensor.start();

        return () => {
          sensor.removeEventListener('reading', readingHandler);
          sensor.removeEventListener('error', errorHandler);
          sensor.stop();
        };
      } catch {
        // Fall through to DeviceMotionEvent
      }
    }

    // Fallback to DeviceMotionEvent (iOS Safari/Chrome)
    if (deviceMotionSupported) {
      const handleDeviceMotion = (e: DeviceMotionEvent) => {
        if (e.accelerationIncludingGravity) {
          const acc = e.accelerationIncludingGravity;
          setData({
            x: acc.x ?? 0,
            y: acc.y ?? 0,
            z: acc.z ?? 0,
            timestamp: Date.now(),
          });
          setError(null);
        }
      };

      eventHandlerRef.current = handleDeviceMotion;
      
      // On iOS 13+, permission must be requested via user gesture
      // So we don't request it here, just set up the handler
      if (typeof window.DeviceMotionEvent?.requestPermission === 'function') {
        // iOS 13+ - need user gesture to request permission
        setTimeout(() => setNeedsPermission(true), 0);
      } else {
        // Android or older iOS - just listen directly
        window.addEventListener('devicemotion', handleDeviceMotion);
      }

      return () => {
        if (eventHandlerRef.current) {
          window.removeEventListener('devicemotion', eventHandlerRef.current);
        }
      };
    }
  }, []);

  const requestPermission = () => {
    if (typeof window.DeviceMotionEvent?.requestPermission === 'function') {
      window.DeviceMotionEvent.requestPermission()
        .then((response) => {
          if (response === 'granted') {
            setNeedsPermission(false);
            setError(null);
            // The event listener is already set up, it will start working now
            if (eventHandlerRef.current) {
              window.addEventListener('devicemotion', eventHandlerRef.current);
            }
          } else {
            setError('Motion permission denied.');
          }
        })
        .catch(() => {
          setError('Failed to request motion permission.');
        });
    }
  };

  return { data, error, isSupported, needsPermission, requestPermission };
}

