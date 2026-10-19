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

    let announcer = document.getElementById('aura-aria-live-announcer');
    if (!announcer) {
      announcer = document.createElement('div');
      announcer.id = 'aura-aria-live-announcer';
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
    if (typeof window === 'undefined') return false;
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  }

  /**
   * Start listening for voice input.
   * Uses native Web Speech API synchronously, and falls back to MediaRecorder
   * if the browser blocks Google speech servers or if SpeechRecognition throws network/permission errors.
   */
  startVoiceInput(
    onResult: (transcript: string) => void,
    onError: (err: string) => void,
    onInterim?: (interim: string) => void,
    onAudioBlobReady?: (base64Audio: string, mimeType: string) => void,
    onTurnEnd?: (hadResult: boolean) => void
  ): () => void {
    if (typeof window === 'undefined') {
      onError('Not supported in this environment');
      onTurnEnd?.(false);
      return () => {};
    }

    // Stop ongoing speech so microphone doesn't hear itself
    this.stop();
    this.isListeningActive = true;
    this.playChime('listen');

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    let cleanupFn = () => {};
    let isHandled = false;

    // Helper to start MediaRecorder recording as robust fallback with voice activity detection
    const startMediaRecorderFallback = () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        this.isListeningActive = false;
        this.playChime('error');
        onError('Microphone hardware access not supported in this browser.');
        return;
      }

      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          let chunks: Blob[] = [];
          let mime = 'audio/webm';
          if (!MediaRecorder.isTypeSupported('audio/webm')) {
            mime = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '';
          }

          const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
          mime = recorder.mimeType || mime || 'audio/webm';

          recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
              chunks.push(e.data);
            }
          };

          // AudioContext VAD (Voice Activity Detection) to stop recording as soon as user finishes speaking
          let audioCtx: AudioContext | null = null;
          let silenceTimer: NodeJS.Timeout | null = null;
          let hasHeardSpeech = false;
          let animFrame: number | null = null;

          try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContextClass) {
              audioCtx = new AudioContextClass();
              const source = audioCtx.createMediaStreamSource(stream);
              const analyser = audioCtx.createAnalyser();
              analyser.fftSize = 256;
              source.connect(analyser);

              const bufferLength = analyser.frequencyBinCount;
              const dataArray = new Uint8Array(bufferLength);

              const checkAudioLevel = () => {
                if (recorder.state !== 'recording') return;
                analyser.getByteFrequencyData(dataArray);

                let sum = 0;
                for (let i = 0; i < bufferLength; i++) {
                  sum += dataArray[i];
                }
                const average = sum / bufferLength;

                // Speech detection threshold
                if (average > 14) {
                  hasHeardSpeech = true;
                  if (silenceTimer) {
                    clearTimeout(silenceTimer);
                    silenceTimer = null;
                  }
                } else if (hasHeardSpeech) {
                  // User spoke, now paused/silent for 650ms: stop recording immediately
                  if (!silenceTimer) {
                    silenceTimer = setTimeout(() => {
                      if (recorder.state === 'recording') {
                        this.playChime('stop');
                        try {
                          recorder.stop();
                        } catch {}
                      }
                    }, 650);
                  }
                }

                animFrame = requestAnimationFrame(checkAudioLevel);
              };

              animFrame = requestAnimationFrame(checkAudioLevel);
            }
          } catch (e) {
            console.warn('AudioContext VAD unavailable:', e);
          }

          recorder.onstop = () => {
            if (animFrame) cancelAnimationFrame(animFrame);
            if (silenceTimer) clearTimeout(silenceTimer);
            if (audioCtx) {
              try {
                audioCtx.close();
              } catch {}
            }

            this.isListeningActive = false;
            stream.getTracks().forEach((t) => t.stop());

            if (chunks.length === 0) {
              onError('No audio recorded');
              return;
            }

            const blob = new Blob(chunks, { type: mime });
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64 = reader.result as string;
              if (onAudioBlobReady) {
                onAudioBlobReady(base64, mime);
              } else {
                onError('Voice audio captured. Processing with AI...');
              }
            };
            reader.readAsDataURL(blob);
          };

          recorder.start();

          // Auto-stop maximum safety timeout reduced to 2.8 seconds
          const autoTimer = setTimeout(() => {
            if (recorder.state === 'recording') {
              this.playChime('stop');
              try {
                recorder.stop();
              } catch {}
            }
          }, 2800);

          cleanupFn = () => {
            clearTimeout(autoTimer);
            if (animFrame) cancelAnimationFrame(animFrame);
            if (silenceTimer) clearTimeout(silenceTimer);
            if (audioCtx) {
              try {
                audioCtx.close();
              } catch {}
            }
            if (recorder.state === 'recording') {
              try {
                this.playChime('stop');
                recorder.stop();
              } catch {}
            }
            stream.getTracks().forEach((t) => t.stop());
            this.isListeningActive = false;
          };
        })
        .catch((err) => {
          this.isListeningActive = false;
          this.playChime('error');
          console.warn('Microphone access denied:', err);
          onError('Microphone permission denied. Tap a quick prompt below or enable microphone permissions.');
        });
    };

    // If SpeechRecognition is supported, try it directly
    if (SpeechRec) {
      try {
        const recognition = new SpeechRec();
        recognition.continuous = false;
        recognition.interimResults = true; // Always enable interim results for ultra-fast streaming
        recognition.lang = 'en-US';
        recognition.maxAlternatives = 1;

        let interimSilenceTimer: NodeJS.Timeout | null = null;
        let latestCandidate = '';

        recognition.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const item = event.results[i];
            if (item.isFinal) {
              finalTranscript += item[0].transcript;
            } else {
              interimTranscript += item[0].transcript;
            }
          }

          const combined = (finalTranscript || interimTranscript).trim();
          if (combined) {
            latestCandidate = combined;
          }

          // Show streaming recognized text with zero delay
          if (interimTranscript && onInterim) {
            onInterim(interimTranscript);
          }

          // If a final result was delivered by the engine, conclude immediately
          if (finalTranscript.trim()) {
            if (interimSilenceTimer) clearTimeout(interimSilenceTimer);
            isHandled = true;
            this.isListeningActive = false;
            this.playChime('success');
            try {
              recognition.stop();
            } catch {}
            onResult(finalTranscript.trim());
            return;
          }

          // Fast interim-to-final promotion: if interim words have arrived and user stops speaking
          // for 700ms, finalize immediately without waiting 2-3 seconds for browser engine timeout
          if (latestCandidate.length > 1) {
            if (interimSilenceTimer) clearTimeout(interimSilenceTimer);
            interimSilenceTimer = setTimeout(() => {
              if (!isHandled && latestCandidate.trim()) {
                isHandled = true;
                this.isListeningActive = false;
                this.playChime('success');
                try {
                  recognition.stop();
                } catch {}
                onResult(latestCandidate.trim());
              }
            }, 700);
          }
        };

        recognition.onerror = (event: any) => {
          if (interimSilenceTimer) clearTimeout(interimSilenceTimer);
          const errType = event.error;
          console.warn('SpeechRecognition error:', errType);

          if (errType === 'no-speech') {
            return;
          }

          if (errType === 'aborted') {
            return;
          }

          // If network or permission error, switch automatically to MediaRecorder
          if ((errType === 'network' || errType === 'not-allowed' || errType === 'service-not-allowed') && onAudioBlobReady) {
            console.log('Falling back to MediaRecorder audio capture...');
            try {
              recognition.abort();
            } catch {}
            startMediaRecorderFallback();
            return;
          }

          this.isListeningActive = false;
          this.playChime('error');
          if (errType === 'not-allowed') {
            onError('Microphone permission not granted in browser settings.');
          } else {
            onError(`Voice input error: ${errType}`);
          }
        };

        recognition.onend = () => {
          if (interimSilenceTimer) clearTimeout(interimSilenceTimer);
          this.isListeningActive = false;
          if (!isHandled && latestCandidate.trim()) {
            isHandled = true;
            this.playChime('success');
            onResult(latestCandidate.trim());
            return;
          }
          if (onTurnEnd) {
            onTurnEnd(isHandled);
          }
        };

        recognition.start();

        cleanupFn = () => {
          if (interimSilenceTimer) clearTimeout(interimSilenceTimer);
          isHandled = true;
          this.isListeningActive = false;
          try {
            recognition.abort();
          } catch {}
        };

        return () => cleanupFn();
      } catch (err: any) {
        console.warn('SpeechRecognition initialization error:', err);
        if (onAudioBlobReady) {
          startMediaRecorderFallback();
          return () => cleanupFn();
        }
        this.isListeningActive = false;
        onError(err.message || 'Speech recognition initialization failed');
        return () => {};
      }
    } else {
      // SpeechRecognition not supported in browser, use MediaRecorder
      if (onAudioBlobReady) {
        startMediaRecorderFallback();
        return () => cleanupFn();
      } else {
        this.isListeningActive = false;
        onError('Speech recognition not available. Please type the item name.');
        return () => {};
      }
    }
  }
}

export const speech = new SpeechService();
