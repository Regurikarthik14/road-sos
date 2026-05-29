import { useState, useCallback, useRef } from 'react';

export type VoiceStatus = 'idle' | 'listening' | 'speaking' | 'error';

interface VoiceOptions {
  onResult?: (text: string) => void;
  onError?: (error: string) => void;
}

export function useVoice({ onResult, onError }: VoiceOptions = {}) {
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle');
  const [voicePitch, setVoicePitch] = useState(1);
  const [voiceRate, setVoiceRate] = useState(1);
  const recognitionRef = useRef<any>(null);

  // --- Speech-to-Text ---
  const startListening = useCallback(() => {
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setVoiceStatus('error');
      onError?.('Speech recognition not supported in this browser');
      return;
    }

    const recognition: any = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setVoiceStatus('listening');
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onResult?.(transcript);
      setVoiceStatus('idle');
    };

    recognition.onerror = (event: any) => {
      setVoiceStatus('error');
      onError?.(event.error);
    };

    recognition.onend = () => {
      setVoiceStatus(prev => prev === 'listening' ? 'idle' : prev);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [onResult, onError]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setVoiceStatus('idle');
  }, []);

  // --- Text-to-Speech ---
  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) {
      onError?.('Speech synthesis not supported');
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = voiceRate;
    utterance.pitch = voicePitch;
    utterance.volume = 1;

    utterance.onstart = () => setVoiceStatus('speaking');
    utterance.onend = () => setVoiceStatus('idle');
    utterance.onerror = () => setVoiceStatus('error');

    window.speechSynthesis.speak(utterance);
  }, [voiceRate, voicePitch, onError]);

  const stopSpeaking = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setVoiceStatus('idle');
  }, []);

  return {
    voiceStatus,
    voicePitch,
    voiceRate,
    setVoicePitch,
    setVoiceRate,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  };
}
