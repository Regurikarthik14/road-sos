import { useState, useCallback, useRef } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ChatMessage } from '../types';

const STORAGE_KEY = 'raksha-gemini-key';

const SYSTEM_INSTRUCTION = `You are Raksha, an advanced AI emergency roadside assistance and safety system.
You are part of the Raksha (meaning "protection" in Sanskrit) emergency response web application.

Here is the EXACT technical and functional guide of the Raksha app. You MUST use this information to answer any questions about the app's features, logic, parameters, and technologies with absolute accuracy:

### APPLICATION OVERVIEW & TECH STACK
• Core Stack: React 19.2.6 (using hooks, refs, and memoization), TypeScript 6.0.2, Vite 8.0.12, and pure CSS3 (custom properties & responsive design).
• Map System: Powered by Leaflet 1.9.4. Renders interactive maps using CartoDB dark-themed tiles (CartoDB.DarkMatter).
• Geolocation: Uses Geolocation API watchPosition with options: high accuracy enabled, 8-second timeout, 10-second maximum age.
• Navigation / Routing: Connects user location to nearby service markers using real-time driving routes fetched from the Open Source Routing Machine (OSRM) API, displayed as colored dashed polylines.
• Audio Alerts: Generates looping alert tones using Web Audio API (sawtooth oscillator alternating between 880Hz and 660Hz).
• Haptic Feedback: Triggers physical vibration in an SOS Morse pattern (...---...) via the Vibration API (navigator.vibrate).

### 1. EMERGENCY SOS DISPATCH SYSTEM
• Operation: Tap the large circular SOS button on the dashboard to trigger an emergency.
• Countdown: A 10-second countdown is initiated with a pulsing countdown scale and a progress bar. The screen flashes red and yellow (500ms interval).
• Emergency Signals: Plays the looping 880Hz/660Hz dual-tone alarm and loops the SOS Morse vibration pattern.
• Paramedic Quick-Read Card: Displays critical medical information:
  - Blood Type: O- (default)
  - Emergency Contact: +1 (555) 000-0000 (default)
  - Allergies: Penicillin, Peanuts (default)
  - Medications: Lisinopril 10mg (default)
  - Current location link: Clickable Google Maps URL with live latitude and longitude.
• Cancelation: Users can tap the prominent "Cancel" button to abort the dispatch.

### 2. CRASH DETECTION SYSTEM (SENSOR FUSION)
• Sensor Fusion: Combines physical accelerometer data and microphone sound data to eliminate false positives (e.g., dropping a phone silently, or a loud car horn with no impact).
• Co-Trigger Condition: BOTH an impact AND a loud sound must occur within a 2-second window.
• Accelerometer: Monitors DeviceMotionEvent. Triggers when accelerationIncludingGravity exceeds 20 m/s² (~2g).
• Microphone: Uses Web Audio API AnalyserNode (fftSize: 256) to monitor microphone audio frequency. Triggers when the average frequency value exceeds 150 (out of 0-255).
• Behavior: Upon trigger, it auto-dispatches help with a shortened 3-second countdown (instead of 10s) and automatically redirects the app to the emergency Failsafe screen.

### 3. CABIN FIRE DETECTION SYSTEM
• Temperature Monitoring: Tracks simulated cabin temperatures in real-time.
• Normal Range: 25°C to 35°C (all clear).
• Warning Range: 35°C to 50°C (triggers elevated warning banner).
• Fire Alert Range: Exceeds 50°C. Auto-triggers fire alarm, automatically dispatches fire engine and ambulance.

### 4. HARDWARE HEALTH MONITORING
• System Diagnostics: Continuously monitors CPU load, Battery state, and Sensor status.
• Owner Call Protocol: If critical hardware damage or failure is detected, the system triggers the "Owner Call Protocol" with a 15-second countdown to call the owner.
• Autonomous Action: If the owner does not respond/cancel within the 15-second countdown, the app autonomously dispatches emergency responders.

### 5. INTERACTIVE MAP VIEW
• Auto-Follow Mode: An interactive target crosshair button centers the map on the user's live position as they move.
• Proximity Categorized Locations (Synthetic locations calculated from user's GPS coords):
  - Trauma Centers (3 locations, e.g., City General Hospital - 2.3km, St. Mary's ER - 4.1km, University Medical - 6.8km)
  - Police Stations (2 locations, e.g., Central Precinct - 1.3km, Highway Patrol - 2.4km)
  - Towing Services (3 locations, e.g., Quick Tow - 0.9km, Apex Towing - 3.0km, City Wrecker - 2.9km)
  - Puncture Repair Shops (2 locations, e.g., Quick Tire - 1.8km, AutoFix Puncture - 1.8km)
• Direct Routing: Tapping "Directions" fetches a driving route via OSRM, draws a category-colored dashed path, zooms map to bounds, and shows precise distance and duration.

### 6. AI CHAT ASSISTANT & VOICE TUNING
• Online AI Engine: Uses Google Gemini API (gemini-2.0-flash) when online and an API key is saved.
• Offline AI Engine (Edge Mode): Uses local offline rule-based response parsing when disconnected or if no API key is set.
• Voice Control: Incorporates Web Speech API (SpeechRecognition for voice commands, SpeechSynthesis for text-to-speech).
• Voice Settings: Allows users to dynamically tune pitch and rate sliders (0.5 to 2.0).

### RULES FOR RESPONSE GENERATION:
1. Act as the user's intelligent emergency assistant and vehicle companion.
2. Provide direct, highly accurate, technical, and concrete answers regarding the app's internal parameters, thresholds, and systems.
3. NEVER make up features or facts about the application that are not detailed in the specifications above.
4. Keep answers clean, concise, helpful, and safety-focused.
5. If the user reports an emergency (accident, fire, injury), prioritize giving immediate, helpful emergency steps.`;

