import React, { useState, useEffect } from 'react';
import {
  Menu,
  X,
  Volume2,
  VolumeX,
  Eye,
  HelpCircle,
  Settings as SettingsIcon,
} from 'lucide-react';
import { UserSettings, TextSize } from '../types';
import { speech } from '../services/speechService';
import { haptic } from '../services/hapticService';

interface HeaderProps {
  currentView: 'home' | 'find' | 'read' | 'inspect';
  onNavigateHome: () => void;
  settings: UserSettings;
  onUpdateSettings: (partial: Partial<UserSettings>) => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onNavigateHome,
  settings,
  onUpdateSettings,
  onOpenSettings,
  onOpenHelp,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Close menu on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMenuOpen) {
        setIsMenuOpen(false);
        speech.speak('Menu closed', 'immediate', true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMenuOpen]);

  const toggleMenu = () => {
    haptic.tapFeedback();
    const nextState = !isMenuOpen;
    setIsMenuOpen(nextState);
    speech.speak(nextState ? 'Menu opened' : 'Menu closed', 'immediate', true);
  };

  const toggleMute = () => {
    haptic.tapFeedback();
    const newMuted = !speech.isSpeechMuted();
    speech.setMuted(newMuted);
    onUpdateSettings({ soundEffects: !newMuted });
    speech.speak(newMuted ? 'Audio muted' : 'Audio guidance active', 'immediate', true);
  };

  const toggleContrast = () => {
    haptic.tapFeedback();
    const nextTheme = settings.theme === 'high-contrast-dark' ? 'high-contrast-light' : 'high-contrast-dark';
    onUpdateSettings({ theme: nextTheme });
    speech.speak(`Switched to ${nextTheme === 'high-contrast-dark' ? 'Dark' : 'Light'} theme`, 'immediate', true);
  };

  const isHome = currentView === 'home';

  return (
    <header
      role="banner"
      className="sticky top-0 z-40 w-full border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-md px-3 sm:px-4 py-2.5 sm:py-3 text-white"
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        {/* Left: Logo and Name */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={() => {
              haptic.tapFeedback();
              onNavigateHome();
              setIsMenuOpen(false);
              if (!isHome) {
                speech.speak('Returned to home screen', 'immediate', true);
              }
            }}
            className="flex items-center gap-2 sm:gap-3 rounded-xl p-1 font-bold tracking-tight text-yellow-400 hover:text-yellow-300 focus-visible:ring-2 focus-visible:ring-yellow-400 min-w-0 text-left"
            aria-label="Aperture Home, return to main screen"
          >
            <img
              src="/assets/aistudio/image_eff76819_4ddf1407.jpg"
              alt="Aperture Icon"
              className="h-9 w-9 sm:h-10 sm:w-10 rounded-full object-cover border-2 border-yellow-400 shadow-md shrink-0"
            />
            <div className="flex flex-col text-left min-w-0">
              <span className="text-lg sm:text-xl font-extrabold tracking-wider leading-none text-white truncate">
                APERTURE
              </span>
              <span className="text-[10px] sm:text-[11px] font-medium tracking-wide text-zinc-400">
                Visual Companion
              </span>
            </div>
          </button>
        </div>

        {/* Right: High-Contrast 3-Line Menu Button */}
        <div className="relative">
          <button
            onClick={toggleMenu}
            aria-expanded={isMenuOpen}
            aria-controls="aperture-header-menu"
            className={`flex min-h-[46px] min-w-[46px] sm:min-h-[48px] sm:min-w-[48px] items-center justify-center gap-2 rounded-2xl border-2 px-3 py-2 transition-all shadow-xl active:scale-95 focus-visible:ring-4 focus-visible:ring-yellow-400 ${
              isMenuOpen
                ? 'bg-yellow-400 text-zinc-950 border-yellow-300 font-black'
                : 'bg-yellow-400 text-zinc-950 border-yellow-300 font-extrabold hover:bg-yellow-300'
            }`}
            aria-label={isMenuOpen ? 'Close menu' : 'Open 3-line menu'}
            title={isMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {isMenuOpen ? (
              <X className="h-6 w-6 stroke-[3]" />
            ) : (
              <Menu className="h-6 w-6 stroke-[3]" />
            )}
            <span className="text-xs sm:text-sm font-black uppercase tracking-wider hidden xs:inline">
              Menu
            </span>
          </button>

          {/* Backdrop for outside click */}
          {isMenuOpen && (
            <div
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs"
              aria-hidden="true"
            />
          )}

          {/* High-Contrast Dropdown Menu containing all controls */}
          {isMenuOpen && (
            <div
              id="aperture-header-menu"
              role="dialog"
              aria-label="Aperture Menu"
              className="absolute right-0 top-full mt-2 w-[calc(100vw-1.5rem)] sm:w-96 max-w-sm rounded-3xl border-3 border-yellow-400 bg-zinc-950 p-4 sm:p-5 shadow-2xl z-50 text-white space-y-4"
            >
              {/* Menu Title Header */}
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-yellow-400 animate-pulse" />
                  <h2 className="text-xs font-black uppercase tracking-widest text-yellow-400">
                    Menu &amp; Quick Controls
                  </h2>
                </div>
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white"
                  aria-label="Close menu"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* 1. Text Size Selector */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-zinc-300 uppercase tracking-wide">
                  Text Scaling Size:
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {(['standard', 'large', 'xl'] as TextSize[]).map((size) => {
                    const isSelected = settings.textSize === size;
                    return (
                      <button
                        key={size}
                        onClick={() => {
                          haptic.tapFeedback();
                          onUpdateSettings({ textSize: size });
                          speech.speak(`Text size set to ${size}`, 'immediate', true);
                        }}
                        className={`min-h-[44px] rounded-xl text-xs font-black transition-all flex flex-col items-center justify-center ${
                          isSelected
                            ? 'bg-yellow-400 text-zinc-950 shadow-md ring-2 ring-yellow-400'
                            : 'border border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white'
                        }`}
                      >
                        <span>{size === 'standard' ? 'Standard' : size === 'large' ? 'Large' : 'Extra Lg'}</span>
                        <span className="text-[10px] opacity-80 uppercase">
                          {size === 'standard' ? '1x' : size === 'large' ? '2x' : '3x'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. High Contrast Theme Toggle */}
              <button
                onClick={toggleContrast}
                className="w-full min-h-[50px] rounded-2xl border border-zinc-800 bg-zinc-900 p-3.5 flex items-center justify-between text-left hover:bg-zinc-850 hover:border-zinc-700 active:scale-[0.99] transition-all"
                aria-label={`Toggle theme. Currently ${settings.theme === 'high-contrast-dark' ? 'Dark' : 'Light'}.`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-yellow-400/20 text-yellow-400 border border-yellow-400/40">
                    <Eye className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-white">High Contrast Theme</p>
                    <p className="text-xs text-zinc-400">
                      {settings.theme === 'high-contrast-dark' ? 'Dark Mode (Active)' : 'Light Mode (Active)'}
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-zinc-800 text-[11px] font-bold text-yellow-400 border border-zinc-700">
                  Switch
                </span>
              </button>

              {/* 3. Audio Guidance Toggle */}
              <button
                onClick={toggleMute}
                className={`w-full min-h-[50px] rounded-2xl border p-3.5 flex items-center justify-between text-left transition-all active:scale-[0.99] ${
                  speech.isSpeechMuted()
                    ? 'border-red-500/50 bg-red-950/30 hover:bg-red-950/50'
                    : 'border-zinc-800 bg-zinc-900 hover:bg-zinc-850 hover:border-zinc-700'
                }`}
                aria-label={speech.isSpeechMuted() ? 'Audio guidance is muted. Tap to enable speech.' : 'Audio guidance is active. Tap to mute.'}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
                      speech.isSpeechMuted()
                        ? 'bg-red-500/20 text-red-400 border-red-500/40'
                        : 'bg-emerald-400/20 text-emerald-400 border-emerald-400/40'
                    }`}
                  >
                    {speech.isSpeechMuted() ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-white">Audio Guidance</p>
                    <p className="text-xs text-zinc-400">
                      {speech.isSpeechMuted() ? 'Muted / Silent' : 'Speech & Chimes On'}
                    </p>
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                    speech.isSpeechMuted()
                      ? 'bg-red-900/50 text-red-300 border-red-700/60'
                      : 'bg-emerald-900/50 text-emerald-300 border-emerald-700/60'
                  }`}
                >
                  {speech.isSpeechMuted() ? 'Unmute' : 'Mute'}
                </span>
              </button>

              {/* 4. App User Guide */}
              <button
                onClick={() => {
                  haptic.tapFeedback();
                  setIsMenuOpen(false);
                  onOpenHelp();
                }}
                className="w-full min-h-[50px] rounded-2xl border border-zinc-800 bg-zinc-900 p-3.5 flex items-center justify-between text-left hover:bg-zinc-850 hover:border-zinc-700 active:scale-[0.99] transition-all"
                aria-label="Open App User Guide"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-400/20 text-sky-400 border border-sky-400/40">
                    <HelpCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-white">App User Guide</p>
                    <p className="text-xs text-zinc-400">Instructions &amp; tips for using Aperture</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-sky-400">Open &rarr;</span>
              </button>

              {/* 5. Settings & Privacy */}
              <button
                onClick={() => {
                  haptic.tapFeedback();
                  setIsMenuOpen(false);
                  onOpenSettings();
                }}
                className="w-full min-h-[50px] rounded-2xl border border-zinc-800 bg-zinc-900 p-3.5 flex items-center justify-between text-left hover:bg-zinc-850 hover:border-zinc-700 active:scale-[0.99] transition-all"
                aria-label="Open Settings and Privacy"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400/20 text-amber-400 border border-amber-400/40">
                    <SettingsIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-white">Settings &amp; Privacy</p>
                    <p className="text-xs text-zinc-400">Speech rate, feedback &amp; data</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-amber-400">Open &rarr;</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
