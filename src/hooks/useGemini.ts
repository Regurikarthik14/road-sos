import { useState, useCallback, useRef } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ChatMessage } from '../types';

const STORAGE_KEY = 'raksha-gemini-key';

const SYSTEM_INSTRUCTION = `You are Raksha, an advanced AI emergency roadside assistance and safety system.
You are part of the Raksha (meaning "protection" in Sanskrit) system that provides the following services:

CAPABILITIES:
• Emergency dispatch: Trauma centers, Police, Towing, Puncture repair
• Fire detection & reporting: Monitors temperature, auto-dispatches fire engine + ambulance
• Hardware health monitoring: CPU, Battery, Sensor health tracking with owner-call protocol
• Crash detection & response: Auto-detects crashes and dispatches help
• Voice interaction: Users can speak to you and you can speak back
• GPS location tracking: Real-time location monitoring

RULES:
1. Be concise, helpful, and safety-focused in your responses.
2. If the user reports an emergency (accident, fire, crash, injury), respond URGENTLY with clear step-by-step instructions.
3. If you don't know something, admit it rather than making up information.
4. Keep responses under 200 words unless the situation requires more detail.
5. Use emojis sparingly but appropriately for emergencies 🚨 and key information.
6. Always prioritize user safety above all else.
7. You can operate in "Edge AI" mode when offline — but your responses will be limited.
8. The user's current location is tracked via GPS and available if they ask about it.`;

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
