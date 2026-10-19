# Voice-First Hands-Free Continuous Conversational Assistant

Transform the assistive visual navigation app into a seamless, voice-first companion with continuous hands-free conversation, fluid turn-taking, real-time live vision grounding, and instant voice navigation.

> [!IMPORTANT]
> **Key Architectural Upgrades for Review**:
> - **Continuous Turn-Taking Loop**: After speaking its response, the assistant automatically plays an earcon chime and reopens listening without requiring the user to press a button, creating an uninterrupted conversational flow.
> - **Live Camera Multimodal Grounding**: Integrates real-time video feed directly into the conversational engine so users can ask "What am I holding?", "Read this label", or "Is the path clear?" without switching screens or snapping manual pictures.
> - **Screen-Wide Touch & Barge-In**: Visually impaired users can tap anywhere on the screen to interrupt the assistant or pause/resume the voice loop, supported by haptic vibration pulses and spatial earcons.

---

### User Review & Critical Decisions

- **Confirmed Decision 1 (User Choice)**: Prioritize voice-first hands-free interaction with a continuous conversational assistant and make the flow significantly smoother.
- **Confirmed Decision 2 (Multimodal Co-pilot)**: Connect the live camera stream directly to the conversational assistant so scene inspection, obstacle checking, and question answering happen naturally in dialogue.
- **Default Choice 3 (Audio Turn-Taking)**: Incorporate automatic silence detection and gentle audio earcons (a subtle chime when the AI starts listening and a low tone when it begins thinking) to guide non-visual users without confusing verbal clutter.

---

### 1. Overview & Core Concept

- **What It Does**: Provides a fluid, hands-free conversational voice experience where visually impaired users can talk freely with an intelligent multimodal assistant. The assistant listens continuously, answers questions about the environment or remembered objects, executes navigation tools via natural spoken commands, and reads text aloud with zero screen navigation required.
- **Target Audience / Persona**: Blind and low-vision individuals navigating home, office, and transit environments who require completely hands-free, reliable auditory feedback and direct verbal interaction.
- **Key Value**: Eliminates the friction of manual screen tapping, repeated button hunting, and disjointed single-turn voice recordings, delivering a smooth, human-like assistive dialogue.

---

### 2. User Experience & Visual Design

#### Key User Flows
1. **Instant Voice Activation**: The user enters the app or taps the prominent bottom action bar; the assistant plays an entry chime and speaks a warm prompt ("Listening. What can I help you find or see?").
2. **Continuous Hands-Free Dialogue**:
   - User speaks naturally (e.g., *"What is sitting on the counter to my right?"*).
   - The microphone automatically detects speech end; a subtle thinking chime sounds.
   - The assistant synthesizes a direct, concise 1-2 sentence response.
   - As soon as the response concludes, a listening chime sounds and the microphone reactivates automatically for follow-ups (e.g., *"Is there a mug next to it?"*).
3. **Multimodal Vision in Chat**:
   - The assistant has a "Live Vision" viewfinder active in the background. When queries require visual context, it grabs the active frame and grounds its reply in real-world spatial orientation (e.g., *"At 1 o'clock, 4 feet ahead, there is an open doorway"*).
4. **Natural Command Execution**:
   - Speaking *"Find my water bottle"* transitions directly to the guided directional compass.
   - Speaking *"Remember this medicine in the bathroom cabinet"* registers the item to memory.
   - Speaking *"Pause"* or *"Stop listening"* suspends the continuous loop.
5. **Screen-Wide Tactile Touch Surface**:
   - Visually impaired users can double-tap anywhere on the viewport to toggle listening or interrupt AI speech (barge-in).

#### Visual Identity & Theme
- **Theme**: Ultra-high contrast deep obsidian background (`#09090b` / `zinc-950`) with vivid high-contrast golden yellow (`#facc15` / `yellow-400`) and emerald green (`#34d399` / `emerald-400`) accents.
- **Typography**: Clean, oversized sans-serif typography (`Plus Jakarta Sans` / system accessible font) with minimum 18px body and 28px headline scale.
- **Fluid Waveform Indicator**: High-visibility animated soundwave ripple that expands dynamically with voice input, providing clear visual status for partially sighted users and screen readers.
- **Zero-Pill Discipline**: All status indicators rendered as clean unboxed typographic labels with clear separators (`Live Vision · Hands-Free Active · Microphone Ready`).

