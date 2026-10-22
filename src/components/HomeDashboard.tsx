import React from 'react';
import {
  Compass,
  FileText,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Bot,
  Eye,
  Volume2,
} from 'lucide-react';
import { UserSettings } from '../types';
import { speech } from '../services/speechService';
import { haptic } from '../services/hapticService';

interface HomeDashboardProps {
  onSelectView: (view: 'find' | 'read' | 'inspect', initialTarget?: string) => void;
  settings: UserSettings;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  onSelectView,
}) => {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-5 space-y-5">
      {/* High-Contrast Accessible App Header (No cluttered top voice bar) */}
      <section
        role="region"
        aria-label="Aperture Assistive Vision"
        className="rounded-3xl border-3 border-yellow-400 bg-black p-5 shadow-2xl relative overflow-hidden"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-yellow-400 animate-pulse" />
              <span className="text-xs font-black uppercase tracking-widest text-yellow-400">
                Aperture Accessibility Hub
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              AI Vision Tools
            </h1>
            <p className="text-sm font-semibold text-zinc-200">
              High-contrast visual tools built for blind and low-vision independence. Choose a tool below.
            </p>
          </div>
          <img
            src="/assets/aistudio/image_eff76819_4ddf1407.jpg"
            alt="Aperture Emblem"
            className="h-16 w-16 sm:h-20 sm:w-20 rounded-full object-cover border-2 border-yellow-400 shadow-xl shrink-0"
          />
        </div>
      </section>

      {/* Primary Feature Cards (Oversized, High-Contrast for Low Vision) */}
      <nav aria-label="Core Assistive Tools" className="space-y-4">
        {/* 1. READ TEXT & LABELS (Replaces Remember It on Home Screen, Reads Aloud Live) */}
        <button
          onClick={() => {
            haptic.tapFeedback();
            onSelectView('read');
          }}
          className="group w-full min-h-[124px] rounded-3xl border-3 border-sky-400 bg-gradient-to-r from-zinc-950 via-zinc-900 to-black p-5 text-left transition-all hover:bg-zinc-900 hover:border-sky-300 active:scale-[0.99] focus-visible:ring-4 focus-visible:ring-sky-400 shadow-2xl relative overflow-hidden"
          aria-label="Read Text and Labels: Live camera OCR that reads packages, medication labels, signs, and documents aloud automatically in real time."
        >
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-sky-400 text-zinc-950 font-black shadow-lg group-hover:scale-105 transition-transform">
              <FileText className="h-9 w-9 stroke-[2.8]" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black tracking-tight text-white group-hover:text-sky-400 transition-colors">
                  READ TEXT &amp; LABELS
                </span>
                <ArrowRight className="h-6 w-6 text-sky-400 opacity-90 group-hover:translate-x-1 transition-transform" />
              </div>
              <p className="text-sm font-semibold text-zinc-200 leading-snug">
                Point camera at food packages, medicine bottles, signs, or mail to hear them read aloud live.
                <span className="inline-flex items-center ml-2 px-2.5 py-0.5 rounded-full bg-sky-400/20 border border-sky-400/50 text-[11px] font-black tracking-wider text-sky-300 uppercase align-middle">
                  Prompted Aloud OCR
                </span>
              </p>
            </div>
          </div>
        </button>

        {/* 2. FIND IT (Directional Clock-Face Locator) */}
        <button
          onClick={() => {
            haptic.tapFeedback();
            onSelectView('find');
          }}
          className="group w-full min-h-[124px] rounded-3xl border-3 border-amber-400 bg-gradient-to-r from-zinc-950 via-zinc-900 to-black p-5 text-left transition-all hover:bg-zinc-900 hover:border-amber-300 active:scale-[0.99] focus-visible:ring-4 focus-visible:ring-amber-400 shadow-xl relative overflow-hidden"
          aria-label="Find It: Directional locator for chairs, water bottles, keys, doors, and belongings."
        >
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-zinc-950 font-black shadow-md group-hover:scale-105 transition-transform">
              <Compass className="h-9 w-9 stroke-[2.8]" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black tracking-tight text-white group-hover:text-amber-400 transition-colors">
                  FIND IT
                </span>
                <ArrowRight className="h-6 w-6 text-amber-400 opacity-90 group-hover:translate-x-1 transition-transform" />
              </div>
              <p className="text-sm font-semibold text-zinc-200 leading-snug">
                Type what you want to find. Get real-time directional clock guidance and audio tones.
                <span className="inline-flex items-center ml-2 px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/50 text-[11px] font-black tracking-wider text-amber-300 uppercase align-middle">
                  Directional Guidance
                </span>
              </p>
            </div>
          </div>
        </button>

        {/* 4. WHAT AM I LOOKING AT? (Scene & Hazard Inspector) */}
        <button
          onClick={() => {
            haptic.tapFeedback();
            onSelectView('inspect');
          }}
          className="group w-full min-h-[124px] rounded-3xl border-3 border-emerald-400 bg-gradient-to-r from-zinc-950 via-zinc-900 to-black p-5 text-left transition-all hover:bg-zinc-900 hover:border-emerald-300 active:scale-[0.99] focus-visible:ring-4 focus-visible:ring-emerald-400 shadow-xl"
          aria-label="What Am I Looking At: Scene descriptor, room layouts, walkway clear paths, and trip hazards."
        >
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-emerald-400 text-zinc-950 font-black shadow-md group-hover:scale-105 transition-transform">
              <Eye className="h-9 w-9 stroke-[2.8]" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black tracking-tight text-white group-hover:text-emerald-400 transition-colors">
                  WHAT AM I LOOKING AT?
                </span>
                <ArrowRight className="h-6 w-6 text-emerald-400 opacity-90 group-hover:translate-x-1 transition-transform" />
              </div>
              <p className="text-sm font-semibold text-zinc-200 leading-snug">
                Scene descriptor, room layouts, walkway clear paths, and trip hazard alerts.
              </p>
            </div>
          </div>
        </button>
      </nav>

      {/* Safety Mobility Reminder */}
      <div
        role="note"
        aria-label="Safety notice"
        className="rounded-2xl border-2 border-red-500/60 bg-red-950/40 p-4 text-xs font-semibold text-red-200 flex items-start gap-3 shadow-lg"
      >
        <AlertTriangle className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
        <div className="space-y-1">
          <p className="font-extrabold text-red-300 text-sm">Mobility Safety Notice</p>
          <p className="leading-relaxed">
            Aperture assists with visual and audio awareness, but does NOT replace a white cane or guide dog. Always use your primary mobility aid for steps, drop-offs, and street crossings.
          </p>
        </div>
      </div>

    </div>
  );
};
