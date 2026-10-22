import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  FileText,
  Volume2,
  VolumeX,
  RotateCcw,
  Sparkles,
  Copy,
  Check,
  Camera,
  Play,
  Pause,
} from 'lucide-react';
import { ReadTextResult, UserSettings } from '../types';
import { speech } from '../services/speechService';
import { haptic } from '../services/hapticService';
import { apiService } from '../services/apiService';
import { SAMPLE_MEDICATION_IMAGE, SAMPLE_WATER_BOTTLE_IMAGE } from '../services/sampleImages';

interface ReadTextViewProps {
  onBack: () => void;
  settings: UserSettings;
}

export const ReadTextView: React.FC<ReadTextViewProps> = ({ onBack }) => {
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [currentResult, setCurrentResult] = useState<ReadTextResult | null>(null);
  const [history, setHistory] = useState<ReadTextResult[]>([]);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [speechMuted, setSpeechMuted] = useState<boolean>(false);
  const [isPlayingExact, setIsPlayingExact] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isMountedRef = useRef<boolean>(true);

  // Initialize camera stream
  const startCamera = useCallback(async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 960 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.warn('Camera access unavailable for ReadText:', err);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Frame capture helper (480x360 at 0.6 JPEG for maximum transmission speed)
  // Wait for camera video to produce active frames
  const waitForCameraReady = useCallback(async (maxWaitMs = 1500): Promise<boolean> => {
    const video = videoRef.current;
    if (!video) return false;
    if (video.videoWidth > 0 && video.readyState >= 2) return true;

    return new Promise<boolean>((resolve) => {
      let resolved = false;
      const finish = (isReady: boolean) => {
        if (!resolved) {
          resolved = true;
          video.removeEventListener('loadeddata', onReady);
          video.removeEventListener('timeupdate', onReady);
          resolve(isReady);
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
  }, []);

  // Frame capture helper (480x360 at 0.65 JPEG for maximum transmission speed and clarity)
  const captureFrame = useCallback(async (): Promise<string | null> => {
    const video = videoRef.current;
    if (!video) return null;

    if (video.videoWidth === 0 || video.readyState < 2) {
      await waitForCameraReady(1500);
    }

    if (video.videoWidth > 0 && video.videoHeight > 0) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(video.videoWidth, 640);
        canvas.height = Math.round((canvas.width * video.videoHeight) / video.videoWidth);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          return canvas.toDataURL('image/jpeg', 0.65);
        }
      } catch (err) {
        console.warn('Canvas frame capture error:', err);
      }
    }
    return null;
  }, [waitForCameraReady]);

  // Prompted Transcribing: Runs when user taps Scan or screen
  const handlePromptRead = useCallback(
    async (explicitImage?: string) => {
      if (!isMountedRef.current || isAnalyzing) return;

      setIsAnalyzing(true);
      setIsPlayingExact(false);
      haptic.tapFeedback();
      speech.playChime('ping');

      const frame = explicitImage || (await captureFrame());
      if (!frame) {
        setIsAnalyzing(false);
        speech.speak('Camera is starting. Please tap Read Text Now in a moment.', 'immediate');
        return;
      }

      try {
        const result = await apiService.readText(frame);
        if (!isMountedRef.current) return;

        if (result && result.hasText && (result.overview || result.spokenText || result.fullText)) {
          setCurrentResult(result);
          haptic.targetDetected();
          speech.playChime('aligned');

          // Announce the overview aloud first
          if (!speechMuted) {
            const overviewText = result.overview || result.spokenText;
            speech.speak(overviewText, 'immediate');
          }

          setHistory((prev) => {
            const filtered = prev.filter((p) => p.overview !== result.overview);
            return [result, ...filtered.slice(0, 8)];
          });
        } else {
          speech.speak('No text detected in view. Hold package closer and tap Read Text.', 'immediate');
        }
      } catch (err) {
        console.warn('OCR reading error:', err);
        speech.speak('Could not read text. Please tap to try again.', 'immediate');
      } finally {
        if (isMountedRef.current) {
          setIsAnalyzing(false);
        }
      }
    },
    [captureFrame, isAnalyzing, speechMuted]
  );

  // Initialize camera once on mount
  useEffect(() => {
    isMountedRef.current = true;
    startCamera();

    return () => {
      isMountedRef.current = false;
      stopCamera();
      speech.stop();
    };
  }, [startCamera, stopCamera]);

  // Read Exact Full Text Aloud
  const handleReadExactText = () => {
    haptic.tapFeedback();
    if (!currentResult?.fullText) {
      speech.speak('No exact text available to read.', 'immediate');
      return;
    }

    if (isPlayingExact) {
      speech.stop();
      setIsPlayingExact(false);
      speech.speak('Paused reading exact text.', 'immediate');
      return;
    }

    setIsPlayingExact(true);
    speech.playChime('ping');
    speech.speak(`Reading exact text: ${currentResult.fullText}`, 'immediate', true, () => {
      setIsPlayingExact(false);
    });
  };

  // Repeat Overview Aloud
  const handleRepeatOverview = () => {
    haptic.tapFeedback();
    if (currentResult && (currentResult.overview || currentResult.spokenText)) {
      speech.playChime('ping');
      speech.speak(currentResult.overview || currentResult.spokenText, 'immediate', true);
    } else {
      speech.speak('No text has been read yet. Tap Read Text Now to scan.', 'immediate');
    }
  };

  // Copy verbatim text
  const handleCopyText = () => {
    if (!currentResult?.fullText) return;
    haptic.targetCentered();
    navigator.clipboard.writeText(currentResult.fullText);
    setIsCopied(true);
    speech.speak('Exact text copied to clipboard.', 'immediate');
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Sample testing
  const handleLoadSample = (sampleDataUrl: string, name: string) => {
    haptic.tapFeedback();
    handlePromptRead(sampleDataUrl);
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-6rem)] max-w-3xl mx-auto px-3 sm:px-4 py-3 space-y-3 sm:space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b-2 border-zinc-800">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <button
            onClick={() => {
              haptic.tapFeedback();
              speech.stop();
              onBack();
            }}
            className="flex min-h-[46px] min-w-[46px] sm:min-h-[52px] sm:min-w-[52px] items-center justify-center rounded-2xl bg-zinc-900 border-2 border-zinc-700 text-white hover:bg-zinc-800 focus-visible:ring-4 focus-visible:ring-sky-400 shrink-0"
            aria-label="Back to home dashboard"
          >
            <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-1.5 sm:gap-2 truncate">
              <FileText className="h-6 w-6 sm:h-7 sm:w-7 text-sky-400 shrink-0" />
              <span>Read Text &amp; Labels</span>
            </h1>
            <p className="text-[11px] sm:text-xs text-sky-300 font-bold tracking-wide truncate">
              Overview Summary + Exact Text Aloud
            </p>
          </div>
        </div>

        {/* Audio Mute Control */}
        <button
          onClick={() => {
            haptic.tapFeedback();
            const next = !speechMuted;
            setSpeechMuted(next);
            speech.speak(next ? 'Speech muted' : 'Speech unmuted', 'immediate');
          }}
          className={`flex min-h-[46px] min-w-[46px] sm:min-h-[50px] sm:min-w-[50px] items-center justify-center rounded-2xl border-2 text-xs font-black transition-all shrink-0 ${
            !speechMuted
              ? 'bg-sky-400/20 border-sky-400 text-sky-300'
              : 'bg-zinc-900 border-zinc-700 text-zinc-400'
          }`}
          aria-label={speechMuted ? 'Speech is muted. Tap to enable aloud reading.' : 'Speech is active. Tap to mute aloud reading.'}
        >
          {!speechMuted ? <Volume2 className="h-5 w-5 sm:h-6 sm:w-6" /> : <VolumeX className="h-5 w-5 sm:h-6 sm:w-6" />}
        </button>
      </div>

      {/* Screen-Wide Camera Viewfinder (Tap anywhere to read text on demand) */}
      <div
        onClick={() => handlePromptRead()}
        className="relative w-full aspect-video sm:aspect-[16/9] rounded-3xl overflow-hidden bg-black border-3 border-sky-400 shadow-2xl cursor-pointer select-none group"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            handlePromptRead();
          }
        }}
        aria-label="Camera viewfinder. Tap anywhere on the camera to read text."
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />

        {/* High-Contrast Aim Guide Targeting Corners */}
        <div className="absolute inset-0 pointer-events-none p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex justify-between">
            <span className="w-8 h-8 sm:w-10 sm:h-10 border-t-4 border-l-4 border-sky-400 rounded-tl-2xl shadow-md" />
            <span className="w-8 h-8 sm:w-10 sm:h-10 border-t-4 border-r-4 border-sky-400 rounded-tr-2xl shadow-md" />
          </div>
          <div className="flex justify-between">
            <span className="w-8 h-8 sm:w-10 sm:h-10 border-b-4 border-l-4 border-sky-400 rounded-bl-2xl shadow-md" />
            <span className="w-8 h-8 sm:w-10 sm:h-10 border-b-4 border-r-4 border-sky-400 rounded-br-2xl shadow-md" />
          </div>
        </div>

        {/* Overlay Status Badge */}
        <div className="absolute top-3 sm:top-4 left-3 sm:left-4 right-3 sm:right-4 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-1.5 sm:gap-2 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-black/85 backdrop-blur-md border border-sky-400 text-[11px] sm:text-xs font-black text-sky-300">
            <Camera className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-sky-400" />
            <span>{isAnalyzing ? 'Analyzing Text with AI...' : 'Camera Active'}</span>
          </div>

          {isAnalyzing && (
            <div className="flex items-center gap-1.5 px-3 py-1 sm:px-3 sm:py-1.5 rounded-full bg-black/85 backdrop-blur-md border border-yellow-400 text-yellow-300 text-[11px] sm:text-xs font-black animate-pulse">
              <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5 animate-spin" />
              <span>Transcribing...</span>
            </div>
          )}
        </div>

        {/* Central visual cue */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-4">
          {!isAnalyzing && !currentResult && (
            <div className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-2xl bg-black/80 backdrop-blur-md border-2 border-sky-400 text-white font-extrabold text-xs sm:text-base text-center shadow-2xl">
              Tap Anywhere to Read Text
            </div>
          )}
        </div>

        {/* Bottom hint inside viewfinder */}
        <div className="absolute bottom-3 inset-x-0 text-center pointer-events-none">
          <span className="px-3.5 py-1 sm:px-4 sm:py-1.5 rounded-full bg-black/80 backdrop-blur-md text-[11px] sm:text-xs text-zinc-100 font-extrabold border border-zinc-700">
            Tap screen to scan on-demand
          </span>
        </div>
      </div>

      {/* Primary Action Button (Giant Prompt Button for Bad Vision) */}
      <button
        onClick={() => handlePromptRead()}
        disabled={isAnalyzing}
        className="w-full min-h-[62px] sm:min-h-[72px] rounded-2xl bg-sky-400 text-zinc-950 font-black text-lg sm:text-2xl flex items-center justify-center gap-2 sm:gap-3 shadow-xl hover:bg-sky-300 active:scale-95 transition-all focus-visible:ring-4 focus-visible:ring-sky-400 disabled:opacity-50"
        aria-label={currentResult ? 'Scan and read again' : 'Read text now'}
      >
        {isAnalyzing ? (
          <>
            <Sparkles className="h-6 w-6 sm:h-7 sm:w-7 animate-spin" />
            <span>Transcribing with AI...</span>
          </>
        ) : (
          <>
            <Camera className="h-6 w-6 sm:h-7 sm:w-7 stroke-[2.8]" />
            <span>{currentResult ? 'Scan Again / Next Item' : 'Read Text Now'}</span>
          </>
        )}
      </button>

      {/* Current Results Section: Overview + Exact Text Button */}
      {currentResult && (
        <div className="space-y-3 sm:space-y-4 pt-1 sm:pt-2">
          {/* Card 1: Overview Summary (Read Aloud Automatically First) */}
          <section
            role="region"
            aria-labelledby="overview-heading"
            className="p-4 sm:p-5 rounded-3xl bg-zinc-950 border-3 border-sky-400 shadow-2xl space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 sm:h-3.5 sm:w-3.5 rounded-full bg-sky-400 animate-pulse" />
                <h2 id="overview-heading" className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-sky-400">
                  Overview of What Was Read
                </h2>
              </div>

              <button
                onClick={handleRepeatOverview}
                className="flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-zinc-900 border border-sky-400/50 text-[11px] sm:text-xs font-bold text-sky-300 hover:text-white hover:bg-zinc-800"
                aria-label="Repeat overview aloud"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Hear Overview</span>
              </button>
            </div>

            {currentResult.headline && (
              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug">
                {currentResult.headline}
              </h3>
            )}

            <p className="text-base sm:text-xl font-bold text-sky-200 leading-relaxed bg-zinc-900/90 p-3.5 sm:p-4 rounded-2xl border border-zinc-800">
              {currentResult.overview || currentResult.spokenText}
            </p>
          </section>

          {/* Card 2: Button to Read Exact Text & Verbatim Text Container */}
          <section
            role="region"
            aria-labelledby="exact-text-heading"
            className="p-4 sm:p-5 rounded-3xl bg-zinc-950 border-3 border-yellow-400 shadow-2xl space-y-3 sm:space-y-4"
          >
            {/* The Dedicated Button to Read Exact Text Aloud */}
            <button
              onClick={handleReadExactText}
              className={`w-full min-h-[58px] sm:min-h-[68px] rounded-2xl p-3 sm:p-4 font-black text-base sm:text-xl flex items-center justify-center gap-2 sm:gap-3 shadow-2xl transition-all active:scale-[0.98] ${
                isPlayingExact
                  ? 'bg-rose-500 text-white animate-pulse'
                  : 'bg-yellow-400 text-zinc-950 hover:bg-yellow-300'
              }`}
              aria-label={isPlayingExact ? 'Stop reading exact text' : 'Read exact verbatim text aloud'}
            >
              <Volume2 className="h-6 w-6 sm:h-7 sm:w-7 stroke-[2.8]" />
              <span>{isPlayingExact ? 'Pause Reading Exact Text' : 'Read Exact Text Aloud'}</span>
            </button>

            {/* Exact Verbatim Text Display */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 id="exact-text-heading" className="text-xs font-black uppercase tracking-widest text-yellow-400">
                  Exact Verbatim Text
                </h2>

                {currentResult.fullText && (
                  <button
                    onClick={handleCopyText}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 text-xs font-bold text-zinc-200 hover:text-white hover:bg-zinc-800"
                    aria-label="Copy exact text to clipboard"
                  >
                    {isCopied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    <span>{isCopied ? 'Copied' : 'Copy Exact Text'}</span>
                  </button>
                )}
              </div>

              <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-900 border border-zinc-800 text-sm sm:text-lg text-zinc-100 font-mono whitespace-pre-wrap leading-relaxed select-text">
                {currentResult.fullText || 'No verbatim text captured.'}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* When no text has been read yet */}
      {!currentResult && (
        <div className="p-4 sm:p-6 rounded-3xl bg-zinc-950 border-2 border-zinc-800 text-center space-y-2">
          <p className="text-lg sm:text-xl font-extrabold text-white">
            Point camera at package and tap "Read Text Now"
          </p>
          <p className="text-xs sm:text-sm font-semibold text-zinc-400">
            Aperture will first speak an overview summary aloud, then give you a button to hear the exact text word-for-word.
          </p>
        </div>
      )}

      {/* Quick Testing Samples */}
      <div className="pt-2 border-t border-zinc-800/80">
        <p className="text-xs font-bold text-zinc-400 mb-2">
          Test with sample package labels:
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleLoadSample(SAMPLE_MEDICATION_IMAGE, 'Prescription Medication')}
            className="p-3 rounded-2xl bg-zinc-900 border-2 border-zinc-700 text-xs font-bold text-zinc-100 hover:border-sky-400 text-center min-h-[48px]"
          >
            💊 Medication Label
          </button>
          <button
            onClick={() => handleLoadSample(SAMPLE_WATER_BOTTLE_IMAGE, 'Drink Bottle')}
            className="p-3 rounded-2xl bg-zinc-900 border-2 border-zinc-700 text-xs font-bold text-zinc-100 hover:border-sky-400 text-center min-h-[48px]"
          >
            🧴 Drink Bottle Label
          </button>
        </div>
      </div>
    </div>
  );
};
