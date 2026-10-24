# Aperture — Visual Environment Companion

> A focused, camera-based visual assistant for people who are blind or have low vision.  
> **Read → Find → Understand.**

[Try the live app](https://aperture-visual-environment-companion.ai.studio/)

## What is Aperture?

Aperture is intentionally simple and task-focused. It uses a phone camera and multimodal AI to help a person handle three everyday visual tasks with clear spoken feedback:

1. **Read text and labels**
2. **Find a specific item**
3. **Understand the space directly ahead**

Instead of asking users to sort through a long list of modes or train the app on objects first, Aperture begins with the task they need to complete now.

## Core tools

### Read Text & Labels

Point the camera at a package, medication label, sign, document, or mail. Aperture provides a short spoken overview first, then offers the exact text word-for-word when needed.

This keeps quick tasks quick while still making detailed label information available.

### Find It

Type the item you want to locate—such as keys, a water bottle, a chair, or a door. Aperture looks through the camera view and provides real-time guidance using:

- Clock-face direction
- Approximate distance
- Spoken guidance and audio tones
- A clear cue when the target is centered

The goal is immediate, target-based finding without needing object training or a saved-item library.

### What Am I Looking At?

Scan the scene in front of you to hear a concise explanation of the room or walkway. Aperture can describe the layout, recognizable landmarks, visible text, and possible trip hazards so the user has clearer context for the space directly ahead.

## Accessibility by design

Aperture is built around a low-friction, mobile-first interface:

- High-contrast visual design
- Large, easy-to-reach controls
- Semantic navigation and a skip-to-content link for screen readers
- Live status announcements
- Spoken feedback with repeat and mute controls
- Audio tones and vibration cues for guidance
- A persistent mobile navigation bar for fast tool switching

The experience is camera-first: users choose a tool, point their camera, and receive focused feedback without an onboarding flow or voice-command setup.

## Safety note

Aperture supports visual and audio awareness; it is **not** a replacement for a white cane, guide dog, orientation and mobility training, or careful judgment around steps, drop-offs, and street crossings.

## Technology

- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Server:** Node.js and Express
- **AI vision:** Google GenAI SDK for OCR, object recognition, and scene analysis
- **Feedback:** Web Speech API, Web Audio API, and Vibration API
- **Deployment:** Google AI Studio

## Run locally

### 1. Clone the repository

```bash
git clone https://github.com/jshirmo/Aperture_.git
cd Aperture_
```

### 2. Install dependencies

```bash
npm install
```

### 3. Add environment variables

Create a `.env` file based on `.env.example` and add a Gemini API key:

```env
GEMINI_API_KEY="your-gemini-api-key"
```

### 4. Start the app

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

### Production build

```bash
npm run build
NODE_ENV=production npm start
```

## Project context

Aperture was created as a mobile AI project that combines a phone camera with multimodal AI to make everyday visual tasks clearer, simpler, and safer for people with severe low vision.
