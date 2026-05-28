import { useState, useEffect, useRef } from 'react';
import type { ChatMessage } from '../types';



const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  text: '🆘 ROADSoS AI Assistant active.\n\n• Say "Help ROADSOS" for voice mode\n• Type your emergency below\n• I can dispatch: Trauma, Police, Towing, Puncture',
  isUser: false,
  timestamp: Date.now(),
};

const NETWORK_STATES = {
  cloud: { label: 'Cloud Connected (Deep AI)', color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
  edge: { label: 'Edge AI Active (Zero-Byte Mode)', color: '#FCD34D', bg: 'rgba(252,211,77,0.12)' },
};

export default function ChatCanvas() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [networkState, setNetworkState] = useState<'cloud' | 'edge'>(
    navigator.onLine ? 'cloud' : 'edge'
  );
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const sendMessage = (text: string) => {
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      text: text.trim(),
      isUser: true,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');

    // Simulate AI response
    setTimeout(() => {
      const responses: Record<string, string> = {
        'help': '🆘 Emergency protocol ready.\n\n• Say "SOS" to dispatch\n• Your location is being shared\n• First responders: Trauma Center (2.3 km)',
        'trauma': '🏥 Trauma Centers nearby:\n\n• City General Hospital — 2.3 km\n• St. Mary\'s ER — 4.1 km\n• University Medical — 6.8 km',
        'police': '👮 Police dispatched to your location.\n\n• ETA: 4 minutes\n• Stay in your vehicle\n• Keep hazard lights on',
        'towing': '🛻 Towing services en route.\n\n• Flatbed truck — 7 min\n• Lockout kit available\n• Cash/Card accepted',
        'puncture': '🔧 Puncture repair shops near you:\n\n• Quick Tire — 1.8 km (Open)\n• AutoFix — 3.5 km (24h)',
      };

      const key = Object.keys(responses).find(k => text.toLowerCase().includes(k));
      const reply = key ? responses[key] : 
        '📋 I understand you need help.\n\n• Tell me more and I\'ll dispatch the right service\n• Say "Trauma", "Police", "Towing", or "Puncture"\n• Or tap the SOS button for immediate emergency';

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        text: reply,
        isUser: false,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, aiMsg]);
    }, 800);
  };

  const toggleVoice = () => {
    if (!isListening) {
      setIsListening(true);
      setIsVoiceActive(true);
      // Simulate voice recognition after delay
      setTimeout(() => {
        setIsListening(false);
        sendMessage('help');
        setTimeout(() => setIsVoiceActive(false), 2000);
      }, 3000);
    } else {
      setIsListening(false);
      setIsVoiceActive(false);
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
      </div>

      {/* Messages Area */}
      <div style={styles.messagesArea}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              ...styles.messageBubble,
              alignSelf: msg.isUser ? 'flex-end' : 'flex-start',
              background: msg.isUser ? 'rgba(239,68,68,0.15)' : 'var(--bg-secondary)',
              border: msg.isUser ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(249,250,251,0.06)',
            }}
            className="responsive-chat-bubble"
          >
            <span style={styles.messageText} className="responsive-chat-text">{msg.text}</span>
          </div>
        ))}

        {/* Voice Active Wave Animation */}
        {isVoiceActive && (
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
              {isListening ? 'Listening...' : 'AI Speaking...'}
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
            background: isListening ? 'var(--action-alert)' : 'var(--bg-secondary)',
          }}
          onClick={toggleVoice}
          aria-label={isListening ? 'Stop listening' : 'Start voice input'}
        >
          {isListening ? '⏹' : '🎤'}
        </button>
        <input
          ref={inputRef}
          style={styles.textInput}
          className="responsive-chat-input"
          placeholder="Type your emergency..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Type your emergency message"
        />
        <button
          style={{
            ...styles.sendButton,
            opacity: inputValue.trim() ? 1 : 0.4,
          }}
          onClick={() => sendMessage(inputValue)}
          disabled={!inputValue.trim()}
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
  messagesArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  messageBubble: {
    maxWidth: '85%',
    padding: '14px 18px',
    borderRadius: '16px',
    animation: 'fade-in 0.3s ease',
  },
  messageText: {
    fontSize: '24px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    lineHeight: 1.3,
    whiteSpace: 'pre-line',
    letterSpacing: '-0.3px',
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
    fontSize: '16px',
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
};
