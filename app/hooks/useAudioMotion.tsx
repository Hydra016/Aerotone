'use client';
import { useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import { AccelerometerData } from './useAccelerometer';

export type InstrumentType = 
  | 'sine'
  | 'square'
  | 'sawtooth'
  | 'triangle'
  | 'fm'
  | 'am'
  | 'mono'
  | 'duo'
  | 'pluck';

interface AudioMotionOptions {
  enabled?: boolean;
  instrument?: InstrumentType;
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
    instrument = 'sine',
    baseFrequency = 220, // A3 note
    frequencyRange = 440, // Range from baseFrequency to baseFrequency + range
    volume = 0.3,
  } = options;

  const [isPlaying, setIsPlaying] = useState(false);
  const [audioContextStarted, setAudioContextStarted] = useState(false);
  
  const synthRef = useRef<Tone.ToneAudioNode | null>(null);
  const volumeNodeRef = useRef<Tone.Volume | null>(null);
  const reverbRef = useRef<Tone.Reverb | null>(null);
  const delayRef = useRef<Tone.FeedbackDelay | null>(null);
  const prevDataRef = useRef<AccelerometerData | null>(null);
  const velocityRef = useRef({ x: 0, y: 0, z: 0 });

  // Create instrument based on type
  const createInstrument = (type: InstrumentType): Tone.ToneAudioNode => {
    switch (type) {
      case 'sine':
        return new Tone.Synth({
          oscillator: { type: 'sine' },
          envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.3 },
        });
      
      case 'square':
        return new Tone.Synth({
          oscillator: { type: 'square' },
          envelope: { attack: 0.01, decay: 0.1, sustain: 0.4, release: 0.2 },
        });
      
      case 'sawtooth':
        return new Tone.Synth({
          oscillator: { type: 'sawtooth' },
          envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.3 },
        });
      
      case 'triangle':
        return new Tone.Synth({
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.4 },
        });
      
      case 'fm':
        return new Tone.FMSynth({
          harmonicity: 3,
          modulationIndex: 10,
          detune: 0,
          oscillator: { type: 'sine' },
          envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.3 },
          modulation: { type: 'square' },
          modulationEnvelope: { attack: 0.5, decay: 0.01, sustain: 1, release: 0.5 },
        });
      
      case 'am':
        return new Tone.AMSynth({
          harmonicity: 3,
          detune: 0,
          oscillator: { type: 'sine' },
          envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.3 },
          modulation: { type: 'triangle' },
          modulationEnvelope: { attack: 0.5, decay: 0.01, sustain: 1, release: 0.5 },
        });
      
      case 'mono':
        return new Tone.MonoSynth({
          oscillator: { type: 'sawtooth' },
          envelope: { attack: 0.1, decay: 0.3, sustain: 0.4, release: 0.8 },
          filter: { Q: 2, frequency: 2000 },
          filterEnvelope: { attack: 0.3, decay: 0.2, sustain: 0.5, release: 0.8 },
        });
      
      case 'duo':
        return new Tone.DuoSynth({
          voice0: {
            oscillator: { type: 'sawtooth' },
            envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.3 },
            filterEnvelope: { attack: 0.05, decay: 0.1, sustain: 0.3, release: 0.3 },
          },
          voice1: {
            oscillator: { type: 'sawtooth' },
            envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.3 },
            filterEnvelope: { attack: 0.05, decay: 0.1, sustain: 0.3, release: 0.3 },
          },
          vibratoAmount: 0.5,
          vibratoRate: 5,
        });
      
      case 'pluck':
        return new Tone.PluckSynth({
          attackNoise: 1,
          dampening: 4000,
          resonance: 0.7,
        });
      
      default:
        return new Tone.Synth({
          oscillator: { type: 'sine' },
          envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.3 },
        });
    }
  };

  // Initialize audio
  useEffect(() => {
    if (!enabled) return;

    // Create instrument
    const synth = createInstrument(instrument);

    // Create effects
    const reverb = new Tone.Reverb(1.5); // Decay time in seconds
    reverb.wet.value = 0.3; // Set wet/dry mix
    reverb.generate();

    const delay = new Tone.FeedbackDelay({
      delayTime: '8n',
      feedback: 0.2,
      wet: 0.2,
    });

    // Create volume node for volume control (in dB)
    const volumeNode = new Tone.Volume(Tone.gainToDb(volume));

    // Connect: synth -> delay -> reverb -> volume -> destination
    synth.connect(delay);
    delay.connect(reverb);
    reverb.connect(volumeNode);
    volumeNode.toDestination();

    synthRef.current = synth;
    volumeNodeRef.current = volumeNode;
    reverbRef.current = reverb;
    delayRef.current = delay;

    return () => {
      synth.dispose();
      volumeNode.dispose();
      reverb.dispose();
      delay.dispose();
    };
  }, [enabled, volume, instrument]);

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
      if (synthRef.current && 'triggerRelease' in synthRef.current) {
        (synthRef.current as any).triggerRelease();
      }
      return;
    }

    const synth = synthRef.current;
    
    // Start continuous sound (different methods for different synths)
    if ('triggerAttack' in synth) {
      (synth as any).triggerAttack(baseFrequency);
    }

    return () => {
      if ('triggerRelease' in synth) {
        (synth as any).triggerRelease();
      }
    };
  }, [enabled, audioContextStarted, baseFrequency]);

  // Update sound based on accelerometer data
  useEffect(() => {
    if (!enabled || !data || !synthRef.current || !audioContextStarted) return;

    const synth = synthRef.current;
    const volumeNode = volumeNodeRef.current;
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
    // Different synths have different frequency control paths
    if ('oscillator' in synth && synth.oscillator && 'frequency' in synth.oscillator) {
      (synth.oscillator as any).frequency.rampTo(frequency, 0.1);
    } else if ('frequency' in synth) {
      (synth as any).frequency.rampTo(frequency, 0.1);
    }
    
    if (volumeNode) {
      volumeNode.volume.rampTo(Tone.gainToDb(dynamicVolume), 0.1); // Smooth volume change in dB
    }

    prevDataRef.current = data;
  }, [data, enabled, audioContextStarted, baseFrequency, frequencyRange, volume]);

  return {
    isPlaying,
    audioContextStarted,
    startAudio,
    stop: () => {
      if (synthRef.current && 'triggerRelease' in synthRef.current) {
        (synthRef.current as any).triggerRelease();
      }
      setIsPlaying(false);
    },
  };
}

