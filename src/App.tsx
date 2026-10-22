import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { HomeDashboard } from './components/HomeDashboard';
import { FindItView } from './components/FindItView';
import { ReadTextView } from './components/ReadTextView';
import { WhatAmILookingAtView } from './components/WhatAmILookingAtView';
import { FutureModesModal } from './components/FutureModesModal';
import { SettingsModal } from './components/SettingsModal';
import { UserSettings, SavedItem, FeedbackMethod, AppView } from './types';
import { storageService } from './services/storageService';
import { speech } from './services/speechService';
import { haptic } from './services/hapticService';
import { Compass, FileText, Home as HomeIcon, Eye } from 'lucide-react';

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>('home');
  const [activeFindTarget, setActiveFindTarget] = useState<string>('');

  const [settings, setSettings] = useState<UserSettings>(() => storageService.getSettings());
  const [savedItems] = useState<SavedItem[]>(() => storageService.getItems());

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Sync settings with speech service and document root classes
  useEffect(() => {
    speech.setSpeechRate(settings.speechRate);

    // Apply text size to root html element
    const root = document.documentElement;
    root.classList.remove('font-size-standard', 'font-size-large', 'font-size-xl');
    root.classList.add(`font-size-${settings.textSize}`);

    // Apply theme
    if (settings.theme === 'high-contrast-light') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
    }
  }, [settings]);

  const updateSettings = (partial: Partial<UserSettings>) => {
    const updated = storageService.updateSettings(partial);
    setSettings(updated);
  };

  const handleSelectView = (view: 'find' | 'read' | 'inspect', initialTarget?: string) => {
    setActiveFindTarget(initialTarget ? initialTarget.trim() : '');
    const viewNames: Record<string, string> = {
      read: 'Read Text and Labels',
      find: 'Find It',
      inspect: 'What Am I Looking At',
    };
    if (viewNames[view]) {
      speech.speak(viewNames[view], 'immediate');
    }
    setCurrentView(view);
  };

  const isLight = settings.theme === 'high-contrast-light';

  return (
    <div
      className={`min-h-screen flex flex-col w-full overflow-x-hidden transition-colors ${
        isLight ? 'bg-zinc-100 text-zinc-950' : 'bg-black text-white'
      }`}
    >
      {/* Screen Reader Skip Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-xl focus:bg-yellow-400 focus:px-4 focus:py-3 focus:text-zinc-950 focus:font-black focus:shadow-2xl"
      >
        Skip to main content
      </a>

      {/* Screen Reader Live Region Announcer Container */}
      <div id="aperture-aria-live-announcer" aria-live="polite" aria-atomic="true" className="sr-only" />

      {/* Top Application Header */}
      <Header
        currentView={currentView}
        onNavigateHome={() => setCurrentView('home')}
        settings={settings}
        onUpdateSettings={updateSettings}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenHelp={() => setIsHelpOpen(true)}
      />

      {/* Main Content Area */}
      <main id="main-content" tabIndex={-1} className="flex-1 pb-32 sm:pb-24 outline-none">
        {currentView === 'home' && (
          <HomeDashboard
            onSelectView={handleSelectView}
            settings={settings}
          />
        )}

        {currentView === 'find' && (
          <FindItView
            initialTarget={activeFindTarget}
            onBack={() => setCurrentView('home')}
            settings={settings}
          />
        )}

        {currentView === 'read' && (
          <ReadTextView
            onBack={() => setCurrentView('home')}
            settings={settings}
          />
        )}

        {currentView === 'inspect' && (
          <WhatAmILookingAtView
            onBack={() => setCurrentView('home')}
            settings={settings}
            onLaunchFind={(target) => {
              setActiveFindTarget(target);
              setCurrentView('find');
            }}
          />
        )}
      </main>

      {/* Mobile Fixed Bottom Navigation Bar (Ergonomic Natural Thumb Reach for Visually Impaired) */}
      <nav
        aria-label="Main Navigation Bar"
        className={`fixed bottom-0 left-0 right-0 z-40 border-t ${
          isLight
            ? 'border-zinc-300 bg-white/95 text-zinc-900'
            : 'border-zinc-800 bg-zinc-950/95 text-white'
        } backdrop-blur-md pb-safe`}
      >
        <div className="mx-auto grid max-w-lg grid-cols-4 items-center h-16 px-1">
          {/* 1. Home Tab */}
          <button
            onClick={() => {
              haptic.tapFeedback();
              speech.speak('Home', 'immediate');
              setCurrentView('home');
            }}
            className={`flex flex-col items-center justify-center min-h-[48px] rounded-xl transition-all ${
              currentView === 'home'
                ? 'text-yellow-400 font-extrabold scale-105'
                : 'text-zinc-400 hover:text-white'
            }`}
            aria-label="Home screen"
            aria-current={currentView === 'home' ? 'page' : undefined}
          >
            <HomeIcon className="h-5 w-5" />
            <span className="text-[10px] sm:text-xs tracking-tight mt-0.5 font-bold truncate max-w-full text-center">Home</span>
          </button>

          {/* 2. Read Text & Labels Tab */}
          <button
            onClick={() => {
              haptic.tapFeedback();
              handleSelectView('read');
            }}
            className={`flex flex-col items-center justify-center min-h-[48px] rounded-xl transition-all ${
              currentView === 'read'
                ? 'text-sky-400 font-extrabold scale-105'
                : 'text-zinc-400 hover:text-white'
            }`}
            aria-label="Read Text and Labels mode"
            aria-current={currentView === 'read' ? 'page' : undefined}
          >
            <FileText className="h-5 w-5" />
            <span className="text-[10px] sm:text-xs tracking-tight mt-0.5 font-bold truncate max-w-full text-center">Read</span>
          </button>

          {/* 3. Find It Tab */}
          <button
            onClick={() => {
              haptic.tapFeedback();
              handleSelectView('find');
            }}
            className={`flex flex-col items-center justify-center min-h-[48px] rounded-xl transition-all ${
              currentView === 'find'
                ? 'text-amber-400 font-extrabold scale-105'
                : 'text-zinc-400 hover:text-white'
            }`}
            aria-label="Find It mode"
            aria-current={currentView === 'find' ? 'page' : undefined}
          >
            <Compass className="h-5 w-5" />
            <span className="text-[10px] sm:text-xs tracking-tight mt-0.5 font-bold truncate max-w-full text-center">Find</span>
          </button>

          {/* 4. What Am I Looking At? Tab */}
          <button
            onClick={() => {
              haptic.tapFeedback();
              handleSelectView('inspect');
            }}
            className={`flex flex-col items-center justify-center min-h-[48px] rounded-xl transition-all ${
              currentView === 'inspect'
                ? 'text-emerald-400 font-extrabold scale-105'
                : 'text-zinc-400 hover:text-white'
            }`}
            aria-label="What Am I Looking At mode"
            aria-current={currentView === 'inspect' ? 'page' : undefined}
          >
            <Eye className="h-5 w-5" />
            <span className="text-[10px] sm:text-xs tracking-tight mt-0.5 font-bold truncate max-w-full text-center">Looking At</span>
          </button>
        </div>
      </nav>

      {/* Auxiliary Modals */}
      <FutureModesModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={updateSettings}
      />
    </div>
  );
}
