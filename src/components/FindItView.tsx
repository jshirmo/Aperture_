import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Compass,
  Volume2,
  RefreshCw,
  AlertTriangle,
  Sliders,
  HelpCircle,
  Check,
  Target,
  RotateCcw,
  Navigation,
  Eye,
  Sparkles,
  X,
} from 'lucide-react';
import { FindResult, UserSettings } from '../types';
import { speech } from '../services/speechService';
import { haptic } from '../services/hapticService';
import { apiService } from '../services/apiService';
import { storageService } from '../services/storageService';

interface FindItViewProps {
  initialTarget?: string;
  onBack: () => void;
  settings: UserSettings;
}

export const FindItView: React.FC<FindItViewProps> = ({
  initialTarget = '',
  onBack,
}) => {
  const [target, setTarget] = useState(initialTarget);
  const [isCustomTarget, setIsCustomTarget] = useState(false);
  const [customInput, setCustomInput] = useState(initialTarget);

  // Camera state
  const [isScanning, setIsScanning] = useState(false);
  const [isContinuous, setIsContinuous] = useState(false); // Default to on-demand prompted scans
  const lastApiCallTimeRef = useRef<number>(0);
  const scanStepRef = useRef<number>(0);

  // Direction Calibration state
  const [headingOffsetDeg, setHeadingOffsetDeg] = useState<number>(0); // -45 deg to +45 deg offset
  const [useDeviceCompass, setUseDeviceCompass] = useState<boolean>(false);
  const [deviceHeadingOffset, setDeviceHeadingOffset] = useState<number>(0);
  const [showCalibrationPanel, setShowCalibrationPanel] = useState<boolean>(false);

  // Distance Gauge state
  const [distanceUnit, setDistanceUnit] = useState<'ft' | 'm'>('ft');
  const [calibrationScale, setCalibrationScale] = useState<number>(1.0); // 0.5x to 1.8x multiplier

  // Analysis Result
  const [guidance, setGuidance] = useState<FindResult | null>(null);
  const [lastInstruction, setLastInstruction] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const continuousTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Device orientation tracking when compass toggle is on
  useEffect(() => {
    if (!useDeviceCompass || typeof window === 'undefined') return;

    let initialAlpha: number | null = null;
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.alpha !== null) {
        if (initialAlpha === null) {
          initialAlpha = e.alpha;
        }
        // Relative heading change from orientation when activated
        const delta = Math.round((e.alpha - initialAlpha + 360) % 360);
        setDeviceHeadingOffset(delta);
      }
    };

    window.addEventListener('deviceorientation', handleOrientation);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [useDeviceCompass]);

  // Initialize camera
  useEffect(() => {
    let active = true;

    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (err: any) {
        console.warn('Camera access unavailable:', err);
      }
    }

    setupCamera();

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (continuousTimerRef.current) {
        clearInterval(continuousTimerRef.current);
      }
    };
  }, []);

  // Wait for camera video to produce active frames
  const waitForCameraReady = async (maxWaitMs = 1500): Promise<boolean> => {
    const video = videoRef.current;
    if (!video) return false;
    if (video.videoWidth > 0 && video.readyState >= 2) return true;

    return new Promise<boolean>((resolve) => {
      let resolved = false;
      const finish = (ready: boolean) => {
        if (!resolved) {
          resolved = true;
          video.removeEventListener('loadeddata', onReady);
          video.removeEventListener('timeupdate', onReady);
          resolve(ready);
        }
      };
      const onReady = () => {
        if (video.videoWidth > 0) {
          finish(true);
        }
      };

      video.addEventListener('loadeddata', onReady);
      video.addEventListener('timeupdate', onReady);
      setTimeout(() => finish(video.videoWidth > 0), maxWaitMs);
    });
  };

  // Capture frame optimized for fast AI transmission (480x360 at 0.65 JPEG)
  const captureFrameBase64 = async (): Promise<string> => {
    const video = videoRef.current;
    if (!video) return '';

    if (video.videoWidth === 0 || video.readyState < 2) {
      await waitForCameraReady(1500);
    }

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      return '';
    }

    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = Math.min(video.videoWidth, 640);
    canvas.height = Math.round((canvas.width * video.videoHeight) / video.videoWidth);
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.65);
  };

  // Perform Real AI Vision Analysis with Gemini Flash Lite model
  const performScan = async (forceApi = false, overrideTarget?: string) => {
    const activeTarget = (overrideTarget || target).trim();
    if (!activeTarget) {
      speech.speak('Please speak or type the item you want to find.', 'immediate');
      return;
    }

    if (isScanning) return;
    setIsScanning(true);

    const now = Date.now();
    lastApiCallTimeRef.current = now;

    try {
      const frameData = await captureFrameBase64();
      if (!frameData) {
        speech.speak('Camera is starting. Please tap Scan Now in a moment.', 'immediate');
        setIsScanning(false);
        return;
      }

      const result: FindResult = await apiService.findObject(frameData, activeTarget, guidance?.direction);

      setGuidance(result);

      if (result.targetDetected) {
        if (result.isImmediateObstacle) {
          speech.playChime('hazard');
          haptic.hazardAlert();
        } else if (result.isCentered) {
          speech.playChime('aligned');
          haptic.targetCentered();
        } else {
          speech.playChime('ping');
          haptic.targetDetected();
        }

        if (result.distance && (result.distance.includes('1 foot') || result.distance.includes('2 feet'))) {
          speech.playChime('proximity');
        }

        // Speak guidance instruction once cleanly
        setLastInstruction(result.actionInstruction);
        speech.speak(result.actionInstruction, 'immediate');
      } else {
        const notFoundText = result.actionInstruction || `${activeTarget} is not visible yet. Keep camera pointed forward and pan slowly.`;
        setLastInstruction(notFoundText);
        speech.speak(notFoundText, 'immediate');
      }
    } catch (err: any) {
      console.warn('Scan handled gracefully:', err);
    } finally {
      setIsScanning(false);
    }
  };

  // Only run continuous loop if the user explicitly enabled the Live Stream toggle
  useEffect(() => {
    if (!isContinuous) {
      if (continuousTimerRef.current) {
        clearInterval(continuousTimerRef.current);
        continuousTimerRef.current = null;
      }
      return;
    }

    continuousTimerRef.current = setInterval(() => {
      performScan(false);
    }, 2000);

    return () => {
      if (continuousTimerRef.current) {
        clearInterval(continuousTimerRef.current);
        continuousTimerRef.current = null;
      }
    };
  }, [target, isContinuous]);

  // Keep target in sync if initialTarget changes
  useEffect(() => {
    const clean = initialTarget ? initialTarget.trim() : '';
    setTarget(clean);
    setCustomInput(clean);
    setGuidance(null);
    setLastInstruction('');
  }, [initialTarget]);

  const selectQuickTarget = (newTarget: string) => {
    haptic.tapFeedback();
    const clean = newTarget.trim();
    if (!clean) return;
    setTarget(clean);
    setCustomInput(clean);
    setIsCustomTarget(false);
    setGuidance(null);
    setLastInstruction('');
    speech.speak(`Searching for ${clean}.`, 'immediate', false, () => {
      performScan(true, clean);
    });
  };

  const handleClearTarget = () => {
    haptic.tapFeedback();
    setTarget('');
    setCustomInput('');
    setGuidance(null);
    setLastInstruction('');
    speech.speak('Target cleared. Type an item to find.', 'immediate');
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim()) return;
    haptic.tapFeedback();
    selectQuickTarget(customInput.trim());
  };

  const repeatGuidance = () => {
    haptic.tapFeedback();
    if (guidance?.actionInstruction) {
      speech.speak(guidance.actionInstruction, 'immediate', true);
    } else if (target) {
      speech.speak(`${target} is not visible yet. Keep camera pointed forward and pan slowly.`, 'immediate', true);
    } else {
      speech.speak('Please speak or type the item you want to find.', 'immediate', true);
    }
  };

  // -------------------------------------------------------------
  // Calibrated Direction Calculation
  // Synchronizes clock-face bearing, needle pointer, and compass angle
  // -------------------------------------------------------------
  const getCalculatedBearing = (): {
    angleDeg: number;
    isCentered: boolean;
    clockHourText: string;
    description: string;
  } => {
    if (!guidance?.targetDetected) {
      return {
        angleDeg: (headingOffsetDeg + (useDeviceCompass ? deviceHeadingOffset : 0) + 360) % 360,
        isCentered: false,
        clockHourText: 'SEARCHING',
        description: 'Point camera slowly across the room',
      };
    }

    const dirStr = guidance.direction || '';
    const match = dirStr.match(/(\d+)\s*o'clock/i);
    let baseHourDeg = 0;

    if (match) {
      const hour = parseInt(match[1], 10);
      baseHourDeg = (hour % 12) * 30; // 12 -> 0, 1 -> 30, 2 -> 60, etc.
    } else if (dirStr.toLowerCase().includes('ahead') || dirStr.toLowerCase().includes('center')) {
      baseHourDeg = 0;
    } else if (dirStr.toLowerCase().includes('right')) {
      baseHourDeg = 45;
    } else if (dirStr.toLowerCase().includes('left')) {
      baseHourDeg = 315;
    }

    // Apply user calibration offset and optional device gyro/compass
    const totalOffset = headingOffsetDeg + (useDeviceCompass ? deviceHeadingOffset : 0);
    const angleDeg = (baseHourDeg + totalOffset + 360) % 360;

    // Centered if within +-15 degrees of 0 (12 o'clock)
    const isCentered = angleDeg <= 15 || angleDeg >= 345;

    // Normalized clock hour label
    const closestHour = Math.round(angleDeg / 30) % 12 || 12;
    const clockHourText = isCentered ? "12 O'CLOCK (AHEAD)" : `${closestHour} O'CLOCK`;

    let description = 'Directly ahead';
    if (!isCentered) {
      if (angleDeg > 0 && angleDeg < 180) {
        description = `${Math.round(angleDeg)}° to your right`;
      } else {
        description = `${Math.round(360 - angleDeg)}° to your left`;
      }
    }

    return {
      angleDeg,
      isCentered,
      clockHourText,
      description,
    };
  };

  // -------------------------------------------------------------
  // Calibrated Distance Gauge Calculation
  // Extracts physical distance from units, applies tuning multiplier,
  // and categorizes into 4 calibrated tactile zones
  // -------------------------------------------------------------
  const getCalibratedDistance = (): {
    hasTarget: boolean;
    feet: number | null;
    meters: number | null;
    proximityPercent: number;
    zoneKey: 'reach' | 'close' | 'mid' | 'far' | 'searching';
    zoneBadge: string;
    zoneColorClass: string;
    spokenSummary: string;
  } => {
    if (!guidance?.targetDetected) {
      return {
        hasTarget: false,
        feet: null,
        meters: null,
        proximityPercent: 0,
        zoneKey: 'searching',
        zoneBadge: target ? 'SEEKING TARGET' : 'NO ITEM SELECTED',
        zoneColorClass: 'text-zinc-400 border-zinc-700 bg-zinc-800/80',
        spokenSummary: target
          ? `Distance unknown. Searching for ${target}.`
          : 'No item selected. Please speak or type what to find.',
      };
    }

    let rawFeet: number | null = null;
    const distStr = (guidance.distance || '').toLowerCase();

    // Check for arm's reach keywords
    if (
      distStr.includes('reach') ||
      distStr.includes('touch') ||
      distStr.includes('arm') ||
      distStr.includes('front of you') ||
      distStr.includes('reached')
    ) {
      rawFeet = 1.0;
    } else {
      // Check meters (1m ~ 3.28ft)
      const metersMatch = distStr.match(/(\d+(\.\d+)?)\s*(m|meter|meters)\b/);
      if (metersMatch) {
        rawFeet = parseFloat(metersMatch[1]) * 3.28084;
      } else {
        // Check inches (12in = 1ft)
        const inchesMatch = distStr.match(/(\d+(\.\d+)?)\s*(in|inch|inches)\b/);
        if (inchesMatch) {
          rawFeet = parseFloat(inchesMatch[1]) / 12;
        } else {
          // Check steps (1 step ~ 2.5ft)
          const stepsMatch = distStr.match(/(\d+(\.\d+)?)\s*(step|steps)\b/);
          if (stepsMatch) {
            rawFeet = parseFloat(stepsMatch[1]) * 2.5;
          } else {
            // Standard feet match
            const feetMatch = distStr.match(/(\d+(\.\d+)?)/);
            if (feetMatch) {
              rawFeet = parseFloat(feetMatch[1]);
            }
          }
        }
      }
    }

    // Fallback: estimate from bounding box height if available
    if (rawFeet === null && guidance.box) {
      const h = Math.max(10, Math.min(80, guidance.box.height));
      rawFeet = Math.max(1.0, 160 / h);
    }

    if (rawFeet === null) {
      rawFeet = 5.0;
    }

    // Apply user calibration multiplier (0.5x to 1.8x)
    const calibratedFeet = Math.max(0.5, Math.round(rawFeet * calibrationScale * 10) / 10);
    const meters = Math.round(calibratedFeet * 0.3048 * 10) / 10;

    // Proximity 0 to 100% (100% = reached <= 1ft, 0% = 14+ ft)
    const proximityPercent = Math.max(4, Math.min(100, Math.round(((14 - calibratedFeet) / 13) * 100)));

    let zoneKey: 'reach' | 'close' | 'mid' | 'far' = 'far';
    let zoneBadge = 'FAR ZONE (> 10 FT)';
    let zoneColorClass = 'text-purple-400 border-purple-500/40 bg-purple-950/40';
    let zoneSpoken = 'Far, across the room';

    if (calibratedFeet <= 2.5) {
      zoneKey = 'reach';
      zoneBadge = 'WITHIN ARM’S REACH (< 2.5 FT)';
      zoneColorClass = 'text-emerald-400 border-emerald-400/60 bg-emerald-950/40';
      zoneSpoken = 'Within arm’s reach';
    } else if (calibratedFeet <= 5.5) {
      zoneKey = 'close';
      zoneBadge = 'CLOSE (1–2 STEPS / 2.5–5.5 FT)';
      zoneColorClass = 'text-yellow-400 border-yellow-400/60 bg-yellow-950/40';
      zoneSpoken = 'Close, one to two steps ahead';
    } else if (calibratedFeet <= 10.0) {
      zoneKey = 'mid';
      zoneBadge = 'APPROACHING (5.5–10 FT)';
      zoneColorClass = 'text-sky-400 border-sky-400/60 bg-sky-950/40';
      zoneSpoken = 'Approaching, about walking distance';
    }

    const spokenSummary = `${calibratedFeet} feet away. ${zoneSpoken}.`;

    return {
      hasTarget: true,
      feet: calibratedFeet,
      meters,
      proximityPercent,
      zoneKey,
      zoneBadge,
      zoneColorClass,
      spokenSummary,
    };
  };

  const { angleDeg, isCentered, clockHourText, description: bearingDesc } = getCalculatedBearing();
  const distanceInfo = getCalibratedDistance();

  // Spoken distance readout
  const speakDistance = () => {
    haptic.tapFeedback();
    if (distanceInfo.hasTarget) {
      const readout =
        distanceUnit === 'ft'
          ? `Distance to ${target}: ${distanceInfo.feet} feet. ${distanceInfo.zoneBadge}.`
          : `Distance to ${target}: ${distanceInfo.meters} meters. ${distanceInfo.zoneBadge}.`;
      speech.speak(readout, 'immediate', true);
    } else {
      speech.speak(`Searching for ${target}. Distance currently unknown.`, 'immediate', true);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-4 space-y-4">
      {/* Top Header Row with Navigation and Calibration Toggle */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => {
            haptic.tapFeedback();
            onBack();
          }}
          className="flex min-h-[48px] items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-2 font-bold text-zinc-200 hover:bg-zinc-800 hover:text-white focus-visible:ring-2 focus-visible:ring-yellow-400"
          aria-label="Back to home screen"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Calibration Panel Toggle */}
          <button
            onClick={() => {
              haptic.tapFeedback();
              setShowCalibrationPanel(!showCalibrationPanel);
            }}
            className={`flex min-h-[48px] min-w-[48px] items-center justify-center rounded-2xl border transition-all ${
              showCalibrationPanel
                ? 'border-yellow-400 bg-yellow-400 text-zinc-950 font-black'
                : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white'
            }`}
            aria-label="Calibrate distance and direction"
            title="Calibrate Distance & Direction"
          >
            <Sliders className="h-5 w-5" />
          </button>

          <div className="text-right pl-1">
            <p className="text-[10px] uppercase font-extrabold tracking-wider text-yellow-400">Seeking</p>
            <p className="text-base font-black text-white capitalize leading-tight max-w-[130px] truncate">{target || 'None'}</p>
          </div>
        </div>
      </div>

      {/* Calibration Controls Panel (Interactive Collapsible Drawer) */}
      {showCalibrationPanel && (
        <section
          role="region"
          aria-label="Direction and Distance Calibration Panel"
          className="rounded-3xl border-2 border-yellow-400 bg-zinc-900 p-4 space-y-4 shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <h3 className="text-sm font-black uppercase tracking-wider text-yellow-400 flex items-center gap-2">
              <Target className="h-4 w-4" />
              Sensor Calibration &amp; Tuning
            </h3>
            <button
              onClick={() => {
                setCalibrationScale(1.0);
                setHeadingOffsetDeg(0);
                setDeviceHeadingOffset(0);
                speech.speak('Calibration reset to default settings', 'immediate', true);
              }}
              className="text-xs font-bold text-zinc-400 hover:text-white flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset Defaults</span>
            </button>
          </div>

          {/* Section 1: Direction Calibration */}
          <div className="space-y-3 rounded-2xl bg-zinc-950/70 p-3 border border-zinc-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wide text-zinc-200 flex items-center gap-1.5">
                <Compass className="h-3.5 w-3.5 text-yellow-400" />
                Direction Calibration ({headingOffsetDeg > 0 ? `+${headingOffsetDeg}` : headingOffsetDeg}°)
              </span>
              <span className="text-xs font-bold text-yellow-400">
                {headingOffsetDeg === 0 ? 'Aligned Straight (0°)' : headingOffsetDeg > 0 ? `${headingOffsetDeg}° Right Offset` : `${Math.abs(headingOffsetDeg)}° Left Offset`}
              </span>
            </div>

            {/* Nudge Buttons */}
            <div className="grid grid-cols-5 gap-1.5 text-xs font-bold">
              <button
                onClick={() => {
                  setHeadingOffsetDeg((prev) => Math.max(-45, prev - 15));
                  speech.speak('Offset adjusted 15 degrees left', 'immediate', true);
                }}
                className="min-h-[38px] rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
              >
                -15°
              </button>
              <button
                onClick={() => {
                  setHeadingOffsetDeg((prev) => Math.max(-45, prev - 5));
                  speech.speak('Offset adjusted 5 degrees left', 'immediate', true);
                }}
                className="min-h-[38px] rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
              >
                -5°
              </button>
              <button
                onClick={() => {
                  setHeadingOffsetDeg(0);
                  speech.speak('Center direction zeroed straight forward', 'immediate', true);
                }}
                className="min-h-[38px] rounded-lg bg-yellow-400 font-black text-zinc-950 hover:bg-yellow-300"
              >
                Zero (0°)
              </button>
              <button
                onClick={() => {
                  setHeadingOffsetDeg((prev) => Math.min(45, prev + 5));
                  speech.speak('Offset adjusted 5 degrees right', 'immediate', true);
                }}
                className="min-h-[38px] rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
              >
                +5°
              </button>
              <button
                onClick={() => {
                  setHeadingOffsetDeg((prev) => Math.min(45, prev + 15));
                  speech.speak('Offset adjusted 15 degrees right', 'immediate', true);
                }}
                className="min-h-[38px] rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
              >
                +15°
              </button>
            </div>

            {/* Slider */}
            <input
              type="range"
              min="-45"
              max="45"
              step="5"
              value={headingOffsetDeg}
              onChange={(e) => setHeadingOffsetDeg(parseInt(e.target.value, 10))}
              className="w-full accent-yellow-400 h-2 bg-zinc-800 rounded-lg cursor-pointer"
              aria-label="Direction heading calibration slider"
            />

            {/* Phone Compass / Gyroscope toggle */}
            <label className="flex items-center justify-between text-xs font-semibold text-zinc-300 pt-1 cursor-pointer">
              <span className="flex items-center gap-1.5">
                <Navigation className="h-3.5 w-3.5 text-sky-400" />
                Track Phone Gyroscope / Device Heading
              </span>
              <input
                type="checkbox"
                checked={useDeviceCompass}
                onChange={(e) => {
                  setUseDeviceCompass(e.target.checked);
                  speech.speak(
                    e.target.checked ? 'Device gyroscope heading enabled' : 'Device gyroscope disabled',
                    'immediate',
                    true
                  );
                }}
                className="h-4 w-4 rounded accent-yellow-400"
              />
            </label>
          </div>

          {/* Section 2: Distance Gauge Calibration */}
          <div className="space-y-3 rounded-2xl bg-zinc-950/70 p-3 border border-zinc-800">
            <div className="flex items-center justify-between text-xs">
              <span className="font-extrabold uppercase tracking-wide text-zinc-200">
                Distance Gauge Tuning ({Math.round(calibrationScale * 100)}%)
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setDistanceUnit('ft')}
                  className={`px-2 py-0.5 rounded font-bold ${distanceUnit === 'ft' ? 'bg-yellow-400 text-zinc-950' : 'text-zinc-400 hover:text-white'}`}
                >
                  Feet
                </button>
                <span className="text-zinc-600">|</span>
                <button
                  onClick={() => setDistanceUnit('m')}
                  className={`px-2 py-0.5 rounded font-bold ${distanceUnit === 'm' ? 'bg-yellow-400 text-zinc-950' : 'text-zinc-400 hover:text-white'}`}
                >
                  Meters
                </button>
              </div>
            </div>

            {/* 1-Tap Quick Distance Presets */}
            <div className="grid grid-cols-3 gap-2 text-xs font-bold">
              <button
                onClick={() => {
                  setCalibrationScale(0.7);
                  speech.speak('Distance scale set to close tabletop range', 'immediate', true);
                }}
                className={`min-h-[36px] rounded-lg border p-1 ${
                  calibrationScale === 0.7
                    ? 'border-yellow-400 bg-yellow-400/20 text-yellow-300 font-extrabold'
                    : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                Close (0.7x)
              </button>
              <button
                onClick={() => {
                  setCalibrationScale(1.0);
                  speech.speak('Distance scale set to standard room range', 'immediate', true);
                }}
                className={`min-h-[36px] rounded-lg border p-1 ${
                  calibrationScale === 1.0
                    ? 'border-yellow-400 bg-yellow-400/20 text-yellow-300 font-extrabold'
                    : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                Standard (1.0x)
              </button>
              <button
                onClick={() => {
                  setCalibrationScale(1.3);
                  speech.speak('Distance scale set to wide hallway range', 'immediate', true);
                }}
                className={`min-h-[36px] rounded-lg border p-1 ${
                  calibrationScale === 1.3
                    ? 'border-yellow-400 bg-yellow-400/20 text-yellow-300 font-extrabold'
                    : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                Hallway (1.3x)
              </button>
            </div>

            {/* Fine Scale Slider */}
            <div className="pt-1">
              <div className="flex justify-between text-[11px] font-bold text-zinc-400 mb-1">
                <span>0.5x (Closer)</span>
                <span className="text-yellow-400 font-extrabold">{Math.round(calibrationScale * 100)}% scale</span>
                <span>1.8x (Wider)</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="1.8"
                step="0.05"
                value={calibrationScale}
                onChange={(e) => setCalibrationScale(parseFloat(e.target.value))}
                className="w-full accent-yellow-400 h-2 bg-zinc-800 rounded-lg cursor-pointer"
                aria-label="Distance tuning scale slider"
              />
            </div>
          </div>
        </section>
      )}

      {/* Search Target Input Box */}
      <form
        onSubmit={handleCustomSubmit}
        className="flex items-center gap-2"
        role="search"
        aria-label="Object search target input"
      >
        <div className="relative flex-1">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder="Type item to find (e.g. keys, water bottle, door)"
            className="w-full min-h-[58px] rounded-2xl border-3 border-yellow-400 bg-zinc-950 px-4 pr-12 text-base sm:text-lg font-bold text-white placeholder-zinc-500 shadow-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400"
            aria-label="Type what you want to find"
          />
          {customInput && (
            <button
              type="button"
              onClick={handleClearTarget}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-zinc-400 hover:text-white"
              aria-label="Clear target input"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={!customInput.trim()}
          className="min-h-[58px] rounded-2xl bg-yellow-400 px-6 font-black text-zinc-950 text-base sm:text-lg hover:bg-yellow-300 active:scale-95 transition-all shadow-xl disabled:opacity-40"
          aria-label="Search for this item"
        >
          Find
        </button>
      </form>

      {/* Target Status Card */}
      <div className="p-4 rounded-2xl bg-zinc-900 border-2 border-zinc-800 flex items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-yellow-400">
            <Compass className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-yellow-400">Target Object</p>
            <p className="text-lg font-black text-white capitalize leading-tight">
              {target || 'None chosen (Type above)'}
            </p>
          </div>
        </div>

        {target && (
          <button
            onClick={handleClearTarget}
            className="px-3.5 py-2 rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition-all"
            aria-label="Clear current target"
          >
            Clear
          </button>
        )}
      </div>

      {/* Viewfinder / Camera Reticle Box */}
      <div
        onClick={() => {
          if (target && target.trim()) {
            performScan(true);
          } else {
            haptic.tapFeedback();
            speech.speak('Please type the item you want to find in the box above.', 'immediate');
          }
        }}
        className="relative overflow-hidden rounded-3xl border-2 border-zinc-800 bg-black aspect-video sm:aspect-[4/3] flex items-center justify-center shadow-2xl cursor-pointer"
        role="button"
        tabIndex={0}
        aria-label={target ? `Camera viewfinder. Tap to scan for ${target}.` : 'Camera viewfinder. Tap to scan.'}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="h-full w-full object-cover"
          aria-label="Live camera viewfinder"
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* High-Contrast Bounding Box Highlight */}
        {guidance?.targetDetected && guidance.box && (
          <div
            className={`absolute pointer-events-none border-4 transition-all duration-300 ${
              isCentered
                ? 'border-yellow-400 bg-yellow-400/20 ring-4 ring-yellow-400/50'
                : 'border-sky-400 bg-sky-400/15'
            }`}
            style={{
              left: `${guidance.box.x}%`,
              top: `${guidance.box.y}%`,
              width: `${guidance.box.width}%`,
              height: `${guidance.box.height}%`,
            }}
          >
            <span className="absolute -top-7 left-0 rounded bg-zinc-950 px-2 py-0.5 text-xs font-black text-yellow-400 border border-yellow-400 shadow-md">
              {guidance.targetName}
            </span>
          </div>
        )}

        {/* Calibrated Screen Center Reticle */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className={`h-20 w-20 rounded-full border-2 flex items-center justify-center transition-colors ${
              isCentered ? 'border-yellow-400 ring-4 ring-yellow-400/40 bg-yellow-400/10' : 'border-white/20'
            }`}
          >
            <div className={`h-2.5 w-2.5 rounded-full ${isCentered ? 'bg-yellow-400 animate-ping' : 'bg-white/50'}`} />
          </div>
        </div>

        {/* Scanning Spinner overlay */}
        {isScanning && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-zinc-950/80 px-3 py-1 text-xs font-semibold text-yellow-400 border border-yellow-400/30">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            <span>Analyzing</span>
          </div>
        )}
      </div>

      {/* Primary Direction & Calibrated Distance HUD */}
      <section
        role="region"
        aria-labelledby="guidance-hud-title"
        className={`rounded-3xl border-2 p-5 shadow-2xl transition-all ${
          guidance?.isImmediateObstacle
            ? 'border-red-500 bg-red-950/40 text-red-100'
            : isCentered
            ? 'border-yellow-400 bg-yellow-400/10 text-white'
            : 'border-zinc-800 bg-zinc-900 text-white'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          {/* Main Direction Text & Spoken Instruction */}
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold uppercase tracking-widest text-zinc-400">
                Directional Bearing
              </span>
              {isCentered && (
                <span className="rounded-md bg-yellow-400 px-2 py-0.5 text-[11px] font-black uppercase text-zinc-950">
                  CENTERED ALIGNED
                </span>
              )}
            </div>

            <h2 id="guidance-hud-title" className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              {clockHourText}
            </h2>

            <p className="text-lg sm:text-xl font-bold text-yellow-300 leading-snug">
              {guidance?.actionInstruction ||
                (target
                  ? `Point camera slowly to find ${target}...`
                  : 'Type or speak what to find above.')}
            </p>

            <p className="text-xs font-semibold text-zinc-400">
              {bearingDesc} {headingOffsetDeg !== 0 ? `· Calibrated (${headingOffsetDeg > 0 ? '+' : ''}${headingOffsetDeg}° offset)` : ''}
            </p>
          </div>

          {/* Calibrated Precision SVG Clock Dial */}
          <div className="flex flex-col items-center justify-center shrink-0 self-center">
            <svg
              viewBox="0 0 120 120"
              width="120"
              height="120"
              className="drop-shadow-lg"
              aria-label={`Calibrated clock face pointer oriented at ${Math.round(angleDeg)} degrees (${clockHourText})`}
            >
              {/* Outer dial ring */}
              <circle cx="60" cy="60" r="54" fill="#09090b" stroke="#3f3f46" strokeWidth="3" />
              <circle cx="60" cy="60" r="48" fill="#18181b" stroke="#27272a" strokeWidth="1" />

              {/* 12 Hour Ticks on clock rim */}
              {[
                { label: '12', x: 60, y: 19 },
                { label: '1', x: 81, y: 24 },
                { label: '2', x: 96, y: 40 },
                { label: '3', x: 101, y: 64 },
                { label: '4', x: 96, y: 86 },
                { label: '5', x: 80, y: 102 },
                { label: '6', x: 60, y: 108 },
                { label: '7', x: 40, y: 102 },
                { label: '8', x: 24, y: 86 },
                { label: '9', x: 19, y: 64 },
                { label: '10', x: 24, y: 40 },
                { label: '11', x: 39, y: 24 },
              ].map((h) => (
                <text
                  key={h.label}
                  x={h.x}
                  y={h.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#a1a1aa"
                  fontSize="9"
                  fontWeight="bold"
                >
                  {h.label}
                </text>
              ))}

              {/* Center Crosshair Lines */}
              <line x1="60" y1="28" x2="60" y2="92" stroke="#27272a" strokeWidth="1" strokeDasharray="2,2" />
              <line x1="28" y1="60" x2="92" y2="60" stroke="#27272a" strokeWidth="1" strokeDasharray="2,2" />

              {/* Calibrated Needle pointing exactly around (60, 60) */}
              <g transform={`rotate(${angleDeg}, 60, 60)`}>
                {/* Needle Arrow Polygon */}
                <polygon
                  points="60,18 64,54 60,48 56,54"
                  fill={isCentered ? '#facc15' : '#38bdf8'}
                  stroke={isCentered ? '#eab308' : '#0284c7'}
                  strokeWidth="1.5"
                />
                {/* Counterbalance tail */}
                <line x1="60" y1="60" x2="60" y2="76" stroke="#71717a" strokeWidth="2" strokeLinecap="round" />
              </g>

              {/* Center Pivot Pin */}
              <circle cx="60" cy="60" r="6" fill="#ffffff" stroke="#18181b" strokeWidth="2" />
              <circle cx="60" cy="60" r="2.5" fill={isCentered ? '#facc15' : '#38bdf8'} />
            </svg>
            <span className="text-[11px] font-bold text-zinc-300 mt-1">
              Bearing: <strong className="text-white">{Math.round(angleDeg)}°</strong>
            </span>
          </div>
        </div>

        {/* Calibrated Distance Gauge & Tactile Proximity Meter */}
        <div className="mt-5 pt-4 border-t border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-400">
              Calibrated Distance Gauge:
            </span>
            <button
              onClick={speakDistance}
              className="flex items-center gap-1.5 text-xs font-bold text-yellow-400 hover:text-yellow-300 bg-zinc-800/80 px-2.5 py-1 rounded-lg"
              title="Speak distance aloud"
            >
              <Volume2 className="h-3.5 w-3.5" />
              <span>Hear Distance</span>
            </button>
          </div>

          {/* Large Digital Distance Display & Zone Badge */}
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              {distanceInfo.hasTarget ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-white tracking-tight">
                    {distanceUnit === 'ft' ? `${distanceInfo.feet} ft` : `${distanceInfo.meters} m`}
                  </span>
                  <span className="text-sm font-semibold text-zinc-400">
                    ({distanceUnit === 'ft' ? `${distanceInfo.meters} m` : `${distanceInfo.feet} ft`})
                  </span>
                </div>
              ) : (
                <div className="text-2xl font-black text-zinc-400">
                  {target ? `-- ${distanceUnit} (Searching...)` : 'No item chosen'}
                </div>
              )}
            </div>

            <div className={`rounded-xl border px-3 py-1 text-xs font-black tracking-wide uppercase ${distanceInfo.zoneColorClass}`}>
              {distanceInfo.zoneBadge}
            </div>
          </div>

          {/* 4-Zone Segmented Distance Proximity Bar */}
          <div className="space-y-1.5">
            <div className="relative h-4 w-full rounded-full bg-zinc-950 p-0.5 border border-zinc-700 overflow-hidden flex">
              {distanceInfo.hasTarget ? (
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    distanceInfo.zoneKey === 'reach'
                      ? 'bg-emerald-400 shadow-lg shadow-emerald-400/50 animate-pulse'
                      : distanceInfo.zoneKey === 'close'
                      ? 'bg-yellow-400 shadow-md shadow-yellow-400/40'
                      : distanceInfo.zoneKey === 'mid'
                      ? 'bg-sky-400'
                      : 'bg-purple-400'
                  }`}
                  style={{ width: `${distanceInfo.proximityPercent}%` }}
                />
              ) : (
                <div className="h-full w-full bg-zinc-800/60 flex items-center justify-center">
                  <div className="h-full w-12 bg-yellow-400/40 rounded-full animate-pulse" />
                </div>
              )}
            </div>

            {/* Zone legend markers */}
            <div className="grid grid-cols-4 text-[10px] font-bold text-center">
              <span className="text-purple-400 text-left pl-1">Far (10+ ft)</span>
              <span className="text-sky-400">Mid (6–10 ft)</span>
              <span className="text-yellow-400">Close (3–6 ft)</span>
              <span className="text-emerald-400 text-right pr-1 font-extrabold">Reach (1–2 ft)</span>
            </div>
          </div>
        </div>

        {/* Hazard alert if blocked */}
        {guidance?.isImmediateObstacle && (
          <div
            role="alert"
            className="mt-3 rounded-xl border border-red-500 bg-red-950/80 p-3 text-sm font-bold text-red-200 flex items-center gap-2.5"
          >
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-400" />
            <span>{guidance.obstacleWarning || 'Hazard detected on walking path! Use cane.'}</span>
          </div>
        )}
      </section>

      {/* Action Buttons: Hear Again & Scan Now */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={repeatGuidance}
          className="flex min-h-[58px] items-center justify-center gap-2 rounded-2xl border-2 border-yellow-400 bg-zinc-900 px-4 py-3 font-bold text-white hover:bg-zinc-800 active:scale-98 transition-all focus-visible:ring-2 focus-visible:ring-yellow-400"
          aria-label="Hear guidance again"
        >
          <Volume2 className="h-6 w-6 text-yellow-400" />
          <span className="text-base font-extrabold">Hear Again</span>
        </button>

        <button
          onClick={() => performScan(true)}
          disabled={isScanning}
          className="flex min-h-[58px] items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-4 py-3 font-extrabold text-zinc-950 hover:bg-yellow-300 active:scale-98 transition-all disabled:opacity-50 shadow-lg"
          aria-label="Scan camera view now"
        >
          <RefreshCw className={`h-6 w-6 ${isScanning ? 'animate-spin' : ''}`} />
          <span className="text-base">Scan Now</span>
        </button>
      </div>

      {/* Auto-scan live stream toggle */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3.5 flex items-center justify-between text-xs">
        <label className="flex items-center gap-2 cursor-pointer font-semibold text-zinc-300">
          <input
            type="checkbox"
            checked={isContinuous}
            onChange={(e) => {
              haptic.tapFeedback();
              setIsContinuous(e.target.checked);
              speech.speak(
                e.target.checked
                  ? 'Live continuous vision enabled. Point camera forward.'
                  : 'Live continuous vision paused',
                'immediate',
                true
              );
            }}
            className="h-4 w-4 rounded accent-yellow-400"
          />
          <span className="font-extrabold text-white">Live Hands-Free Stream (Continuous observation without capturing)</span>
        </label>
      </div>
    </div>
  );
};