#### Interactive Feedback & Motion
- **Earcon Cues**: Distinct Web Audio frequency chimes for `listen_start` (high ping), `processing` (soft pulse), `answer_ready` (two-tone melodic resolution), and `turn_pause`.
- **Haptic Tactile Feedback**: Light haptic tick on speech detection, double tick on answer start, and warning buzz if network or camera is obstructed.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Continuous Turn-Taking with Event-Driven Speech Synthesis**
  - *Chosen Approach*: Bind `SpeechSynthesisUtterance.onend` directly to the `startVoiceInput` trigger with an automatic 400ms buffer and audio chime.
  - *Why*: Creates a frictionless, natural conversation where the user never has to search for the microphone button between queries.
  - *Alternatives Considered*: Push-to-talk only (burdens visually impaired users with continuous button locating) or continuous open audio stream with server WebSockets (unnecessary bandwidth and battery drain for client browsers).

- **Decision 2: Integrated Live Camera Context within the Conversational Engine**
  - *Chosen Approach*: Maintain a background video element in the chat view that captures an optimized lightweight frame only when visual queries are posed or when live vision mode is active.
  - *Why*: Allows zero-click visual question answering without navigating across separate menus.
  - *Alternatives Considered*: Forcing the user to manually switch to a camera screen first before asking questions.

- **Decision 3: Voice Command Routing & Tool Intent Dispatching**
  - *Chosen Approach*: Natural language intent classifier in `server.ts` extracts tool intentions (`find_object`, `remember_item`, `what_changed`, `read_text`, `inspect_scene`) and returns structured guidance or triggers view transitions seamlessly.
  - *Why*: Enables total hands-free operation of every feature in the app.

---

### 4. Technical Architecture & Data Strategy

#### Architecture & Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    User Voice & Touch Interface                  │
│       (Screen-wide Tap, Barge-in, High-Contrast Soundwave)      │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Speech & Audio Service Layer                  │
│   ┌───────────────────────────┐   ┌───────────────────────────┐  │
│   │ Continuous Recognition    │   │  SpeechSynthesis Manager  │  │
│   │ (Turn-taking loop, VAD)   │   │  (Queue, onend callbacks) │  │
│   └─────────────┬─────────────┘   └─────────────▲─────────────┘  │
│                 │                               │                │
│                 │ Audio Chimes & Earcons        │ Spoken Audio   │
│                 ▼                               │                │
│   ┌─────────────────────────────────────────────┴─────────────┐  │
│   │             Web Audio API Synthesizer (Chimes)            │  │
│   └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│              Gemini Multimodal Conversational Hub               │
│  - Real-time video frame grabber (hidden or visible canvas)      │
│  - Fast intent extraction (find, remember, inspect, change)     │
│  - Conversational memory & spatial clock guidance                │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Backend Express Proxy (/api)                  │
│   - /api/gemini/chat: Conversational memory + vision context    │
│   - /api/gemini/find-object: Directional clock-face locator     │
│   - /api/gemini/inspect-scene: Multimodal hazard & text reader  │
└─────────────────────────────────────────────────────────────────┘
```

#### State & Data Strategy
- **`isContinuousConversation`**: Boolean state governing auto-listening re-engagement.
- **`assistantState`**: `'idle' | 'listening' | 'thinking' | 'speaking' | 'paused'`.
- **`liveVisionActive`**: Stream handle for instant multimodal image attachments during speech.
- **`conversationHistory`**: Message array with timestamps, role, and optional bounding boxes/clock guidance.

#### Interactive Component & State Mapping
- **Tap Anywhere / Space Bar**: Toggles pause/resume of the conversational loop with immediate speech announcement.
- **Barge-in Interrupt**: When user speaks while assistant is talking, `speech.stop()` triggers immediately and captures user utterance.
- **Voice Commands**:
  - *"Find [item]"* -> calls `onLaunchFind([item])` with directional feedback.
  - *"Remember [item]"* -> stores to local memory and speaks confirmation.
  - *"What changed?"* -> analyzes current frame against room baseline.
  - *"Repeat"* -> calls `speech.repeatLastAnnouncement()`.
