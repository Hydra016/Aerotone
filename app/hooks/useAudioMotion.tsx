'use client';
import { useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import { AccelerometerData } from './useAccelerometer';

interface AudioMotionOptions {
  enabled?: boolean;
  baseFrequency?: number; // Base frequency in Hz
  frequencyRange?: number; // Range of frequency variation
  volume?: number; // Volume (0-1)
}

export function useAudioMotion(
  data: AccelerometerData | null,
  options: AudioMotionOptions = {}
) {
  const {
    enabled = true,
    baseFrequency = 220, // A3 note
    frequencyRange = 440, // Range from baseFrequency to baseFrequency + range
    volume = 0.3,
  } = options;

  const [isPlaying, setIsPlaying] = useState(false);
  const [audioContextStarted, setAudioContextStarted] = useState(false);
  
  const synthRef = useRef<Tone.Synth | null>(null);
  const gainNodeRef = useRef<Tone.Gain | null>(null);
  const prevDataRef = useRef<AccelerometerData | null>(null);
  const velocityRef = useRef({ x: 0, y: 0, z: 0 });

  // Initialize audio
  useEffect(() => {
    if (!enabled) return;

    // Create synthesizer with a nice tone
    const synth = new Tone.Synth({
      oscillator: {
        type: 'sine', // Smooth sine wave
      },
      envelope: {
        attack: 0.01,
        decay: 0.1,
        sustain: 0.3,
        release: 0.3,
      },
    });

    // Create gain node for volume control
    const gainNode = new Tone.Gain(volume);
    synth.connect(gainNode);
    gainNode.toDestination();

    synthRef.current = synth;
    gainNodeRef.current = gainNode;

    return () => {
      synth.dispose();
      gainNode.dispose();
    };
  }, [enabled, volume]);

  // Start audio context on user interaction
  const startAudio = async () => {
    if (audioContextStarted) return;
    
    try {
      await Tone.start();
      setAudioContextStarted(true);
      setIsPlaying(true);
    } catch (err) {
      console.error('Failed to start audio context:', err);
    }
  };

  // Start/stop continuous sound
  useEffect(() => {
    if (!enabled || !synthRef.current || !audioContextStarted) {
      if (synthRef.current) {
        synthRef.current.triggerRelease();
      }
      return;
    }

    const synth = synthRef.current;
    
    // Start continuous sound
    synth.triggerAttack(baseFrequency);

    return () => {
      synth.triggerRelease();
    };
  }, [enabled, audioContextStarted, baseFrequency]);

  // Update sound based on accelerometer data
  useEffect(() => {
    if (!enabled || !data || !synthRef.current || !audioContextStarted) return;

    const synth = synthRef.current;
    const gainNode = gainNodeRef.current;
    const prev = prevDataRef.current;

    if (prev) {
      // Calculate velocity (change in acceleration over time)
      const dt = (data.timestamp - prev.timestamp) / 1000; // Convert to seconds
      if (dt > 0 && dt < 1) { // Only update if reasonable time difference
        velocityRef.current = {
          x: (data.x - prev.x) / dt,
          y: (data.y - prev.y) / dt,
          z: (data.z - prev.z) / dt,
        };
      }
    }

    // Calculate speed magnitude
    const speed = Math.sqrt(
      velocityRef.current.x ** 2 +
      velocityRef.current.y ** 2 +
      velocityRef.current.z ** 2
    );

    // Map upward movement (positive Y) to higher frequency
    // Y-axis: positive = up, negative = down
    // DeviceMotionEvent gives acceleration including gravity
    // When device is flat, Y is around -9.8 (gravity down)
    // When tilted up, Y becomes less negative or positive
    const yAccel = data.y;
    
    // Normalize Y acceleration to frequency range
    // Assuming accelerometer range is roughly -15 to 15 m/s²
    // Map to frequency: lower Y (down) = lower freq, higher Y (up) = higher freq
    const yNormalized = Math.max(-1, Math.min(1, (yAccel + 9.8) / 10)); // Center around gravity
    const frequencyOffset = yNormalized * frequencyRange;
    const frequency = Math.max(50, Math.min(2000, baseFrequency + frequencyOffset)); // Clamp to reasonable range

    // Map speed to volume (faster movement = louder)
    // Speed is typically 0-50 m/s², normalize to 0-1
    const speedNormalized = Math.min(1, speed / 30);
    const dynamicVolume = volume * (0.2 + speedNormalized * 0.8); // Volume between 20% and 100% of base

    // Smoothly update frequency and volume
    // Tone.js Synth uses oscillator.frequency
    if (synth.oscillator && synth.oscillator.frequency) {
      synth.oscillator.frequency.rampTo(frequency, 0.1); // Smooth frequency change over 100ms
    }
    
    if (gainNode) {
      gainNode.volume.rampTo(Tone.gainToDb(dynamicVolume), 0.1); // Smooth volume change
    }

    prevDataRef.current = data;
  }, [data, enabled, audioContextStarted, baseFrequency, frequencyRange, volume]);

  return {
    isPlaying,
    audioContextStarted,
    startAudio,
    stop: () => {
      if (synthRef.current) {
        synthRef.current.triggerRelease();
      }
      setIsPlaying(false);
    },
  };
}

