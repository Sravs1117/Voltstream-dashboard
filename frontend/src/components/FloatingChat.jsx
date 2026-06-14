import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { X, Send, Loader2, Zap, ChevronDown, BookOpen, BrainCircuit, MessageCircle, BarChart2, Lightbulb, Monitor, Sparkles, Sun, Moon } from 'lucide-react';
import axios from 'axios';

// ─── Shared Base URL ─────────────────────────────────────────────────────────
const isProd = import.meta.env.PROD;
const API_BASE = isProd
  ? 'https://voltstream-api-883519779329.us-central1.run.app/api/v1'
  : 'http://127.0.0.1:8000/api/v1';

const ENDPOINTS = {
  ai: `${API_BASE}/chat/`,
  rag: `${API_BASE}/qa/`,
};

// ─── Default greeting ────────────────────────────────────────────────────────
const makeWelcome = () => ({
  id: 'welcome-' + Date.now(),
  role: 'bot',
  text: 'Welcome to VoltStream AI.',
  ts: new Date(),
});

const makeWelcomeAI = () => ({
  id: 'welcome-ai-' + Date.now(),
  role: 'bot',
  text: "Hi! I'm your VoltStream AI assistant.\n\nI'm here to help you with anything related to your energy dashboard, analysis, reports, or insights.\n\n**How can I assist you today?**",
  ts: new Date(),
});

// ─── Mode metadata ────────────────────────────────────────────────────────────
const MODE = {
  ai: {
    label: 'Chat AI',
    placeholder: 'Type your message...',
    badge: '⚡ Chat · Gemini',
  },
  rag: {
    label: 'AI Assistant',
    placeholder: 'Ask about Voltstream...',
    badge: '📚 AI Assistant · Documents',
  },
};

const fmtTime = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// ─── Quick action chips dynamically separated by mode ────────────────────────
const CHIPS = {
  ai: [
    { label: 'What is the energy grid?', Icon: BrainCircuit, color: '#00CFFF', bg: 'rgba(0,207,255,0.05)', border: 'rgba(0,207,255,0.4)', shadow: '0 0 12px rgba(0,207,255,0.2)', query: 'What is the energy grid and how does it relate to energy savings?' },
    { label: 'What are some tips to save energy?', Icon: Lightbulb, color: '#ffb300', bg: 'rgba(255,179,0,0.05)', border: 'rgba(255,179,0,0.4)', shadow: '0 0 12px rgba(255,179,0,0.2)', query: 'What are some tips to save energy?' },
    { label: 'Can you explain this page or dashboard?', Icon: Monitor, color: '#9d00ff', bg: 'rgba(157,0,255,0.05)', border: 'rgba(157,0,255,0.4)', shadow: '0 0 12px rgba(157,0,255,0.2)', query: 'Can you explain the details and metrics of the current dashboard page I have open?' },
  ],
  rag: [
    { label: 'Recommended panel angle', Icon: Lightbulb, color: '#ffb300', bg: 'rgba(255,179,0,0.05)', border: 'rgba(255,179,0,0.4)', shadow: '0 0 12px rgba(255,179,0,0.2)', query: 'What is the recommended panel angle for maximum solar output?' },
    { label: 'Attic R-value specs', Icon: BookOpen, color: '#00CFFF', bg: 'rgba(0,207,255,0.05)', border: 'rgba(0,207,255,0.4)', shadow: '0 0 12px rgba(0,207,255,0.2)', query: 'What is the recommended R-value for attics in residential homes?' },
    { label: 'Smart meter timing', Icon: Monitor, color: '#9d00ff', bg: 'rgba(157,0,255,0.05)', border: 'rgba(157,0,255,0.4)', shadow: '0 0 12px rgba(157,0,255,0.2)', query: 'How often do smart meters transmit usage data?' },
    { label: 'Standby phantom load', Icon: Zap, color: '#00E676', bg: 'rgba(0,230,118,0.05)', border: 'rgba(0,230,118,0.4)', shadow: '0 0 12px rgba(0,230,118,0.2)', query: 'What percentage of residential energy usage does standby/phantom load typically account for?' },
  ]
};

