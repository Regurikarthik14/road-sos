import { useState, useEffect, useRef } from 'react';
import type { ChatMessage } from '../types';
import { useVoice } from '../hooks/useVoice';
import { useGemini } from '../hooks/useGemini';

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  text: '🛡️ Raksha AI Assistant active.\n\n• Say "Help Raksha" for voice mode\n• Type your emergency below\n• I can dispatch: Trauma, Police, Towing, Puncture\n• Fire & hardware monitoring active',
  isUser: false,
  timestamp: Date.now(),
};

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

interface ChatCanvasProps {
  theme: string;
  onToggleTheme: () => void;
}

export default function ChatCanvas({ theme, onToggleTheme }: ChatCanvasProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
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

  const { voiceStatus, voicePitch, voiceRate, setVoicePitch, setVoiceRate, startListening, stopListening, speak } = useVoice({
    onResult: (text) => {
      sendMessage(text);
      setIsVoiceActive(false);
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

  // Find best matching response
  const findResponse = (text: string): { response: string; speak?: boolean } => {
    const lower = text.toLowerCase();

    // Check all registered keywords
    for (const [keyword, data] of Object.entries(RESPONSE_MAP)) {
      if (lower.includes(keyword)) {
        return data;
      }
    }

    // Smart fallback
    const emergencyWords = ['accident', 'crash', 'hurt', 'injured', 'bleeding', 'fire', 'help me'];
    const isEmergency = emergencyWords.some(w => lower.includes(w));

    if (isEmergency) {
      return {
        response: '🚨 This sounds like an emergency!\n\n• Tap the SOS button now for immediate dispatch\n• Or call 108 (Emergency Services)\n• Stay where you are — help is on the way\n• I\'m here to guide you until help arrives',
        speak: true,
      };
    }

    const greetingWords = ['hi', 'hello', 'hey', 'namaste', 'vanakkam'];
    if (greetingWords.some(w => lower.includes(w))) {
      return {
        response: '👋 Namaste! I\'m Raksha, your emergency assistant.\n\n• Say "help" for available commands\n• Say "raksha" to know more about me\n• I\'m always listening for emergencies\n• Tap the mic for voice mode',
        speak: true,
      };
    }

    return {
      response: '📋 I understand you need information.\n\n• Emergency: Say "SOS", "trauma", "police"\n• Services: "towing", "puncture"\n• Monitoring: "fire", "temperature", "hardware"\n• General: "help", "voice", "location"\n\nOr tap the SOS button for immediate emergency dispatch.',
      speak: true,
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
};
