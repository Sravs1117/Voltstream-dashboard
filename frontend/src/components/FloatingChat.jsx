import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { X, Send, Loader2, Zap, ChevronDown, BookOpen, BrainCircuit, MessageCircle } from 'lucide-react';
import axios from 'axios';

// ─── Endpoints ────────────────────────────────────────────────────────────────

const ENDPOINTS = {
  ai: 'http://127.0.0.1:8000/api/v1/chat/',
  rag: 'http://127.0.0.1:8000/api/v1/qa/',
};

// ─── Default greeting (same for both modes) ───────────────────────────────────

const makeWelcome = () => ({
  id: 'welcome-' + Date.now(),
  role: 'bot',
  text: 'Hi, I\'m VoltStream Bot. How can I help you today?',
  ts: new Date(),
});

// ─── Mode metadata ────────────────────────────────────────────────────────────

const MODE = {
  ai: {
    label: 'Chat AI',
    toggleLabel: 'AI Assistant',
    ToggleIcon: BookOpen,
    banner: '🧠 Chat Mode — Gemini AI, answers anything',
    bannerClass: 'bg-violet-950/40 text-violet-400',
    placeholder: 'Ask me anything...',
    badge: '⚡ Chat · Gemini',
    badgeClass: 'bg-violet-900/40 text-violet-300 border-violet-500/30',
  },
  rag: {
    label: 'AI Assistant',
    toggleLabel: 'Chat AI',
    ToggleIcon: BrainCircuit,
    banner: '📚 AI Assistant Mode — strict answers from documents',
    bannerClass: 'bg-cyan-950/40 text-cyan-400',
    placeholder: 'Ask about Voltstream...',
    badge: '📚 AI Assistant · Documents',
    badgeClass: 'bg-cyan-900/40 text-cyan-300 border-cyan-500/30',
  },
};

const fmtTime = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// ─── Sub-components ───────────────────────────────────────────────────────────

function BotAvatar() {
  return (
    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center flex-shrink-0 shadow-md">
      <Zap size={13} className="text-white" />
    </div>
  );
}

