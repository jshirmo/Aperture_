import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Eye,
  Volume2,
  RefreshCw,
  AlertTriangle,
  ShieldAlert,
  Mic,
  MicOff,
  Sparkles,
  Play,
  Pause,
} from 'lucide-react';
import { InspectMode, InspectSceneResult, UserSettings } from '../types';
import { speech } from '../services/speechService';
import { haptic } from '../services/hapticService';
import { apiService } from '../services/apiService';

interface WhatAmILookingAtViewProps {
  onBack: () => void;
  settings: UserSettings;
  onLaunchFind?: (target: string) => void;
}

export const WhatAmILookingAtView: React.FC<WhatAmILookingAtViewProps> = ({
  onBack,
  settings,
  onLaunchFind,
}) => {
  const [activeMode, setActiveMode] = useState<'scene' | 'hazards' | 'text'>('scene');
  const [isLiveActive, setIsLiveActive] = useState<boolean>(false); // Prompted on-demand inspection by default
  const [isInspecting, setIsInspecting] = useState<boolean>(false);

  // Result state
  const [result, setResult] = useState<InspectSceneResult | null>(null);
  const [lastSpokenGuidance, setLastSpokenGuidance] = useState<string>('');

  // Voice question state
  const [isVoiceListening, setIsVoiceListening] = useState<boolean>(false);
  const [voiceTranscript, setVoiceTranscript] = useState<string>('');
  const [customQuestion, setCustomQuestion] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const liveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastAnalysisTimeRef = useRef<number>(0);

  // Initialize camera
  useEffect(() => {
    let active = true;

    async function initCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 960 },
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
      } catch (err) {
        console.warn('Camera failed in What Am I Looking At:', err);
      }
    }

    initCamera();

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
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

  // Capture canvas frame from video (compressed 480x360 at 0.65 JPEG for speed)
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

  // Perform Vision Inspection
  const performInspection = async (
    modeToUse: 'scene' | 'hazards' | 'text' = activeMode,
    questionText?: string,
    forced = false
  ) => {
    if (isInspecting && !forced) return;
    setIsInspecting(true);

    const now = Date.now();
    lastAnalysisTimeRef.current = now;

    try {
      const frame = await captureFrameBase64();
      if (!frame) {
        setIsInspecting(false);
        speech.speak('Camera is starting. Please tap Inspect Scene in a moment.', 'immediate');
        return;
      }

      const question = questionText || customQuestion || (
        modeToUse === 'text'
          ? 'Read all visible text, packaging labels, and warnings.'
          : modeToUse === 'hazards'
          ? 'Are there any trip hazards, obstacles, or safety concerns in my path?'
          : 'What am I looking at right now? Describe the scene layout and landmarks.'
      );

      const data = await apiService.inspectScene(
        frame,
        modeToUse as InspectMode,
        question
      );

      setResult(data);

      // Play audio earcon & announce speech
      if (data.hazards && data.hazards.length > 0) {
        speech.playChime('hazard');
        haptic.hazardAlert();
      } else {
        speech.playChime('ping');
        haptic.targetDetected();
      }

      if (data.spokenGuidance) {
        setLastSpokenGuidance(data.spokenGuidance);
        speech.speak(data.spokenGuidance, 'immediate');
      }
    } catch (err: any) {
      console.warn('Inspection handled gracefully:', err);
      speech.speak('Could not inspect scene. Tap to try again.', 'immediate');
    } finally {
      setIsInspecting(false);
    }
  };

  // Only run continuous loop if the user explicitly enabled live mode
  useEffect(() => {
    if (!isLiveActive) {
      if (liveTimerRef.current) {
        clearInterval(liveTimerRef.current);
        liveTimerRef.current = null;
      }
      return;
    }

    liveTimerRef.current = setInterval(() => {
      performInspection(activeMode);
    }, 2500);

    return () => {
      if (liveTimerRef.current) {
        clearInterval(liveTimerRef.current);
        liveTimerRef.current = null;
      }
    };
  }, [isLiveActive, activeMode]);

  // Voice Question input
  const startVoiceQuestion = () => {
    if (isVoiceListening) {
      setIsVoiceListening(false);
      return;
    }

    haptic.tapFeedback();
    setIsVoiceListening(true);
    setVoiceTranscript('');
    speech.playChime('start');

    speech.startVoiceInput(
      (text) => {
        setIsVoiceListening(false);
        setCustomQuestion(text);
        speech.playChime('success');

        const textLower = text.toLowerCase();
        let targetMode = activeMode;
        if (textLower.includes('read') || textLower.includes('label') || textLower.includes('text')) {
          targetMode = 'text';
          setActiveMode('text');
        } else if (textLower.includes('hazard') || textLower.includes('safe') || textLower.includes('obstacle') || textLower.includes('trip')) {
          targetMode = 'hazards';
          setActiveMode('hazards');
        }

        performInspection(targetMode, text, true);
      },
      () => {
        setIsVoiceListening(false);
      },
      (interim) => {
        setVoiceTranscript(interim);
      }
    );
  };

  // Switch inspection mode with spoken feedback
  const handleModeChange = (mode: 'scene' | 'hazards' | 'text') => {
    haptic.tapFeedback();
    setActiveMode(mode);
    setCustomQuestion('');
    setVoiceTranscript('');

    const announcement =
      mode === 'scene'
        ? 'Scene Layout mode.'
        : mode === 'hazards'
        ? 'Safety and Hazards mode.'
        : 'Text reading mode.';

    speech.speak(announcement, 'immediate', false, () => {
      performInspection(mode, undefined, true);
    });
  };

  // Replay spoken guidance
  const handleRepeatGuidance = () => {
    haptic.tapFeedback();
    if (result?.spokenGuidance) {
      speech.speak(result.spokenGuidance, 'immediate', true);
    } else {
      speech.speak('No inspection made yet. Tap Inspect Scene Now to analyze.', 'immediate', true);
    }
  };

  // Toggle live streaming on/off
  const toggleLiveStreaming = () => {
    haptic.tapFeedback();
    const next = !isLiveActive;
    setIsLiveActive(next);
    speech.speak(
      next ? 'Live continuous inspection resumed.' : 'Live inspection paused.',
      'immediate',
      true
    );
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-4 space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b-2 border-zinc-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              haptic.tapFeedback();
              speech.stop();
              onBack();
            }}
            className="flex min-h-[50px] min-w-[50px] items-center justify-center rounded-2xl bg-zinc-900 border-2 border-zinc-700 text-white hover:bg-zinc-800 focus-visible:ring-4 focus-visible:ring-emerald-400"
            aria-label="Back to home dashboard"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <Eye className="h-7 w-7 text-emerald-400" />
              What Am I Looking At?
            </h1>
            <p className="text-xs text-emerald-300 font-bold tracking-wide">
              Live AI Scene &amp; Obstacle Inspector
            </p>
          </div>
        </div>

        {/* Live Pause/Play toggle */}
        <button
          onClick={toggleLiveStreaming}
          className={`flex min-h-[48px] px-3.5 items-center gap-2 rounded-2xl border-2 font-black text-xs transition-all ${
            isLiveActive
              ? 'bg-emerald-400 text-zinc-950 border-emerald-300'
              : 'bg-zinc-900 border-zinc-700 text-zinc-300'
          }`}
          aria-label={isLiveActive ? 'Live inspection active. Tap to pause.' : 'Live inspection paused. Tap to resume.'}
        >
          {isLiveActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          <span>{isLiveActive ? 'Live Active' : 'Paused'}</span>
        </button>
      </div>

      {/* Live Video Camera Viewfinder or Simulation (Tap to inspect on demand) */}
      <div
        onClick={() => performInspection(activeMode)}
        className="relative w-full aspect-video sm:aspect-[4/3] max-h-72 bg-black rounded-3xl overflow-hidden border-3 border-emerald-400 shadow-2xl flex items-center justify-center cursor-pointer select-none active:scale-[0.99] transition-transform"
        role="button"
        tabIndex={0}
        aria-label="Camera viewfinder. Tap anywhere to inspect scene with AI."
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          aria-label="Live camera view stream"
        />

        <canvas ref={canvasRef} className="hidden" />

        {/* Live scanning pulse indicator */}
        {isInspecting && (
          <div className="absolute inset-0 bg-emerald-400/10 border-4 border-emerald-400 flex items-center justify-center pointer-events-none">
            <div className="bg-black/85 px-4 py-2 rounded-2xl border border-emerald-400 flex items-center gap-2 text-emerald-300 text-xs font-black">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Analyzing field of view with AI...</span>
            </div>
          </div>
        )}

        {/* Active mode indicator overlay */}
        <div className="absolute bottom-3 left-3 bg-black/85 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-zinc-700 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-black text-white">
            {activeMode === 'scene' && 'General Scene Layout'}
            {activeMode === 'text' && 'Reading Text in View'}
            {activeMode === 'hazards' && 'Obstacle & Trip Hazard Scan'}
          </span>
        </div>
      </div>

      {/* Primary Prompt Inspection Button (Oversized for Low Vision) */}
      <button
        onClick={() => performInspection(activeMode)}
        disabled={isInspecting}
        className="w-full min-h-[64px] rounded-2xl bg-emerald-400 p-4 font-black text-zinc-950 hover:bg-emerald-300 active:scale-[0.99] transition-all flex items-center justify-center gap-3 shadow-xl focus-visible:ring-4 focus-visible:ring-emerald-300 disabled:opacity-50"
        aria-label={`Inspect ${activeMode} now with AI`}
      >
        <RefreshCw className={`w-6 h-6 ${isInspecting ? 'animate-spin' : ''}`} />
        <span className="text-lg uppercase tracking-wide">
          {isInspecting
            ? 'Analyzing Scene...'
            : activeMode === 'scene'
            ? 'Inspect Scene Now (Tap)'
            : activeMode === 'hazards'
            ? 'Scan for Hazards Now (Tap)'
            : 'Read Text Now (Tap)'}
        </span>
      </button>

      {/* Mode Switchers (High Contrast Oversized Buttons for Low Vision) */}
      <div className="space-y-2">
        <p className="text-xs font-black uppercase tracking-wider text-zinc-300 px-1">
          Select View Mode:
        </p>

        <div className="grid grid-cols-2 gap-3">
          {/* 1. Scene Layout */}
          <button
            onClick={() => handleModeChange('scene')}
            className={`min-h-[72px] p-4 rounded-2xl border-3 flex items-center gap-3 text-left transition-all ${
              activeMode === 'scene'
                ? 'bg-yellow-400 border-yellow-300 text-zinc-950 font-black shadow-xl scale-[1.01]'
                : 'bg-zinc-900 border-zinc-700 text-white hover:border-zinc-500'
            }`}
            aria-label="Scene Layout mode. Describe room landmarks and furniture."
            aria-pressed={activeMode === 'scene'}
          >
            <Eye className="w-8 h-8 shrink-0 stroke-[2.5]" />
            <div>
              <p className="text-base font-black leading-tight">Scene Layout</p>
              <p className={`text-xs ${activeMode === 'scene' ? 'text-zinc-900 font-bold' : 'text-zinc-300'}`}>
                Furniture &amp; landmarks
              </p>
            </div>
          </button>

          {/* 2. Hazards & Safety */}
          <button
            onClick={() => handleModeChange('hazards')}
            className={`min-h-[72px] p-4 rounded-2xl border-3 flex items-center gap-3 text-left transition-all ${
              activeMode === 'hazards'
                ? 'bg-rose-500 border-rose-400 text-white font-black shadow-xl scale-[1.01]'
                : 'bg-zinc-900 border-zinc-700 text-white hover:border-zinc-500'
            }`}
            aria-label="Safety and Hazards mode. Detect floor trip obstacles."
            aria-pressed={activeMode === 'hazards'}
          >
            <ShieldAlert className="w-8 h-8 shrink-0 stroke-[2.5]" />
            <div>
              <p className="text-base font-black leading-tight">Safety &amp; Hazards</p>
              <p className={`text-xs ${activeMode === 'hazards' ? 'text-white font-bold' : 'text-zinc-300'}`}>
                Walkway &amp; trip alerts
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Spoken AI Result Card (Optimized for Blind / Low-Vision Independence) */}
      <section
        role="region"
        aria-live="assertive"
        aria-atomic="true"
        className={`p-5 rounded-3xl border-3 ${
          result?.hazards && result.hazards.length > 0
            ? 'bg-rose-950/60 border-rose-500 text-rose-100'
            : 'bg-zinc-950 border-emerald-400/90 text-white'
        } shadow-2xl space-y-3`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Volume2 className="w-6 h-6 text-emerald-400" />
            <span className="text-xs font-black uppercase tracking-widest text-emerald-400">
              Live Spoken AI Description
            </span>
          </div>

          <button
            onClick={handleRepeatGuidance}
            className="text-xs font-bold px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white hover:bg-zinc-800"
            aria-label="Replay audio announcement"
          >
            Replay Audio
          </button>
        </div>

        <p className="text-lg sm:text-xl font-extrabold text-white leading-relaxed">
          {result?.spokenGuidance ||
            (isInspecting
              ? 'Inspecting live scene with AI...'
              : 'Point your camera in any direction to receive live continuous audio descriptions.')}
        </p>

        {/* Hazards alert */}
        {result?.hazards && result.hazards.length > 0 && (
          <div className="mt-3 p-3.5 bg-rose-900/60 rounded-2xl border-2 border-rose-400">
            <p className="text-xs font-black uppercase text-rose-200 mb-1 flex items-center gap-1.5">
              <AlertTriangle className="w-5 h-5 text-rose-300" />
              <span>Safety Obstacle Notice:</span>
            </p>
            <ul className="text-sm text-white space-y-1 list-disc list-inside font-bold">
              {result.hazards.map((h, idx) => (
                <li key={idx}>{h}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Voice Question Button */}
      <button
        onClick={startVoiceQuestion}
        className={`w-full min-h-[64px] p-4 rounded-2xl border-3 flex items-center justify-center gap-3 transition-all ${
          isVoiceListening
            ? 'bg-rose-600 border-rose-300 text-white animate-pulse'
            : 'bg-zinc-900 border-yellow-400 text-yellow-400 hover:bg-zinc-800'
        }`}
        aria-label={
          isVoiceListening
            ? 'Microphone active. Speak your question now.'
            : 'Ask a question using your voice about what you see'
        }
      >
        {isVoiceListening ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
        <span className="text-base font-black uppercase tracking-wide">
          {isVoiceListening
            ? 'Listening... Speak your question'
            : 'Ask with Voice: "What is this?" or "Is walkway clear?"'}
        </span>
      </button>

      {voiceTranscript && (
        <p className="text-xs text-center text-zinc-300 font-bold italic">
          "{voiceTranscript}"
        </p>
      )}

      {/* Bridge to Find It */}
      {result?.primaryObject && onLaunchFind && (
        <button
          onClick={() => {
            haptic.tapFeedback();
            onLaunchFind(result.primaryObject || 'target object');
          }}
          className="w-full py-3.5 px-4 rounded-2xl bg-zinc-900 border-2 border-zinc-700 text-zinc-100 text-sm font-bold hover:bg-zinc-800 flex items-center justify-center gap-2"
          aria-label={`Guide me to ${result.primaryObject} with Find It clock navigation`}
        >
          <span>Locate "{result.primaryObject}" with Clock-Face Navigation</span>
          <ArrowLeft className="w-4 h-4 rotate-180 text-yellow-400" />
        </button>
      )}
    </div>
  );
};