const WELCOME_INFO = {
  ai: {
    line1: "Hi! I'm your VoltStream AI assistant.",
    line2: "I'm here to help you with anything related to your energy dashboard, analysis, reports, or insights.",
    line3: "How can I assist you today?"
  },
  rag: {
    line1: "Hi! I am the VoltStream Assistant.",
    line2: "I can assist you with the energy efficiency related documents-information.",
    line3: "What would you like to know?"
  }
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function BotAvatar() {
  return (
    <div 
      className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
      style={{
        background: 'rgba(0, 207, 255, 0.05)',
        border: '1px solid rgba(0, 207, 255, 0.4)',
        boxShadow: '0 0 10px rgba(0, 207, 255, 0.15)',
      }}
    >
      <Zap size={14} className="text-[#ffb300]" fill="#ffb300" />
    </div>
  );
}

function UserAvatar({ isLight }) {
  return (
    <div 
      className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 font-bold select-none"
      style={{
        background: isLight ? '#00CFFF' : 'rgba(255,255,255,0.06)',
        border: isLight ? 'none' : '1px solid rgba(255,255,255,0.12)',
        color: '#FFFFFF',
        fontSize: '10px'
      }}
    >
      U
    </div>
  );
}

function TypingDots({ isLight }) {
  return (
    <div className="flex items-end gap-2 mb-3">
      <BotAvatar />
      <div 
        style={{
          background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.03)',
          border: isLight ? '1px solid rgba(0, 207, 255, 0.15)' : '1px solid rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(8px)',
          borderRadius: '12px',
          borderBottomLeftRadius: '0px',
          padding: '8px 12px',
          boxShadow: isLight ? '0 2px 8px rgba(0,0,0,0.05)' : 'none'
        }}
      >
        <div className="flex gap-1 items-center h-3">
          {[0, 150, 300].map((d, i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-[#00CFFF]"
              style={{ animation: `vsDotBounce 1.2s ease-in-out ${d}ms infinite` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Bubble({ msg, isLight }) {
  const isUser = msg.role === 'user';
  const [showTrace, setShowTrace] = useState(false);

  // Format bold text 
  const formatText = (txt) => {
    const parts = txt.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) => 
      i % 2 === 1 
      ? <strong key={i} className="font-bold" style={{ color: isUser ? '#ffffff' : (isLight ? '#0f172a' : '#ffffff'), textShadow: isUser || isLight ? 'none' : '0 0 8px rgba(0,207,255,0.4)' }}>{part}</strong> 
      : <span key={i}>{part}</span>
    );
  };

  return (
    <div
      className={`flex items-end gap-2 mb-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
      style={{ animation: 'vsFadeUp 0.22s ease forwards' }}
    >
      {isUser ? <UserAvatar isLight={isLight} /> : <BotAvatar />}
      <div className={`max-w-[85%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        <div 
          className="px-4 py-2.5 rounded-2xl text-[12.5px] leading-relaxed whitespace-pre-wrap"
          style={{
            background: isUser
              ? 'linear-gradient(135deg, #00A8FF 0%, #005f9e 100%)'
              : msg.isError
              ? (isLight ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.07)')
              : (isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.02)'),
            backdropFilter: isUser ? 'none' : 'blur(12px)',
            border: isUser
              ? '1px solid rgba(0, 207, 255, 0.25)'
              : msg.isError
              ? '1px solid rgba(239, 68, 68, 0.25)'
              : '1px solid rgba(0, 207, 255, 0.15)',
            boxShadow: isUser ? 'none' : (isLight ? '0 4px 12px rgba(0,0,0,0.05)' : '0 4px 16px rgba(0,0,0,0.2)'),
            color: isUser ? '#FFFFFF' : (isLight ? '#334155' : '#D8E7F5'),
            borderRadius: isUser ? '14px 14px 0 14px' : '14px 14px 14px 0',
          }}
        >
          {formatText(msg.text)}
        </div>
        {msg.trace && (
          <div className="mt-1.5 w-full">
            <button
              onClick={() => setShowTrace(!showTrace)}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                background: 'rgba(0, 207, 255, 0.05)', border: '1px solid rgba(0, 207, 255, 0.18)', color: '#00CFFF',
                fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px',
                cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              <span>{showTrace ? 'Hide Execution Trace ▲' : 'Show Execution Trace ▼'}</span>
            </button>
            {showTrace && (
              <div 
                className="mt-1.5 text-[9px] font-mono rounded-xl p-2.5 max-h-[160px] overflow-y-auto vs-scroll whitespace-pre leading-relaxed shadow-inner bg-black/60 border border-cyan-500/20 text-[#00CFFF]"
                style={{ animation: 'vsFadeUp 0.2s ease forwards' }}
              >
                <div className="font-bold mb-1 border-b pb-1 flex items-center justify-between text-slate-400 border-white/10">
                  <span>⚙️ DEVELOPER LOGS</span>
                  <span className="text-[7.5px] px-1 py-0.5 rounded bg-cyan-950/60 text-cyan-400 border border-cyan-500/20">ADK Multi-Agent</span>
                </div>
                {msg.trace}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Main Widget ──────────────────────────────────────────────────────────────
export default function FloatingChat() {
  const location = useLocation();
  const [aiHistory, setAiHistory] = useState([makeWelcomeAI()]);
  const [ragHistory, setRagHistory] = useState([makeWelcome()]);
  const [mode, setMode] = useState('ai');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [isLight, setIsLight] = useState(false);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const messages = mode === 'ai' ? aiHistory : ragHistory;
  const setMessages = mode === 'ai' ? setAiHistory : setRagHistory;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (isOpen) {
      setHasUnread(false);
      setTimeout(() => inputRef.current?.focus(), 250);
    }
  }, [isOpen]);

  const triggerWorkflow = async (text) => {
    setIsOpen(true);
    setMode('ai');
    setInput('');
    setLoading(true);
    setAiHistory((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), role: 'user', text, ts: new Date() }
    ]);
    try {
      const formData = new FormData();
      formData.append('message', text);
      formData.append('history', JSON.stringify([]));
      formData.append('current_page', 'Usage History');
      const res = await axios.post(ENDPOINTS.ai, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const data = res.data;
      setAiHistory((prev) => [
        ...prev,
        {
          id: Date.now() + Math.random(),
          role: 'bot',
          text: data.answer,
          ts: new Date(),
          badge: MODE.ai.badge,
          badgeClass: MODE.ai.badgeClass,
          sources: data.sources || [],
          trace: data.trace || null
        }
      ]);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setAiHistory((prev) => [
        ...prev,
        {
          id: Date.now() + Math.random(),
          role: 'bot',
          text: `⚠️ ${detail || 'Unable to reach the server.'}`,
          ts: new Date(),
          isError: true
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleTriggerChat = (e) => {
      const { query } = e.detail || {};
      if (query) {
        triggerWorkflow(query);
      } else {
        setIsOpen(true);
      }
    };
    window.addEventListener('vs-trigger-chat', handleTriggerChat);
    return () => window.removeEventListener('vs-trigger-chat', handleTriggerChat);
  }, []);

  const handleModeSwitch = () => {
    const next = mode === 'ai' ? 'rag' : 'ai';
    setMode(next);
    setInput('');
  };

  const addMsg = (role, text, extras = {}) =>
    setMessages((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), role, text, ts: new Date(), ...extras },
    ]);

  const handleSend = async (queryText) => {
    const text = typeof queryText === 'string' ? queryText.trim() : input.trim();
    if (!text || loading) return;

    const currentMode = mode;
    const meta = MODE[currentMode];

    addMsg('user', text);
    setInput('');
    setLoading(true);

    try {
      let data;
      if (currentMode === 'ai') {
        const formData = new FormData();
        formData.append('message', text);
        const historyData = messages
          .filter(m => !m.id.toString().startsWith('welcome'))
          .map(m => ({ role: m.role, text: m.text }));
        formData.append('history', JSON.stringify(historyData));

        const pathMap = {
          '/': 'Live Dashboard',
          '/history': 'Usage History',
          '/control': 'Smart Control',
          '/billing': 'Billing & Invoices',
        };
        const currentPageName = pathMap[location.pathname] || 'Live Dashboard';
        formData.append('current_page', currentPageName);

        const res = await axios.post(ENDPOINTS.ai, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        data = res.data;
      } else {
        const res = await axios.post(ENDPOINTS.rag, { query: text });
        data = res.data;
      }

      addMsg('bot', data.answer, {
        badge: meta.badge,
        badgeClass: meta.badgeClass,
        sources: data.sources || [],
        trace: data.trace || null,
      });

      if (!isOpen) setHasUnread(true);
    } catch (err) {
      const detail = err.response?.data?.detail;
      addMsg('bot', `⚠️ ${detail || 'Unable to reach the server.'}`, { isError: true });
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const meta = MODE[mode];
  const welcomeCard = WELCOME_INFO[mode];
  const modeChips = CHIPS[mode];

  return (
    <>
      <style>{`
        @keyframes vsDotBounce {
          0%,80%,100% { transform:translateY(0); opacity:.5; }
          40% { transform:translateY(-4px); opacity:1; }
        }
        @keyframes vsFadeUp {
          from { opacity:0; transform:translateY(6px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes vsPopIn {
          from { opacity:0; transform:scale(0.95) translateY(14px); }
          to   { opacity:1; transform:scale(1) translateY(0); }
        }
        .vs-chat-open { animation: vsPopIn 0.24s cubic-bezier(.34,1.42,.64,1) forwards; }
        .vs-scroll::-webkit-scrollbar { width:5px; }
        .vs-scroll::-webkit-scrollbar-track { background:transparent; }
        .vs-scroll::-webkit-scrollbar-thumb { background: rgba(0,207,255,.2); border-radius:8px; }
        .vs-scroll::-webkit-scrollbar-thumb:hover { background: rgba(0,207,255,.4); }
      `}</style>

      {/* Footer / Floating Toggle Button - Always Dark for Dashboard Context */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-2.5">
        <button 
          onClick={() => setIsOpen((o) => !o)} 
          style={{
            display: 'flex',
            alignItems: 'center',
            background: '#021326',
            border: '1px solid rgba(0, 207, 255, 0.25)',
            boxShadow: '0 0 20px rgba(0, 207, 255, 0.35)',
            borderRadius: '999px',
            padding: '10px 22px',
            cursor: 'pointer',
            transition: 'all 0.25s ease-in-out',
            outline: 'none',
          }}
          className="group hover:-translate-y-0.5"
        >
          <div 
            style={{
              width: '20px', height: '20px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #00CFFF, #00A8FF)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 8px #00CFFF',
              marginRight: '8px',
            }}
          >
            {isOpen ? <ChevronDown size={11} color="#FFFFFF" /> : <MessageCircle size={11} color="#FFFFFF" />}
          </div>

          <span style={{ color: '#FFFFFF', fontWeight: 700, fontSize: '13px', letterSpacing: '0.04em' }}>
            {isOpen ? 'Close Chat' : 'Ask VoltStream'}
          </span>

          {hasUnread && !isOpen && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#00E676] border-2 border-[#021326] rounded-full animate-pulse z-20" />
          )}
        </button>
      </div>

      {isOpen && (
        <div 
          className="vs-chat-open fixed bottom-20 right-6 z-[9998] flex flex-col" 
          style={{ 
            width: '380px', 
            height: '580px', 
            borderRadius: '24px',
            background: isLight ? '#f8fafc' : 'linear-gradient(180deg, #021326 0%, #041D3A 50%, #021326 100%)',
            border: '1px solid rgba(0, 207, 255, 0.25)',
            boxShadow: isLight ? '0 10px 40px rgba(0,0,0,0.1)' : '0 0 20px rgba(0, 207, 255, 0.35)',
            display: 'flex', 
            flexDirection: 'column', 
            overflow: 'hidden',
            fontFamily: "'Outfit', sans-serif"
          }}
        >
          {/* Energy Grid Overlay Decoration */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: isLight ? 'radial-gradient(rgba(0, 207, 255, 0.1) 1px, transparent 0)' : 'radial-gradient(rgba(0, 207, 255, 0.02) 1px, transparent 0)',
            backgroundSize: '16px 16px',
            pointerEvents: 'none',
            zIndex: 0,
          }} />

          {/* HEADER */}
          <div 
            style={{ 
              background: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(2, 19, 38, 0.85)', 
              borderBottom: '1px solid rgba(0, 207, 255, 0.15)',
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              zIndex: 1,
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={18} fill="#ffb300" color="#ffb300" />
                <span style={{ color: isLight ? '#0f172a' : '#00CFFF', fontWeight: 800, fontSize: '15px', letterSpacing: '-0.01em', textShadow: isLight ? 'none' : '0 0 8px rgba(0,207,255,0.4)' }}>VoltStream AI</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                <span style={{ fontSize: '10px', color: isLight ? '#64748b' : '#AFC4D8', fontWeight: 500 }}>Energy Intelligence System</span>
                <span style={{ color: '#00E676', fontSize: '9px', fontWeight: 800 }}>• Online</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button 
                onClick={handleModeSwitch} 
                style={{
                  background: isLight ? 'rgba(0, 207, 255, 0.1)' : 'rgba(0, 207, 255, 0.08)',
                  border: '1px solid rgba(0, 207, 255, 0.3)',
                  borderRadius: '999px',
                  color: '#00CFFF',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '4px 12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  outline: 'none',
                }}
                className="hover:brightness-110"
              >
                {mode === 'ai' ? 'Chat AI' : 'AI Assistant'}
              </button>
              <button 
                onClick={() => setIsLight(!isLight)} 
                title="Toggle Theme"
                style={{
                  width: '26px', height: '26px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
                  border: isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.1)',
                  color: isLight ? '#64748b' : '#AFC4D8',
                  cursor: 'pointer',
                  outline: 'none',
                }}
                className={`transition-colors ${isLight ? 'hover:text-black hover:bg-black/10' : 'hover:text-white hover:bg-white/10'}`}
              >
                {isLight ? <Moon size={14} /> : <Sun size={14} />}
              </button>
              <button 
                onClick={() => setIsOpen(false)} 
                style={{
                  width: '26px', height: '26px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
                  border: isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.1)',
                  color: isLight ? '#64748b' : '#AFC4D8',
                  cursor: 'pointer',
                  outline: 'none',
                }}
                className={`transition-colors ${isLight ? 'hover:text-black hover:bg-black/10' : 'hover:text-white hover:bg-white/10'}`}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* CHAT AREA */}
          <div 
            className="overflow-y-auto px-4.5 py-4 vs-scroll" 
            style={{ 
              flex: '1 1 0', 
              minHeight: 0, 
              background: 'transparent',
              zIndex: 1,
            }}
          >
            {messages.map((msg, index) => {
              // WELCOME CARD & suggestions section (rendered together to avoid large blank areas)
              if (index === 0 && msg.id.toString().startsWith('welcome')) {
                const welcomeData = WELCOME_INFO[mode];
                return (
                  <div key={msg.id} style={{ animation: 'vsFadeUp 0.3s ease' }}>
                    <div className="flex items-start gap-2 mb-3">
                      <BotAvatar />
                      <div 
                        style={{
                          background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.02)',
                          backdropFilter: 'blur(12px)',
                          border: '1px solid rgba(0, 207, 255, 0.15)',
                          borderRadius: '14px',
                          borderTopLeftRadius: '4px',
                          padding: '12px 14px',
                          color: isLight ? '#334155' : '#D8E7F5',
                          fontSize: '12.5px',
                          lineHeight: '1.4',
                          boxShadow: isLight ? '0 4px 16px rgba(0,0,0,0.04)' : '0 4px 16px rgba(0,0,0,0.2)',
                          maxWidth: '85%'
                        }}
                      >
                        <div>{welcomeData.line1}</div>
                        <div style={{ marginTop: '6px' }}>{welcomeData.line2}</div>
                        <div style={{ marginTop: '10px', color: isLight ? '#0f172a' : '#ffffff', fontWeight: 700, fontSize: '13px', textShadow: isLight ? 'none' : '0 0 8px rgba(0,207,255,0.5)' }}>{welcomeData.line3}</div>
                      </div>
                    </div>
                    
                    {/* Special AI suggestions block */}
                    <div className="mt-2 mb-2">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: isLight ? '#334155' : '#D8E7F5', marginBottom: '8px', marginLeft: '6px' }}>
                        <Sparkles size={14} color={isLight ? '#00CFFF' : "#ffffff"} fill={isLight ? '#00CFFF' : "#ffffff"} style={{ filter: isLight ? 'none' : 'drop-shadow(0 0 4px rgba(255,255,255,0.8))' }} /> You can ask me:
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {modeChips.map((chip, idx) => {
                          const { Icon, color, border, bg, shadow } = chip;
                          return (
                            <button
                              key={idx}
                              onClick={() => handleSend(chip.query)}
                              style={{
                                background: isLight ? '#ffffff' : 'rgba(255,255,255,0.02)',
                                border: `1px solid ${border}`,
                                borderRadius: '10px',
                                color: isLight ? '#1e293b' : '#D8E7F5',
                                fontSize: '12px',
                                fontWeight: 500,
                                padding: '10px 14px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                outline: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                width: '100%',
                                boxSizing: 'border-box',
                                boxShadow: shadow,
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-1px)';
                                e.currentTarget.style.background = bg;
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.background = isLight ? '#ffffff' : 'rgba(255,255,255,0.02)';
                              }}
                            >
                              <Icon size={18} color={color} style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
                              <span style={{ textAlign: 'left', flex: 1 }}>{chip.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              }
              // Normal Chat bubble
              return <Bubble key={msg.id} msg={msg} isLight={isLight} />;
            })}
            {loading && <TypingDots isLight={isLight} />}
            <div ref={bottomRef} />
          </div>

          {/* CHAT INPUT */}
          <div 
            style={{ 
              padding: '14px 18px', 
              borderTop: '1px solid rgba(0, 207, 255, 0.15)',
              background: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(2, 19, 38, 0.85)',
              zIndex: 1,
            }}
          >
            <div 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                background: isLight ? '#f1f5f9' : 'rgba(0,0,0,0.2)', 
                border: '1px solid rgba(0, 207, 255, 0.25)', 
                borderRadius: '12px',
                padding: '8px 8px 8px 12px',
                boxShadow: isLight ? 'inset 0 2px 4px rgba(0,0,0,0.02)' : 'inset 0 2px 6px rgba(0,0,0,0.2)'
              }}
            >

              <input 
                ref={inputRef} 
                type="text" 
                value={input} 
                onChange={(e) => setInput(e.target.value)} 
                onKeyDown={handleKey} 
                placeholder={meta.placeholder} 
                disabled={loading} 
                style={{
                  flex: 1, 
                  background: 'transparent', 
                  border: 'none', 
                  color: isLight ? '#0f172a' : '#FFFFFF',
                  fontSize: '13px', 
                  outline: 'none',
                }}
              />
              <button 
                onClick={() => handleSend()} 
                disabled={loading || !input.trim()} 
                style={{
                  width: '34px', height: '34px', 
                  borderRadius: '8px',
                  background: 'rgba(0, 207, 255, 0.08)',
                  border: '1px solid rgba(0, 207, 255, 0.4)',
                  boxShadow: '0 0 12px rgba(0, 207, 255, 0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', 
                  color: '#00CFFF', 
                  cursor: 'pointer',
                  transition: 'opacity 0.2s',
                  opacity: (loading || !input.trim()) ? 0.4 : 1,
                  outline: 'none',
                }}
                className="hover:brightness-125"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