function UserAvatar() {
  return (
    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold select-none">
      U
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-end gap-2 mb-3">
      <BotAvatar />
      <div className="bg-[#1a2e45] border border-white/10 rounded-2xl rounded-bl-none px-4 py-3">
        <div className="flex gap-1.5 items-center h-4">
          {[0, 150, 300].map((d, i) => (
            <span
              key={i}
              className="w-2 h-2 rounded-full bg-cyan-400"
              style={{ animation: `vsDotBounce 1.2s ease-in-out ${d}ms infinite` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Bubble({ msg }) {
  const isUser = msg.role === 'user';
  const [showTrace, setShowTrace] = useState(false);
  return (
    <div
      className={`flex items-end gap-2 mb-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
      style={{ animation: 'vsFadeUp 0.22s ease forwards' }}
    >
      {isUser ? <UserAvatar /> : <BotAvatar />}
      <div className={`max-w-[80%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Bubble */}
        <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-md whitespace-pre-wrap ${isUser
          ? 'bg-gradient-to-br from-cyan-500 to-cyan-700 text-white rounded-br-none'
          : msg.isError
            ? 'bg-red-900/40 border border-red-500/40 text-red-300 rounded-bl-none'
            : 'bg-[#1a2e45] border border-white/10 text-slate-200 rounded-bl-none'
          }`}>
          {msg.text}
        </div>
        {msg.trace && (
          <div className="mt-2 w-full">
            <button
              onClick={() => setShowTrace(!showTrace)}
              className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-semibold px-2.5 py-1 rounded bg-[#0d2137]/60 border border-cyan-500/20 transition-all shadow-sm"
            >
              <span>{showTrace ? 'Hide Execution Trace ▲' : 'Show Execution Trace ▼'}</span>
            </button>
            {showTrace && (
              <div 
                className="mt-2 text-[10.5px] font-mono bg-black/60 border border-cyan-500/20 rounded-xl p-3.5 text-cyan-300 max-h-[300px] overflow-y-auto vs-scroll whitespace-pre leading-relaxed shadow-inner"
                style={{ animation: 'vsFadeUp 0.2s ease forwards' }}
              >
                <div className="font-bold text-slate-400 mb-2 border-b border-white/10 pb-1.5 flex items-center justify-between">
                  <span>⚙️ DEVELOPER LOGS</span>
                  <span className="text-[9px] bg-cyan-950/60 px-1.5 py-0.5 rounded text-cyan-400 border border-cyan-500/20">ADK Multi-Agent</span>
                </div>
                {msg.trace}
              </div>
            )}
          </div>
        )}
        <span className="text-[10px] text-slate-600 mt-1 px-1">{fmtTime(msg.ts)}</span>
      </div>
    </div>
  );
}

// ─── Main Widget ──────────────────────────────────────────────────────────────

export default function FloatingChat() {
  const location = useLocation();
  const [aiHistory, setAiHistory] = useState([makeWelcome()]);
  const [ragHistory, setRagHistory] = useState([makeWelcome()]);
  const [mode, setMode] = useState('ai');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

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

  const handleSend = async () => {
    const text = input.trim();
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
        const historyData = messages.filter(m => !m.id.toString().startsWith('welcome')).map(m => ({
          role: m.role,
          text: m.text
        }));
        formData.append('history', JSON.stringify(historyData));

        // Map the current page name
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
  const ToggleIcon = meta.ToggleIcon;

  return (
    <>
      <style>{`
        @keyframes vsDotBounce {
          0%,80%,100% { transform:translateY(0); opacity:.5; }
          40% { transform:translateY(-5px); opacity:1; }
        }
        @keyframes vsFadeUp {
          from { opacity:0; transform:translateY(8px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes vsPopIn {
          from { opacity:0; transform:scale(0.93) translateY(18px); }
          to   { opacity:1; transform:scale(1) translateY(0); }
        }
        .vs-chat-open { animation: vsPopIn 0.28s cubic-bezier(.34,1.56,.64,1) forwards; }
        .vs-scroll::-webkit-scrollbar { width:4px; }
        .vs-scroll::-webkit-scrollbar-track { background:transparent; }
        .vs-scroll::-webkit-scrollbar-thumb { background:rgba(6,182,212,.25); border-radius:8px; }
        .vs-scroll::-webkit-scrollbar-thumb:hover { background:rgba(6,182,212,.5); }
      `}</style>

      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-2.5">
        <button 
          onClick={() => setIsOpen((o) => !o)} 
          className="relative group flex items-center rounded-full bg-gradient-to-r from-[#0a192f] to-[#0c2d54] border border-cyan-500/25 shadow-[0_4px_16px_rgba(0,0,0,0.5),0_0_24px_rgba(6,182,212,0.3)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_6px_20px_rgba(0,0,0,0.6),0_0_36px_rgba(6,182,212,0.5)] focus:outline-none px-3.5 py-2.5"
        >
          {/* Animated glow */}
          <div className="absolute inset-0 rounded-full animate-pulse bg-cyan-400/5 opacity-50 pointer-events-none"></div>

          {/* Left: Chat Icon with circular glow */}
          <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-white/5 border border-white/10 group-hover:bg-cyan-500/20 group-hover:border-cyan-400/40 transition-colors mr-3 shadow-[0_0_10px_rgba(255,255,255,0.05)]">
             <div className="absolute inset-0 bg-cyan-400/20 blur-md rounded-full"></div>
             {isOpen ? <ChevronDown size={18} className="text-white relative z-10" /> : <MessageCircle size={18} className="text-white relative z-10" />}
          </div>

          {/* Center: Text */}
          <span className="text-white font-medium text-[14.5px] tracking-wide relative z-10 mt-[1px]">
            {isOpen ? 'Close Chat' : 'Ask VoltStream'}
          </span>

          {/* Right: Yellow Lightning Icon */}
          {!isOpen && (
            <div className="ml-3 relative z-10 flex items-center mt-[1px]">
              <Zap size={16} fill="currentColor" className="text-yellow-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.8)] group-hover:animate-pulse" />
            </div>
          )}

          {/* Unread badge */}
          {hasUnread && !isOpen && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 border-2 border-[#0c2d54] rounded-full animate-pulse z-20" />}
        </button>
      </div>

      {isOpen && (
        <div className="vs-chat-open fixed bottom-20 right-6 z-[9998] flex flex-col rounded-2xl overflow-hidden border border-white/10" style={{ width: '400px', height: '550px', display: 'flex', flexDirection: 'column', background: '#0a1929', boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(6,182,212,0.08)' }}>
          <div className="flex items-center gap-3 px-5 py-3.5 flex-shrink-0 border-b border-white/10" style={{ background: '#0d2137' }}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center shadow-lg shadow-cyan-900/50 flex-shrink-0">
              <Zap size={17} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white tracking-wide leading-none">VoltStream Bot</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-emerald-400 font-medium">{meta.label}</span>
              </div>
            </div>
            <button onClick={handleModeSwitch} className={`flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-all hover:brightness-125 flex-shrink-0 ${mode === 'ai' ? 'bg-cyan-900/40 text-cyan-300 border-cyan-500/30 hover:bg-cyan-900/60' : 'bg-violet-900/40 text-violet-300 border-violet-500/30 hover:bg-violet-900/60'}`}>
              <ToggleIcon size={11} />
              {meta.toggleLabel}
            </button>
            <button onClick={() => setIsOpen(false)} className="w-7 h-7 ml-1 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all flex-shrink-0">
              <X size={15} />
            </button>
          </div>

          <div className="overflow-y-auto px-5 py-4 vs-scroll" style={{ flex: '1 1 0', minHeight: 0, background: '#0a1929' }}>
            {messages.map((msg) => <Bubble key={msg.id} msg={msg} />)}
            {loading && <TypingDots />}
            <div ref={bottomRef} />
          </div>

          <div className="px-4 py-3.5 border-t border-white/10 flex-shrink-0" style={{ background: '#0d2137' }}>
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 border border-white/10 focus-within:border-cyan-500/60 focus-within:ring-2 focus-within:ring-cyan-500/15 transition-all" style={{ background: '#0a1929' }}>
              <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKey} placeholder={meta.placeholder} disabled={loading} className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-500 focus:outline-none disabled:opacity-50 min-w-0" />
              <button onClick={handleSend} disabled={loading || !input.trim()} className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center text-white shadow-md hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
