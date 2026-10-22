/**
 * Aura Accessible Speech & Audio Service
 * Handles text-to-speech, screen-reader live announcements,
 * and resilient multi-tier voice input:
 *   Tier 1: Synchronous Web Speech API (instant local transcription)
 *   Tier 2: MediaRecorder fallback audio capture (for restricted iframes or browsers)
 *   Tactile audio chimes for starting and stopping microphone capture
 */

class SpeechService {
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private lastSpokenText: string = '';
  private lastSpokenTime: number = 0;
  private speechRate: number = 1.0;
  private isMuted: boolean = false;
  private isListeningActive: boolean = false;
  private audioCtx: AudioContext | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
    }
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  /**
   * Play clean tactile sound cues for visually impaired feedback
   */
  playChime(type: 'start' | 'success' | 'stop' | 'error' | 'aligned' | 'proximity' | 'hazard' | 'liveStart' | 'liveStop' | 'ping' | 'listen' | 'thinking') {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      if (type === 'listen') {
        // Uplifting warm two-tone listening prompt: 540Hz -> 760Hz
        osc.type = 'sine';
        osc.frequency.setValueAtTime(540, now);
        osc.frequency.exponentialRampToValueAtTime(760, now + 0.12);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.22);
      } else if (type === 'thinking') {
        // Subtle soft processing tone: 440Hz -> 360Hz
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(360, now + 0.12);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.18);
      } else if (type === 'start') {
        // Upbeat gentle two-tone chirp: 480Hz -> 640Hz
        osc.type = 'sine';
        osc.frequency.setValueAtTime(480, now);
        osc.frequency.exponentialRampToValueAtTime(640, now + 0.12);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.22);
      } else if (type === 'success') {
        // High harmonic double ping: 640Hz -> 960Hz
        osc.type = 'sine';
        osc.frequency.setValueAtTime(640, now);
        osc.frequency.exponentialRampToValueAtTime(960, now + 0.15);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.start(now);
        osc.stop(now + 0.28);
      } else if (type === 'stop') {
        // Soft down tone: 600Hz -> 380Hz
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(380, now + 0.14);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === 'aligned') {
        // Centered / 12 o'clock alignment pleasant bell chime: 780Hz -> 1040Hz
        osc.type = 'sine';
        osc.frequency.setValueAtTime(780, now);
        osc.frequency.exponentialRampToValueAtTime(1040, now + 0.16);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
        osc.start(now);
        osc.stop(now + 0.32);
      } else if (type === 'proximity') {
        // Quick high proximity ping: 880Hz
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'hazard') {
        // Double low alert buzzer: 220Hz saw/triangle
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, now);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'liveStart') {
        // Ascending 3-tone arpeggio: 440 -> 660 -> 880Hz
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.25);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'liveStop') {
        // Descending 2-tone: 660 -> 330Hz
        osc.type = 'sine';
        osc.frequency.setValueAtTime(660, now);
        osc.frequency.exponentialRampToValueAtTime(330, now + 0.2);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.start(now);
        osc.stop(now + 0.28);
      } else if (type === 'ping') {
        // Gentle radar sonar pulse: 550Hz
        osc.type = 'sine';
        osc.frequency.setValueAtTime(550, now);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      } else {
        // Gentle low bump: 260Hz
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(260, now);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      }
    } catch (err) {
      console.warn('Audio chime note error:', err);
    }
  }

  repeatLastGuidance() {
    if (this.lastSpokenText) {
      this.playChime('ping');
      this.speak(this.lastSpokenText, 'immediate', true);
    } else {
      this.speak('No previous announcement to repeat.', 'immediate', true);
    }
  }

  repeatLastAnnouncement() {
    this.repeatLastGuidance();
  }

  getLastSpokenText(): string {
    return this.lastSpokenText;
  }

  setSpeechRate(rate: number) {
    this.speechRate = Math.max(0.7, Math.min(1.5, rate));
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      this.stop();
    }
  }

  isSpeechMuted(): boolean {
    return this.isMuted;
  }

  isListening(): boolean {
    return this.isListeningActive;
  }

  /**
   * Speak a concise directional guidance instruction or confirmation.
   * Enforces a strict speak-once policy: suppresses immediate duplicate speech,
   * debounces rapid overlapping triggers, and cleanly cancels in-flight speech.
   */
  speak(text: string, priority: 'immediate' | 'queue' = 'immediate', force = false, onEnd?: () => void) {
    if (!text || this.isMuted) {
      onEnd?.();
      return;
    }

    // If microphone is actively recording user voice, do NOT speak over the mic unless forced
    if (this.isListeningActive && !force) {
      console.log('Skipping speech during active voice listening:', text);
      onEnd?.();
      return;
    }

    const cleanText = text.trim();
    const now = Date.now();

    // Strict duplicate check: if the exact same phrase was spoken within 8 seconds and not forced repeat, skip
    if (!force && cleanText.toLowerCase() === this.lastSpokenText.toLowerCase() && now - this.lastSpokenTime < 8000) {
      onEnd?.();
      return;
    }

    // Debounce rapid overlapping calls within 300ms unless forced
    if (!force && now - this.lastSpokenTime < 300) {
      onEnd?.();
      return;
    }

    this.lastSpokenText = cleanText;
    this.lastSpokenTime = now;

    // Update screen reader live region once
    this.announceToScreenReader(cleanText, priority === 'immediate' ? 'assertive' : 'polite');

    if (!this.synth) {
      onEnd?.();
      return;
    }

    try {
      // Unfreeze browser speech engine if paused
      if (this.synth.paused) {
        this.synth.resume();
      }

      // Cancel any ongoing utterance to ensure the new announcement speaks cleanly once
      if (priority === 'immediate' || this.synth.speaking) {
        this.synth.cancel();
        this.currentUtterance = null;
      }

      // Small 30ms breather after cancel to prevent Chrome speech synthesis clipping bug
      setTimeout(() => {
        if (!this.synth || this.isMuted) {
          onEnd?.();
          return;
        }

        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = this.speechRate;
        utterance.pitch = 1.0;

        // Select preferred voice if available (high quality English)
        const voices = this.synth.getVoices();
        const preferred = voices.find(
          (v) =>
            (v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Google') || v.name.includes('Daniel')) &&
            v.lang.startsWith('en')
        );
        if (preferred) {
          utterance.voice = preferred;
        }

        let hasEnded = false;
        const fireEnd = () => {
          if (!hasEnded) {
            hasEnded = true;
            if (this.currentUtterance === utterance) {
              this.currentUtterance = null;
            }
            onEnd?.();
          }
        };

        utterance.onend = () => {
          fireEnd();
        };

        utterance.onerror = (e) => {
          // 'interrupted' or 'canceled' happens normally when replaced
          if (e.error !== 'interrupted' && e.error !== 'canceled') {
            console.warn('SpeechSynthesis utterance event:', e.error);
          }
          fireEnd();
        };

        // Safety fallback timeout in case browser drops onend
        const wordCount = cleanText.split(/\s+/).length;
        const fallbackMs = Math.max(1200, (wordCount / (this.speechRate * 2.4)) * 1000 + 1200);
        setTimeout(() => {
          fireEnd();
        }, fallbackMs);

        this.currentUtterance = utterance;
        this.synth.speak(utterance);
      }, 30);
    } catch (err) {
      console.warn('SpeechSynthesis error:', err);
      onEnd?.();
    }
  }

  stop() {
    if (this.synth) {
      try {
        this.synth.cancel();
        this.currentUtterance = null;
      } catch {}
    }
  }

  /**
   * Screen reader accessibility announcer (aria-live region)
   */
  announceToScreenReader(message: string, politeness: 'polite' | 'assertive' = 'polite') {
    if (typeof document === 'undefined') return;

    let announcer = document.getElementById('aperture-aria-live-announcer');
    if (!announcer) {
      announcer = document.createElement('div');
      announcer.id = 'aperture-aria-live-announcer';
      announcer.className = 'sr-only';
      announcer.setAttribute('aria-atomic', 'true');
      document.body.appendChild(announcer);
    }

    announcer.setAttribute('aria-live', politeness);
    announcer.textContent = '';
    setTimeout(() => {
      if (announcer) {
        announcer.textContent = message;
      }
    }, 50);
  }

  /**
   * Check if native browser speech recognition is available
   */
  isRecognitionSupported(): boolean {
    return false;
  }

  /**
   * Voice input is disabled - no microphone permissions requested
   */
  startVoiceInput(
    _onResult: (transcript: string) => void,
    onError: (err: string) => void,
    _onInterim?: (interim: string) => void,
    _onAudioBlobReady?: (base64Audio: string, mimeType: string) => void,
    onTurnEnd?: (hadResult: boolean) => void
  ): () => void {
    onError('Microphone input is disabled.');
    onTurnEnd?.(false);
    return () => {};
  }
}

export const speech = new SpeechService();
