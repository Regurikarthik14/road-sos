import { useState, useCallback, useRef } from 'react';

export type VoiceStatus = 'idle' | 'listening' | 'speaking' | 'error';

interface VoiceOptions {
  onResult?: (text: string) => void;
  onError?: (error: string) => void;
}

export function useVoice({ onResult, onError }: VoiceOptions = {}) {
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle');
  const [voiceError, setVoiceError] = useState<string | null>(null);
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
      const msg = 'Speech recognition not supported in this browser. Try Chrome or Edge.';
      setVoiceError(msg);
      onError?.(msg);
      return;
    }

    // If we were in error state, reset to idle before retrying
    setVoiceError(null);

    // Check if we have permission already
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'microphone' as PermissionName })
        .then((permissionStatus) => {
          if (permissionStatus.state === 'denied') {
            setVoiceStatus('error');
            const msg = 'Microphone access denied. Please allow microphone access in your browser settings and reload.';
            setVoiceError(msg);
            onError?.(msg);
            return;
          }
        })
        .catch(() => {
          // Permissions API might not support 'microphone' — continue anyway
        });
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
      console.warn('SpeechRecognition error:', event.error, event.message);
      let msg: string;
      switch (event.error) {
        case 'not-allowed':
          msg = 'Microphone access denied. Click the lock/info icon in the address bar and enable microphone access, then reload.';
          break;
        case 'no-speech':
          msg = 'No speech detected. Please try again and speak clearly.';
          break;
        case 'aborted':
          msg = 'Speech recognition was cancelled.';
          break;
        case 'audio-capture':
          msg = 'No microphone found. Please connect a microphone and try again.';
          break;
        case 'network':
          msg = 'Network error during speech recognition. Check your internet connection.';
          break;
        case 'service-not-allowed':
          msg = 'Speech recognition service is not allowed. Try a different browser.';
          break;
        case 'language-not-supported':
          msg = 'Language not supported for speech recognition.';
          break;
        default:
          msg = `Speech recognition error: ${event.error}`;
      }
      setVoiceStatus('error');
      setVoiceError(msg);
      onError?.(msg);
    };

    recognition.onend = () => {
      setVoiceStatus(prev => prev === 'listening' ? 'idle' : prev);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (err: any) {
      setVoiceStatus('error');
      const msg = `Failed to start microphone: ${err.message || 'Unknown error'}`;
      setVoiceError(msg);
      onError?.(msg);
    }
  }, [onResult, onError]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore errors from stopping — recognition may already be done
      }
      recognitionRef.current = null;
    }
    setVoiceStatus('idle');
  }, []);

  // --- Text-to-Speech ---
  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) {
      const msg = 'Speech synthesis not supported in this browser.';
      setVoiceError(msg);
      onError?.(msg);
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

  // Reset error state
  const clearError = useCallback(() => {
    setVoiceError(null);
    setVoiceStatus('idle');
  }, []);

  return {
    voiceStatus,
    voiceError,
    voicePitch,
    voiceRate,
    setVoicePitch,
    setVoiceRate,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    clearError,
  };
}