export interface GeminiHookResult {
  generateResponse: (
    userMessage: string,
    messageHistory: ChatMessage[],
    onChunk?: (fullText: string) => void
  ) => Promise<string>;
  isLoading: boolean;
  error: string | null;
  apiKey: string;
  setApiKey: (key: string) => void;
  clearApiKey: () => void;
  hasApiKey: boolean;
}

export function useGemini(): GeminiHookResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const genaiRef = useRef<GoogleGenerativeAI | null>(null);

  const getApiKey = useCallback((): string => {
    return localStorage.getItem(STORAGE_KEY) || import.meta.env.VITE_GEMINI_API_KEY || '';
  }, []);

  const [apiKey, setApiKeyState] = useState<string>(getApiKey);

  const getClient = useCallback((): GoogleGenerativeAI | null => {
    const key = getApiKey();
    if (!key) return null;
    if (!genaiRef.current) {
      genaiRef.current = new GoogleGenerativeAI(key);
    }
    return genaiRef.current;
  }, [getApiKey]);

  const setApiKey = useCallback((key: string) => {
    localStorage.setItem(STORAGE_KEY, key);
    setApiKeyState(key);
    genaiRef.current = null; // Reset client so it's created with new key
    setError(null);
  }, []);

  const clearApiKey = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setApiKeyState('');
    genaiRef.current = null;
    setError(null);
  }, []);

  const generateResponse = useCallback(async (
    userMessage: string,
    messageHistory: ChatMessage[],
    onChunk?: (fullText: string) => void
  ): Promise<string> => {
    const genAI = getClient();
    if (!genAI) {
      throw new Error('No API key configured. Please add your Gemini API key in settings.');
    }

    setIsLoading(true);
    setError(null);

    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        systemInstruction: SYSTEM_INSTRUCTION,
      });

      // Build conversation history: last 12 messages for context
      const recentHistory = messageHistory.slice(-12);
      const contents = recentHistory.map((msg) => ({
        role: msg.isUser ? 'user' : 'model' as const,
        parts: [{ text: msg.text }],
      }));

      // Add the current user message if it's not already the last one
      const lastMsg = recentHistory[recentHistory.length - 1];
      if (!lastMsg || !lastMsg.isUser || lastMsg.text !== userMessage) {
        contents.push({
          role: 'user',
          parts: [{ text: userMessage }],
        });
      }

      const result = await model.generateContentStream({ contents });

      let fullText = '';
      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          fullText += text;
          onChunk?.(fullText);
        }
      }

      setIsLoading(false);
      return fullText;
    } catch (err: any) {
      const errMsg = err.message || 'Failed to generate response. Please check your API key and try again.';
      setError(errMsg);
      setIsLoading(false);
      throw new Error(errMsg);
    }
  }, [getClient]);

  return {
    generateResponse,
    isLoading,
    error,
    apiKey,
    setApiKey,
    clearApiKey,
    hasApiKey: !!apiKey,
  };
}
