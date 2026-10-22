import React, { useState } from 'react';
import {
  X,
  FileText,
  Compass,
  Eye,
  Settings,
  Volume2,
  AlertTriangle,
  HelpCircle,
  ShieldCheck,
  Sliders,
} from 'lucide-react';
import { speech } from '../services/speechService';
import { haptic } from '../services/hapticService';

interface FutureModesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FutureModesModal: React.FC<FutureModesModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'read' | 'find' | 'inspect' | 'controls'>('read');

  if (!isOpen) return null;

  const handleTabChange = (tab: 'read' | 'find' | 'inspect' | 'controls', label: string) => {
    haptic.tapFeedback();
    setActiveTab(tab);
    speech.speak(`Showing ${label} guide`, 'immediate');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-guide-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm overflow-y-auto"
    >
      <div className="w-full max-w-2xl rounded-3xl border-3 border-yellow-400 bg-zinc-950 p-6 text-white shadow-2xl space-y-5 my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <img
              src="/assets/aistudio/image_eff76819_4ddf1407.jpg"
              alt="Aperture Emblem"
              className="h-11 w-11 rounded-full object-cover border-2 border-yellow-400 shadow-md shrink-0"
            />
            <div>
              <h2 id="app-guide-title" className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Aperture App User Guide
              </h2>
              <p className="text-xs text-zinc-300 font-bold">
                How to use Aperture's visual accessibility tools
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              haptic.tapFeedback();
              onClose();
            }}
            className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-2xl border-2 border-zinc-700 bg-zinc-900 text-zinc-200 hover:text-white hover:border-zinc-500 focus-visible:ring-4 focus-visible:ring-yellow-400"
            aria-label="Close user guide"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Guide Navigation Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="tablist">
          {[
            { id: 'read', label: 'Read Text', icon: FileText, color: 'text-sky-400' },
            { id: 'find', label: 'Find It', icon: Compass, color: 'text-amber-400' },
            { id: 'inspect', label: 'Looking At', icon: Eye, color: 'text-emerald-400' },
            { id: 'controls', label: 'Controls', icon: Sliders, color: 'text-yellow-400' },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isSelected}
                onClick={() => handleTabChange(tab.id as any, tab.label)}
                className={`flex flex-col items-center justify-center gap-1.5 min-h-[58px] rounded-2xl p-2.5 text-xs font-black transition-all ${
                  isSelected
                    ? 'bg-yellow-400 text-zinc-950 shadow-xl scale-[1.02]'
                    : 'border-2 border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700 hover:text-white'
                }`}
              >
                <Icon className={`h-5 w-5 ${isSelected ? 'text-zinc-950' : tab.color}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: READ TEXT & LABELS */}
        {activeTab === 'read' && (
          <div className="space-y-4 rounded-3xl border-2 border-sky-400/40 bg-zinc-900/90 p-5">
            <div className="flex items-center gap-2 text-sky-400">
              <FileText className="h-6 w-6" />
              <h3 className="text-lg font-black text-white">Read Text &amp; Labels</h3>
            </div>

            <p className="text-sm text-zinc-200 leading-relaxed font-semibold">
              Instantly reads food packaging, prescription medication labels, street and room signs, receipts, or paper mail aloud.
            </p>

            <div className="space-y-3 pt-1">
              <div className="rounded-2xl bg-zinc-950 p-4 border border-zinc-800 space-y-1.5">
                <p className="text-xs font-black uppercase tracking-wider text-sky-400">1. Aim &amp; Tap</p>
                <p className="text-sm text-zinc-300 leading-snug">
                  Hold the package or sign in front of your camera and tap <strong className="text-white">Read Text Now</strong> (or tap directly anywhere on the camera viewfinder).
                </p>
              </div>

              <div className="rounded-2xl bg-zinc-950 p-4 border border-zinc-800 space-y-1.5">
                <p className="text-xs font-black uppercase tracking-wider text-sky-400">2. Concise Overview Aloud</p>
                <p className="text-sm text-zinc-300 leading-snug">
                  Aperture speaks a clear 1–2 sentence summary first (e.g. brand name, medication dosage, expiration date, or main instructions) so you get key details without listening to cluttered text.
                </p>
              </div>

              <div className="rounded-2xl bg-zinc-950 p-4 border border-zinc-800 space-y-1.5">
                <p className="text-xs font-black uppercase tracking-wider text-sky-400">3. Verbatim Exact Reading</p>
                <p className="text-sm text-zinc-300 leading-snug">
                  Tap <strong className="text-white">Hear Exact Word-for-Word</strong> to listen to the complete transcribed text with original spelling and line breaks.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: FIND IT */}
        {activeTab === 'find' && (
          <div className="space-y-4 rounded-3xl border-2 border-amber-400/40 bg-zinc-900/90 p-5">
            <div className="flex items-center gap-2 text-amber-400">
              <Compass className="h-6 w-6" />
              <h3 className="text-lg font-black text-white">Find It (Directional Locator)</h3>
            </div>

            <p className="text-sm text-zinc-200 leading-relaxed font-semibold">
              Guides you directly to items like keys, water bottles, chairs, doors, or backpacks using intuitive clock-face directions and distance tones.
            </p>

            <div className="space-y-3 pt-1">
              <div className="rounded-2xl bg-zinc-950 p-4 border border-zinc-800 space-y-1.5">
                <p className="text-xs font-black uppercase tracking-wider text-amber-400">1. Type What You Want to Find</p>
                <p className="text-sm text-zinc-300 leading-snug">
                  Type any object name into the search box (e.g. <strong className="text-white">keys</strong>, <strong className="text-white">water bottle</strong>, <strong className="text-white">chair</strong>) and tap <strong className="text-white">Find</strong>.
                </p>
              </div>

              <div className="rounded-2xl bg-zinc-950 p-4 border border-zinc-800 space-y-1.5">
                <p className="text-xs font-black uppercase tracking-wider text-amber-400">2. Clock-Face Audio Direction</p>
                <p className="text-sm text-zinc-300 leading-snug">
                  Tap <strong className="text-white">Scan Now</strong>. Aperture speaks your relative clock bearing (e.g. <em className="text-white">"Keys at 2 o’clock, approx 3 feet away"</em>) and shows a high-contrast needle on the dial.
                </p>
              </div>

              <div className="rounded-2xl bg-zinc-950 p-4 border border-zinc-800 space-y-1.5">
                <p className="text-xs font-black uppercase tracking-wider text-amber-400">3. Proximity Zones</p>
                <p className="text-sm text-zinc-300 leading-snug">
                  The calibrated gauge alerts you when you are in <strong className="text-emerald-400">Arm's Reach (&lt; 2.5 ft)</strong>, <strong className="text-yellow-400">Close (2.5–5.5 ft)</strong>, <strong className="text-sky-400">Approaching (5.5–10 ft)</strong>, or <strong className="text-purple-400">Far (&gt; 10 ft)</strong>.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: WHAT AM I LOOKING AT? */}
        {activeTab === 'inspect' && (
          <div className="space-y-4 rounded-3xl border-2 border-emerald-400/40 bg-zinc-900/90 p-5">
            <div className="flex items-center gap-2 text-emerald-400">
              <Eye className="h-6 w-6" />
              <h3 className="text-lg font-black text-white">What Am I Looking At?</h3>
            </div>

            <p className="text-sm text-zinc-200 leading-relaxed font-semibold">
              Provides on-demand spatial awareness, room layout descriptions, and alerts for walking hazards.
            </p>

            <div className="space-y-3 pt-1">
              <div className="rounded-2xl bg-zinc-950 p-4 border border-zinc-800 space-y-1.5">
                <p className="text-xs font-black uppercase tracking-wider text-emerald-400">Scene Layout Mode</p>
                <p className="text-sm text-zinc-300 leading-snug">
                  Describes the physical room in front of you: furniture landmarks, doorways, desk arrangements, and open walking corridors.
                </p>
              </div>

              <div className="rounded-2xl bg-zinc-950 p-4 border border-zinc-800 space-y-1.5">
                <p className="text-xs font-black uppercase tracking-wider text-rose-400">Safety &amp; Hazards Mode</p>
                <p className="text-sm text-zinc-300 leading-snug">
                  Actively scans the floor and walkway for loose power cords, open cabinet doors, floor transition edges, or dropped items that could cause trips.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: ACCESSIBILITY & CONTROLS */}
        {activeTab === 'controls' && (
          <div className="space-y-4 rounded-3xl border-2 border-yellow-400/40 bg-zinc-900/90 p-5">
            <div className="flex items-center gap-2 text-yellow-400">
              <Sliders className="h-6 w-6" />
              <h3 className="text-lg font-black text-white">Accessibility &amp; App Controls</h3>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl bg-zinc-950 p-4 border border-zinc-800 space-y-1.5">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <Volume2 className="h-4 w-4 text-yellow-400" />
                  <span>Audio Speech Mute / Unmute</span>
                </div>
                <p className="text-xs text-zinc-300 leading-snug">
                  Tap the speaker icon in the top header at any time to instantly silence speech or re-enable spoken guidance.
                </p>
              </div>

              <div className="rounded-2xl bg-zinc-950 p-4 border border-zinc-800 space-y-1.5">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <Settings className="h-4 w-4 text-yellow-400" />
                  <span>Settings &amp; Personalization</span>
                </div>
                <p className="text-xs text-zinc-300 leading-snug">
                  Tap the gear icon in the top header to adjust speech rate (0.75x to 1.5x), toggle haptic feedback, switch between High-Contrast Dark and Light modes, and increase text size to Large or Extra Large.
                </p>
              </div>

              <div className="rounded-2xl bg-zinc-950 p-4 border border-zinc-800 space-y-1.5">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  <span>Privacy &amp; Safety</span>
                </div>
                <p className="text-xs text-zinc-300 leading-snug">
                  Your camera is only accessed when you are actively using a vision tool. Frames are processed privately and are never stored or used to train public models.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Mobility Notice */}
        <div className="rounded-2xl border-2 border-red-500/60 bg-red-950/40 p-3.5 flex items-start gap-2.5 text-xs text-red-200 font-semibold shadow-lg">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
          <p>
            Aperture assists with visual and audio awareness, but does not replace a white cane or guide dog. Always use your primary mobility aid for steps, drop-offs, and street crossings.
          </p>
        </div>

        {/* Footer */}
        <div className="pt-2 text-right">
          <button
            onClick={() => {
              haptic.tapFeedback();
              onClose();
            }}
            className="min-h-[48px] rounded-2xl bg-yellow-400 px-6 font-black text-zinc-950 text-sm hover:bg-yellow-300 active:scale-95 transition-all shadow-xl"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
