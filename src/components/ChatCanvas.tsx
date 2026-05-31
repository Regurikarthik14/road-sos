import { useState, useEffect, useRef } from 'react';
import type { ChatMessage } from '../types';
import { useVoice } from '../hooks/useVoice';
import { useGemini } from '../hooks/useGemini';

const NETWORK_STATES = {
  cloud: { label: 'Cloud Connected (Deep AI)', color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
  edge: { label: 'Edge AI Active (Zero-Byte Mode)', color: '#FCD34D', bg: 'rgba(252,211,77,0.12)' },
};

// Comprehensive smart response system
const RESPONSE_MAP: Record<string, { response: string; speak?: boolean }> = {
  help: {
    response: '🆘 Raksha Emergency Protocol active.\n\n• Your location is being tracked\n• Say "SOS" or "emergency" for immediate dispatch\n• Ask about: Trauma, Police, Towing, Puncture\n• Fire & hardware monitoring running',
    speak: true,
  },
  sos: {
    response: '🚨 SOS signal received! Emergency dispatch initiated.\n\n• Alerting nearest trauma center (2.3 km)\n• Police notified (ETA 4 min)\n• Stay calm — help is on the way\n• Tap the SOS button now for full emergency mode',
    speak: true,
  },
  emergency: {
    response: '🚨 EMERGENCY MODE ACTIVATED\n\n• Dispatching to: City General Hospital (2.3 km)\n• Police notified\n• Paramedic en route\n• Share your live location? You are at the dashboard',
    speak: true,
  },
  trauma: {
    response: '🏥 Trauma Centers nearby:\n\n• City General Hospital — 2.3 km (Open 24h)\n• St. Mary\'s ER — 4.1 km (Open 24h)\n• University Medical — 6.8 km (Open 24h)\n\nTap the Trauma chip on dashboard to view on map.',
    speak: true,
  },
  police: {
    response: '👮 Police stations near you:\n\n• Central Precinct — 1.3 km (Dispatch Active)\n• Highway Patrol — 2.4 km (En Route)\n\nDial 100 for immediate voice contact.',
    speak: true,
  },
  towing: {
    response: '🛻 Towing services en route:\n\n• Quick Tow — 0.9 km (Available)\n• Apex Towing — 3.0 km (Available)\n• City Wrecker — 2.9 km (On Call)\n\nFlatbed and lockout services available.',
    speak: true,
  },
  puncture: {
    response: '🔧 Puncture repair shops near you:\n\n• Quick Tire — 1.8 km (Open Now)\n• AutoFix — 3.5 km (24 Hour)\n\nBoth offer mobile tire change service.',
    speak: true,
  },
  fire: {
    response: '🔥 Fire Safety:\n\n• Raksha monitors surrounding temperature in real-time\n• If temperature exceeds 50°C, fire alert triggers\n• Fire engine + ambulance auto-dispatched\n• Check the Temperature Monitor on dashboard',
    speak: true,
  },
  hardware: {
    response: '⚙️ Hardware Monitoring:\n\n• CPU, Battery & Sensor health tracked\n• If critical damage detected → owner called\n• No response in 15s → auto-action initiated\n• Check Hardware Health panel on dashboard',
    speak: true,
  },
  raksha: {
    response: '🛡️ Raksha means "protection" in Sanskrit.\n\nI\'m your emergency response assistant.\n• Emergency dispatch & crash detection\n• Temperature & fire monitoring\n• Hardware health surveillance\n• Voice-controlled interface\n\nHow can I help you today?',
    speak: true,
  },
  location: {
    response: '📍 Your current location is being tracked via GPS.\n\n• Live coordinates shared with emergency services\n• Accuracy typically within 10-20 meters outdoors\n• Check MapView on dashboard for detailed view',
    speak: false,
  },
  voice: {
    response: '🎤 Voice mode ready!\n\n• Tap the mic button and speak naturally\n• I\'ll respond verbally too\n• You can adjust voice pitch and rate in settings\n• Say "Help Raksha" to wake me up',
    speak: true,
  },
  temperature: {
    response: '🌡️ Temperature Monitor:\n\n• Current ambient temperature monitored in real-time\n• Normal range: 25-35°C\n• Elevated: 35-50°C — warning issued\n• Fire alert: >50°C — auto-dispatch fire + ambulance\n\nCheck dashboard for live reading.',
    speak: true,
  },
  battery: {
    response: '🔋 Battery status available on the Hardware Health panel.\n\n• Monitored in real-time\n• Low battery alerts trigger early warnings\n• Critical battery triggers owner call protocol',
    speak: false,
  },
  cancel: {
    response: '✅ Emergency cancelled. Raksha remains on standby.\n\n• Monitoring active\n• Tap SOS anytime for immediate help\n• Say "help" for available commands',
    speak: true,
  },
};

// Format timestamp to readable time string
function formatTime(ts: number): string {
  const d = new Date(ts);
  const hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
}

// Format date label (Today, Yesterday, or actual date)
function formatDateLabel(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  if (isToday) return 'Today';
  if (isYesterday) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// Multiple fallback responses so users don't see the same message every time
const FALLBACK_RESPONSES = [
  'I\'m here to help with emergencies and road safety! Try saying:\n\n• "emergency" or "help" — for urgent assistance\n• "police" or "trauma" — nearby emergency services\n• "fire" or "temperature" — environmental monitoring\n• "towing" or "puncture" — roadside assistance\n• "where am I" or "location" — GPS tracking info',
  'Need assistance? I can help with several things:\n\n🚨 **Emergency**: SOS, Police, Trauma centers\n🔧 **Roadside**: Towing, Puncture repair\n🌡️ **Monitoring**: Fire detection, Temperature\n💬 **Chat**: Just speak naturally!\n\nWhat would you like help with?',
  'Hi there! I\'m Raksha, your emergency response assistant.\n\nSome things you can ask me:\n• "Find nearby police station"\n• "Show trauma centers"\n• "Call for towing"\n• "Check fire risk"\n• "Help! I\'m in an accident"\n\nHow can I assist you today?',
  '🛡️ Raksha is here. Available services:\n\n📍 Live GPS tracking & emergency dispatch\n🔥 Real-time temperature & fire monitoring\n⚙️ Hardware health checks (CPU, battery, sensors)\n🚑 Crash detection with auto-SOS\n🎤 Voice-controlled interface\n\nJust tell me what you need!',
];

interface ChatCanvasProps {
  theme: string;
  onToggleTheme: () => void;
  onBack?: () => void;
}

export default function ChatCanvas({ theme, onToggleTheme, onBack }: ChatCanvasProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [networkState, setNetworkState] = useState<'cloud' | 'edge'>(
    navigator.onLine ? 'cloud' : 'edge'
  );
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [apiKeyInputValue, setApiKeyInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const fallbackIndexRef = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    generateResponse,
    error: geminiError,
    apiKey: geminiApiKey,
    setApiKey: setGeminiApiKey,
    clearApiKey: clearGeminiApiKey,
    hasApiKey,
  } = useGemini();

  const { voiceStatus, voiceError, voicePitch, voiceRate, setVoicePitch, setVoiceRate, startListening, stopListening, speak, clearError } = useVoice({
    onResult: (text) => {
      // Put recognized speech in the input so user can review/edit before sending
      setInputValue(text);
      setIsVoiceActive(false);
      // Focus input so user can press Enter to send
      setTimeout(() => inputRef.current?.focus(), 100);
    },
    onError: (error) => {
      console.warn('Voice error:', error);
      setIsVoiceActive(false);
    },
  });

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Track actual network state
  useEffect(() => {
    const handleOnline = () => setNetworkState('cloud');
    const handleOffline = () => setNetworkState('edge');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Pick next fallback response in round-robin fashion
  const getFallbackResponse = (): string => {
    const idx = fallbackIndexRef.current % FALLBACK_RESPONSES.length;
    fallbackIndexRef.current++;
    return FALLBACK_RESPONSES[idx];
  };

  // Find best matching response using broader word-level matching and category grouping
  const findResponse = (text: string): { response: string; speak?: boolean } => {
    const lower = text.toLowerCase().trim();

    // === EMERGENCY DETECTION (highest priority) ===
    const emergencyPatterns = [
      ['accident', 'crash', 'collision', 'wreck'],
      ['hurt', 'injured', 'bleeding', 'wounded', 'unconscious'],
      ['on fire', 'burning', 'smoke', 'flames', 'fire emergency', 'fire accident', 'fire alert'],
      ['help me', 'save me', 'please help', 'emergency', 'sos'],
      ['heart attack', 'stroke', 'choking', 'drowning'],
      ['gunshot', 'stabbing', 'attack', 'assault'],
    ];
    for (const group of emergencyPatterns) {
      if (group.some(p => lower.includes(p))) {
        return {
          response: '🚨 **EMERGENCY DETECTED**\n\n• **Tap the red SOS button NOW** for immediate dispatch\n• Call **108** (India) or **911** (US) for emergency services\n• Stay where you are — help is on the way\n• I\'m here to guide you until help arrives\n\n_Your location is being tracked and will be shared with emergency responders._',
          speak: true,
        };
      }
    }

    // === GREETINGS ===
    const greetingWords = ['hi', 'hello', 'hey', 'namaste', 'vanakkam', 'good morning', 'good evening', 'good afternoon', 'howdy', 'sup', 'yo'];
    if (greetingWords.some(w => lower === w || lower.startsWith(w + ' ') || lower.includes(' ' + w))) {
      const greetings = [
        '👋 Namaste! I\'m **Raksha**, your emergency response assistant.\n\n• Need help? Just say what\'s wrong\n• Say "help" for a list of commands\n• Tap the mic 🎤 to use voice mode\n\nHow can I assist you today?',
        'Hey there! 👋 Raksha here, ready to help.\n\nI can dispatch emergency services, monitor fire/temperature, check hardware health, and more. What do you need?',
        'Hello! 🛡️ Raksha protection system active.\n\nI\'m always monitoring for emergencies. Just tell me what you\'re looking for — police, towing, medical help, or just information.',
      ];
      return { response: greetings[Math.floor(Math.random() * greetings.length)], speak: true };
    }

    // === THANKS ===
    if (['thanks', 'thank you', 'thankyou', 'thx', 'ty'].some(w => lower.includes(w))) {
      const thanks = [
        'You\'re welcome! 🛡️ Raksha is always here to keep you safe.\n\nIs there anything else I can help you with?',
        'Happy to help! Stay safe out there. 😊\n\nLet me know if you need anything else!',
        'Anytime! That\'s what I\'m here for. 🙌\n\nRemember, you can always tap the SOS button in an emergency.',
      ];
      return { response: thanks[Math.floor(Math.random() * thanks.length)], speak: false };
    }

    // === YES / NO / OK / GOODBYE ===
    if (['ok', 'okay', 'k', 'alright', 'sure', 'fine', 'got it', 'understood'].some(w => lower === w || lower.startsWith(w + ' ') || lower === w + '.' || lower === w + '!')) {
      return {
        response: '👍 Got it! I\'m standing by.\n\nSay "help" anytime if you need assistance, or just tell me what you need.',
        speak: false,
      };
    }

    if (['bye', 'goodbye', 'see you', 'cya', 'take care', 'see ya'].some(w => lower.includes(w))) {
      return {
        response: '👋 Stay safe! Raksha will be here whenever you need me.\n\n• SOS button always available for emergencies\n• Monitoring active in the background\n• Take care and drive safe! 🛡️',
        speak: true,
      };
    }

    // Check all registered keywords in RESPONSE_MAP
    for (const [keyword, data] of Object.entries(RESPONSE_MAP)) {
      if (lower.includes(keyword)) {
        return data;
      }
    }

    // === HOURS / TIMING / AVAILABILITY ===
    const timeWords = ['open', 'hours', 'timing', '24', '24/7', 'available', 'when', 'time'];
    if (timeWords.some(w => lower.includes(w))) {
      return {
        response: '🕐 **Emergency services near you:**\n\n• **City General Hospital** — 24/7\n• **Central Police Station** — 24/7\n• **Quick Tow Service** — Open now (until 10 PM)\n• **AutoFix Puncture** — 24/7 mobile service\n\nEmergency services are available around the clock. Tap the relevant chip on the dashboard to view locations on the map.',
        speak: false,
      };
    }

    // === DISTANCE / NEARBY / HOW FAR ===
    const distanceWords = ['near', 'far', 'distance', 'nearby', 'close', 'away', 'km', 'how far', 'nearest', 'closest'];
    if (distanceWords.some(w => lower.includes(w))) {
      return {
        response: '📍 **Nearby services from your location:**\n\n• 🏥 **City General Hospital** — 2.3 km (Trauma)\n• 👮 **Central Police Station** — 1.3 km\n• 🛻 **Quick Tow** — 0.9 km\n• 🔧 **AutoFix Puncture** — 1.8 km\n\nCheck the map on your dashboard for exact routes and directions.',
        speak: false,
      };
    }

    // === WHO / WHAT / WHY QUESTIONS ===
    if (/^(who|what|why|how|when|where|which)\b/i.test(lower) && !distanceWords.some(w => lower.includes(w))) {
      const questionResponses = [
        '🤔 Good question! Here\'s what I can tell you:\n\nI\'m **Raksha** — an AI emergency response assistant.\n\nI can help with:\n• Dispatching emergency services\n• Monitoring fire and temperature\n• Checking hardware/system health\n• GPS location tracking\n\nWhat specifically would you like to know?',
        '📖 Let me explain:\n\nRaksha (रक्षा) means "protection" in Sanskrit. I\'m designed to keep you safe on the road by:\n\n• Detecting crashes via your phone\'s sensors\n• Monitoring cabin temperature for fire risk\n• Tracking your hardware health\n• Connecting you to emergency services instantly\n\nIs there a specific feature you\'d like to learn more about?',
      ];
      return { response: questionResponses[Math.floor(Math.random() * questionResponses.length)], speak: false };
    }

    // === ABOUT / CAPABILITIES ===
    if (['about', 'capabilities', 'features', 'what can you', 'what do you', 'can you', 'function'].some(w => lower.includes(w))) {
      return {
        response: '🛡️ **Raksha — Complete Feature Overview**\n\n✅ **Emergency Dispatch** — Police, Trauma, Towing, Puncture\n✅ **Crash Detection** — Auto-detects impacts and sends SOS\n✅ **Fire Monitoring** — Real-time temperature tracking\n✅ **Hardware Health** — CPU, Battery, Sensor monitoring\n✅ **Voice Control** — Speak naturally with voice mode\n✅ **GPS Tracking** — Real-time location sharing\n✅ **Auto-SOS** — 10-second countdown on fall detection\n✅ **Dark/Light Mode** — Choose your theme\n\nAll of this works together to keep you safe. What would you like to try?',
        speak: true,
      };
    }

    // === WEATHER / CLIMATE ===
    if (['weather', 'temperature outside', 'climate', 'hot', 'cold', 'raining', 'rain', 'forecast'].some(w => lower.includes(w))) {
      return {
        response: '🌡️ **Environmental Monitoring:**\n\nI track the **ambient temperature** inside/around your vehicle in real-time:\n\n• **Normal**: 25-35°C — All clear ✅\n• **Elevated**: 35-50°C — Warning issued ⚠️\n• **Fire Alert**: >50°C — Emergency dispatch 🚨\n\nCheck the **Temperature Monitor** panel on your dashboard for the current reading!\n\n_Note: For outdoor weather forecasts, please check a weather app._',
        speak: false,
      };
    }

    // === PHONE / CALL / CONTACT ===
    if (['call', 'phone', 'number', 'contact', 'dial', 'reach'].some(w => lower.includes(w))) {
      return {
        response: '📞 **Emergency Contact Numbers:**\n\n• **108** — Emergency Services (India)\n• **100** — Police\n• **101** — Fire\n• **102** — Ambulance\n• **112** — All Emergencies (EU/UK)\n• **911** — All Emergencies (US/Canada)\n\nYou can also **tap the SOS button** on your dashboard for immediate dispatch with your GPS location.',
        speak: true,
      };
    }

    // === FEELINGS / MOOD ===
    if (['how are you', 'how\'s it going', 'you doing', 'what\'s up', 'how do you feel'].some(w => lower.includes(w))) {
      return {
        response: 'I\'m always alert and ready to help! 🛡️\n\nMore importantly — **how are you doing**? Are you safe? Do you need any assistance?',
        speak: false,
      };
    }

    // === NAME / WHO ARE YOU ===
    if (['your name', 'who are you', 'called', 'yourself', 'name is'].some(w => lower.includes(w))) {
      return {
        response: 'I\'m **Raksha** 🛡️ — which means "protection" in Sanskrit.\n\nI\'m your AI emergency response assistant, designed to:\n• Keep you safe on the road\n• Detect crashes and fires\n• Dispatch emergency services\n• Monitor your vehicle\'s health\n\nHow can I protect you today?',
        speak: true,
      };
    }

    // === JOKE / FUN ===
    if (['joke', 'funny', 'laugh', 'make me laugh', 'humor', 'hilarious'].some(w => lower.includes(w))) {
      const jokes = [
        'Why did the traffic light turn red?\n\n👉 You would too if you had to change in front of everyone! 🚦😄',
        'What do you call a fake noodle?\n\n👉 An **impasta**! 🍝😄',
        'Why did the scarecrow win an award?\n\n👉 Because he was **outstanding** in his field! 🌾😄',
        'What do you call a bear with no teeth?\n\n👉 A **gummy bear**! 🐻😄',
        'Why don\'t scientists trust atoms?\n\n👉 Because they make up **everything**! ⚛️😄',
      ];
      return { response: '😂 ' + jokes[Math.floor(Math.random() * jokes.length)], speak: true };
    }

    // === COMPLIMENT ===
    if (['you are', 'you\'re', 'good', 'great', 'awesome', 'nice', 'amazing', 'love', 'best', 'brilliant'].some(w => lower.includes(w))) {
      return {
        response: 'Thank you! 😊 I\'m here to keep you safe!\n\nYour safety is my top priority. Is there anything I can help you with right now?',
        speak: false,
      };
    }

    // === DEFAULT VARIED FALLBACK ===
    return {
      response: getFallbackResponse(),
      speak: false,
    };
  };

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      text: text.trim(),
      isUser: true,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');

    // Use Gemini AI when API key is configured
    if (hasApiKey && navigator.onLine) {
      setIsGenerating(true);
      setStreamingText('');

      try {
        // Pass existing messages (excluding the welcome and streaming placeholder)
        const historyForAI = messages.filter(m => m.id !== 'welcome' && m.id !== 'streaming-msg');
        const fullResponse = await generateResponse(
          text,
          [...historyForAI, userMsg],
          (fullText) => {
            setStreamingText(fullText);
          }
        );

        if (fullResponse) {
          const aiMsg: ChatMessage = {
            id: `ai-${Date.now()}`,
            text: fullResponse,
            isUser: false,
            timestamp: Date.now(),
          };
          setMessages(prev => [...prev, aiMsg]);

          // Speak response aloud if it's urgent or voice mode is active
          const lower = text.toLowerCase();
          const isUrgent = ['sos', 'emergency', 'help', 'accident', 'fire', 'crash'].some(w => lower.includes(w));
          if (isUrgent || isVoiceActive) {
            speak(fullResponse);
          }
        }
      } catch (err: any) {
        // On error, fall back to keyword response
        console.warn('Gemini error, using fallback:', err.message);
        const { response, speak: shouldSpeak } = findResponse(text);
        // Strip leading emoji from fallback to avoid double-emoji with the error prefix
        const strippedResponse = response.replace(/^[\u{1F000}-\u{1FFFF}]|^[\u2600-\u27BF]|^[\u{2700}-\u{27BF}]/u, '').trim();
        const fallbackMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          text: `⚠️${strippedResponse}\n\n_🤖 AI engine note: ${err.message} — using backup response._`,
          isUser: false,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, fallbackMsg]);
        if (shouldSpeak) speak(response);
      } finally {
        setIsGenerating(false);
        setStreamingText('');
      }
    } else {
      // Fallback: use keyword-based responses
      setTimeout(() => {
        const { response, speak: shouldSpeak } = findResponse(text);

        let displayText = response;
        if (!hasApiKey) {
          displayText = `${response}\n\n_🤖 Tip: Configure a Gemini API key in settings for AI-powered responses._`;
        } else if (!navigator.onLine) {
          displayText = `${response}\n\n_📡 Offline: Using backup responses. Connect to the internet for AI-powered replies._`;
        }

        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          text: displayText,
          isUser: false,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, aiMsg]);

        if (shouldSpeak) {
          setIsVoiceActive(true);
          speak(response);
          setTimeout(() => setIsVoiceActive(false), response.length * 50 + 500);
        }
      }, 600);
    }
  };

  const toggleVoice = () => {
    if (voiceStatus === 'listening') {
      stopListening();
      setIsVoiceActive(false);
    } else {
      // Auto-dismiss any previous voice error when user taps mic again
      if (voiceError) clearError();
      setIsVoiceActive(true);
      startListening();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') sendMessage(inputValue);
  };

  const ns = NETWORK_STATES[networkState];

  return (
    <div style={styles.container}>
      {/* Network State Banner */}
      <div style={{ ...styles.networkBanner, background: ns.bg, borderColor: ns.color }}>
        {/* Back button — leftmost in header */}
        {onBack && (
          <button
            onClick={onBack}
            style={styles.backButton}
            aria-label="Back to Dashboard"
          >
            ←
          </button>
        )}
        <div style={{ ...styles.networkDot, background: ns.color, boxShadow: `0 0 6px ${ns.color}` }} />
        <span style={{ ...styles.networkLabel, color: ns.color }}>{ns.label}</span>
        <div style={{ flex: 1 }} />
        {/* Voice Settings Toggle */}
        <button
          onClick={() => setShowVoiceSettings(!showVoiceSettings)}
          style={styles.settingsToggle}
          aria-label="Voice settings"
          title="Voice settings"
        >
          🎤
        </button>
        {/* AI Engine Settings */}
        <button
          onClick={() => { setShowApiKeyInput(!showApiKeyInput); setShowVoiceSettings(false); }}
          style={{
            ...styles.settingsToggle,
            border: hasApiKey ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(249,250,251,0.1)',
          }}
          aria-label="AI Engine settings"
          title={hasApiKey ? 'AI Engine: Connected' : 'Configure AI Engine'}
        >
          {hasApiKey ? '🧠' : '⚙️'}
        </button>
        {/* Theme Toggle — right side */}
        <button
          onClick={onToggleTheme}
          style={{
            ...styles.settingsToggle,
            marginLeft: '4px',
          }}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>

      {/* Voice Settings */}
      {showVoiceSettings && (
        <div style={styles.voiceSettings}>
          <div style={styles.settingsRow}>
            <span style={styles.settingsLabel}>Pitch: {voicePitch.toFixed(1)}</span>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={voicePitch}
              onChange={(e) => setVoicePitch(parseFloat(e.target.value))}
              style={styles.slider}
            />
          </div>
          <div style={styles.settingsRow}>
            <span style={styles.settingsLabel}>Rate: {voiceRate.toFixed(1)}</span>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={voiceRate}
              onChange={(e) => setVoiceRate(parseFloat(e.target.value))}
              style={styles.slider}
            />
          </div>
        </div>
      )}

      {/* AI Engine Settings */}
      {showApiKeyInput && (
        <div style={{ ...styles.voiceSettings, background: 'rgba(99,102,241,0.06)' }}>
          <div style={styles.settingsRow}>
            <span style={{ ...styles.settingsLabel, color: 'var(--text-primary)' }}>🧠 AI Engine</span>
            <span style={{
              fontSize: '11px',
              fontWeight: '600',
              color: hasApiKey ? '#10B981' : 'var(--text-dim)',
              fontFamily: 'var(--font-mono)',
            }}>
              {hasApiKey ? '● Connected' : '○ Disconnected'}
            </span>
          </div>
          {hasApiKey ? (
            <div style={styles.settingsRow}>
              <span style={styles.settingsLabel}>
                Key: {geminiApiKey.substring(0, 8)}...{geminiApiKey.substring(geminiApiKey.length - 4)}
              </span>
              <button
                onClick={clearGeminiApiKey}
                style={styles.miniButton}
              >
                ✕ Clear
              </button>
            </div>
          ) : (
            <>
              <div style={styles.settingsRow}>
                <input
                  type="password"
                  placeholder="Paste your Gemini API key..."
                  value={apiKeyInputValue}
                  onChange={(e) => setApiKeyInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && apiKeyInputValue.trim()) {
                      setGeminiApiKey(apiKeyInputValue.trim());
                      setApiKeyInputValue('');
                    }
                  }}
                  style={styles.apiKeyInput}
                />
                <button
                  onClick={() => {
                    if (apiKeyInputValue.trim()) {
                      setGeminiApiKey(apiKeyInputValue.trim());
                      setApiKeyInputValue('');
                    }
                  }}
                  style={{
                    ...styles.miniButton,
                    background: '#6366F1',
                    color: '#fff',
                    opacity: apiKeyInputValue.trim() ? 1 : 0.4,
                  }}
                  disabled={!apiKeyInputValue.trim()}
                >
                  Save
                </button>
              </div>
              <div style={{ ...styles.settingsRow, gap: '6px', flexWrap: 'wrap' }}>
                <span style={styles.helperText}>
                  Get a free key from{' '}
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#6366F1', fontWeight: '600' }}
                  >
                    Google AI Studio
                  </a>
                </span>
              </div>
            </>
          )}
          {geminiError && (
            <div style={styles.settingsRow}>
              <span style={{ fontSize: '11px', color: '#EF4444', fontWeight: '500' }}>
                ⚠️ {geminiError}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Messages Area */}
      <div style={styles.messagesArea}>
        {/* Chat History Header */}
        <div style={styles.historyHeader}>
          <span style={styles.historyIcon}>💬</span>
          <span style={styles.historyLabel}>Chat History</span>
          <span style={styles.historyCount}>{messages.length} message{messages.length !== 1 ? 's' : ''}</span>
        </div>

        {messages.map((msg, idx) => {
          const prevMsg = idx > 0 ? messages[idx - 1] : null;
          const showDateLabel = !prevMsg || formatDateLabel(msg.timestamp) !== formatDateLabel(prevMsg.timestamp);

          return (
            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {/* Date separator label */}
              {showDateLabel && (
                <div style={styles.dateSeparator}>
                  <span style={styles.dateSeparatorLine} />
                  <span style={styles.dateSeparatorText}>{formatDateLabel(msg.timestamp)}</span>
                  <span style={styles.dateSeparatorLine} />
                </div>
              )}
              {/* Message bubble */}
              <div
                style={{
                  ...styles.messageBubble,
                  alignSelf: msg.isUser ? 'flex-end' : 'flex-start',
                  background: msg.isUser ? 'rgba(239,68,68,0.15)' : 'var(--bg-secondary)',
                  border: msg.isUser ? '1px solid rgba(239,68,68,0.2)' : '1px solid var(--border-color)',
                }}
                className="responsive-chat-bubble"
              >
                <span style={styles.messageText} className="responsive-chat-text">{msg.text}</span>
                {/* Timestamp */}
                <span style={{
                  ...styles.messageTimestamp,
                  textAlign: msg.isUser ? 'right' : 'left',
                }}>
                  {formatTime(msg.timestamp)}
                  {msg.isUser && ' ✓'}
                </span>
              </div>
            </div>
          );
        })}

        {/* Streaming AI Response */}
        {isGenerating && streamingText && (
          <div style={{ ...styles.messageBubble, alignSelf: 'flex-start', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}>
            <span style={styles.messageText}>{streamingText}</span>
            <span style={styles.typingCursor}>▍</span>
            <span style={styles.messageTimestamp}>
              {formatTime(Date.now())}
            </span>
          </div>
        )}

        {/* Typing indicator when generating but no content yet */}
        {isGenerating && !streamingText && (
          <div style={{ ...styles.typingIndicator, alignSelf: 'flex-start' }}>
            <div style={styles.typingDots}>
              <span style={styles.typingDot} />
              <span style={{ ...styles.typingDot, animationDelay: '0.15s' }} />
              <span style={{ ...styles.typingDot, animationDelay: '0.3s' }} />
            </div>
            <span style={styles.typingLabel}>Raksha is thinking...</span>
          </div>
        )}

        {/* Voice Active Wave Animation */}
        {isVoiceActive && !isGenerating && (
          <div style={styles.waveContainer}>
            <div style={styles.waveRow}>
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  style={{
                    ...styles.waveBar,
                    animationDelay: `${i * 0.12}s`,
                  }}
                />
              ))}
            </div>
            <span style={styles.waveLabel}>
              {voiceStatus === 'listening' ? 'Listening...' : 'Raksha Speaking...'}
            </span>
          </div>
        )}

        {/* Voice Error Message */}
        {voiceError && !isVoiceActive && (
          <div style={styles.voiceError}>
            <span style={styles.voiceErrorIcon}>⚠️</span>
            <span style={styles.voiceErrorText}>{voiceError}</span>
            <button
              onClick={() => { clearError(); setIsVoiceActive(false); }}
              style={styles.voiceErrorDismiss}
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={styles.inputArea}>
        <button
          style={{
            ...styles.voiceButton,
            background: voiceStatus === 'listening' ? 'var(--action-alert)' : 'var(--bg-secondary)',
            animation: voiceStatus === 'listening' ? 'pulse-glow 1s ease-in-out infinite' : 'none',
          }}
          onClick={toggleVoice}
          aria-label={voiceStatus === 'listening' ? 'Stop listening' : 'Start voice input'}
          title={voiceStatus === 'listening' ? 'Tap to stop' : 'Tap to speak'}
        >
          {voiceStatus === 'listening' ? '⏹' : '🎤'}
        </button>
        <input
          ref={inputRef}
          style={styles.textInput}
          className="responsive-chat-input"
          placeholder="Ask Raksha anything... (e.g., 'trauma', 'fire', 'help')"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isGenerating}
          aria-label="Type your message"
        />
        <button
          style={{
            ...styles.sendButton,
            opacity: (inputValue.trim() && !isGenerating) ? 1 : 0.4,
          }}
          onClick={() => sendMessage(inputValue)}
          disabled={!inputValue.trim() || isGenerating}
          aria-label="Send message"
        >
          ➤
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-primary)',
    animation: 'fade-in 0.3s ease',
  },
  networkBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    paddingTop: 'calc(10px + env(safe-area-inset-top, 0px))',
    borderBottom: '1px solid',
    transition: 'all 0.4s ease',
  },
  networkDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  networkLabel: {
    fontSize: '13px',
    fontWeight: '700',
    letterSpacing: '0.3px',
  },
  settingsToggle: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    border: '1px solid rgba(249,250,251,0.1)',
    background: 'rgba(249,250,251,0.06)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    outline: 'none',
    transition: 'all 0.2s ease',
  },
  voiceSettings: {
    padding: '8px 16px',
    borderBottom: '1px solid rgba(249,250,251,0.06)',
    background: 'rgba(16, 185, 129, 0.04)',
  },
  settingsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '4px 0',
  },
  settingsLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    minWidth: '70px',
    fontFamily: 'var(--font-mono)',
  },
  slider: {
    flex: 1,
    height: '4px',
    accentColor: '#10B981',
    cursor: 'pointer',
  },
  messagesArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  historyHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 4px 12px',
    borderBottom: '1px solid var(--border-color)',
    marginBottom: '4px',
  },
  historyIcon: {
    fontSize: '16px',
  },
  historyLabel: {
    fontSize: '14px',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  historyCount: {
    fontSize: '11px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    marginLeft: 'auto',
    fontFamily: 'var(--font-mono)',
  },
  dateSeparator: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 0 4px',
  },
  dateSeparatorLine: {
    flex: 1,
    height: '1px',
    background: 'var(--border-color)',
  },
  dateSeparatorText: {
    fontSize: '10px',
    fontWeight: '700',
    color: 'var(--text-dim)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    whiteSpace: 'nowrap',
  },
  messageBubble: {
    maxWidth: '85%',
    padding: '12px 16px',
    borderRadius: '16px',
    animation: 'fade-in 0.3s ease',
    position: 'relative' as const,
  },
  messageText: {
    fontSize: '14px',
    fontWeight: '500',
    color: 'var(--text-primary)',
    lineHeight: 1.4,
    whiteSpace: 'pre-line',
  },
  messageTimestamp: {
    display: 'block',
    fontSize: '10px',
    fontWeight: '600',
    color: 'var(--text-dim)',
    marginTop: '6px',
    fontFamily: 'var(--font-mono)',
    letterSpacing: '0.2px',
    opacity: 0.7,
  },
  waveContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '16px 0',
    animation: 'fade-in 0.3s ease',
  },
  waveRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    height: '28px',
  },
  waveBar: {
    width: '4px',
    borderRadius: '2px',
    background: 'var(--action-alert)',
    animation: 'wave-rise 0.6s ease-in-out infinite alternate',
    transition: 'height 0.15s ease',
  },
  waveLabel: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    fontWeight: '600',
  },
  inputArea: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
    borderTop: '1px solid rgba(249,250,251,0.06)',
    background: 'var(--bg-primary)',
  },
  voiceButton: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    transition: 'all 0.2s ease',
    outline: 'none',
    WebkitTapHighlightColor: 'transparent',
    flexShrink: 0,
  },
  textInput: {
    flex: 1,
    height: '44px',
    padding: '0 16px',
    borderRadius: '22px',
    border: '1px solid rgba(249,250,251,0.1)',
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    fontSize: '15px',
    fontWeight: '500',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
  },
  sendButton: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    border: 'none',
    background: 'var(--action-alert)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    transition: 'all 0.2s ease',
    outline: 'none',
    WebkitTapHighlightColor: 'transparent',
    flexShrink: 0,
  },
  apiKeyInput: {
    flex: 1,
    height: '36px',
    padding: '0 12px',
    borderRadius: '10px',
    border: '1px solid rgba(99,102,241,0.2)',
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    fontSize: '13px',
    fontWeight: '500',
    outline: 'none',
    fontFamily: 'var(--font-mono)',
    letterSpacing: '0.5px',
  },
  miniButton: {
    height: '36px',
    padding: '0 14px',
    borderRadius: '10px',
    border: 'none',
    background: 'rgba(239,68,68,0.15)',
    color: 'var(--text-secondary)',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
    outline: 'none',
    whiteSpace: 'nowrap',
    transition: 'all 0.2s ease',
  },
  helperText: {
    fontSize: '11px',
    color: 'var(--text-dim)',
    fontWeight: '500',
    lineHeight: 1.4,
  },
  typingIndicator: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    alignItems: 'flex-start',
    padding: '16px',
    animation: 'fade-in 0.3s ease',
  },
  typingDots: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
  },
  typingDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: 'rgba(99,102,241,0.5)',
    animation: 'typing-bounce 1.4s ease-in-out infinite',
  },
  typingLabel: {
    fontSize: '12px',
    color: 'var(--text-dim)',
    fontWeight: '600',
    fontFamily: 'var(--font-mono)',
  },
  typingCursor: {
    display: 'inline',
    fontSize: '16px',
    color: 'rgba(99,102,241,0.6)',
    animation: 'cursor-blink 1s step-end infinite',
    fontWeight: '300',
    marginLeft: '1px',
  },
  voiceError: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '12px 16px',
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: '12px',
    animation: 'fade-in 0.3s ease',
  },
  voiceErrorIcon: {
    fontSize: '14px',
    flexShrink: 0,
    marginTop: '1px',
  },
  voiceErrorText: {
    flex: 1,
    fontSize: '12px',
    fontWeight: '500',
    color: '#EF4444',
    lineHeight: 1.4,
  },
  voiceErrorDismiss: {
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    border: 'none',
    background: 'rgba(239,68,68,0.15)',
    color: '#EF4444',
    fontSize: '10px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    outline: 'none',
    transition: 'all 0.2s ease',
  },
  backButton: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    border: '1px solid rgba(249,250,251,0.1)',
    background: 'rgba(249,250,251,0.06)',
    color: 'var(--text-primary)',
    fontSize: '16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    outline: 'none',
    WebkitTapHighlightColor: 'transparent',
    transition: 'all 0.2s ease',
  },
};
