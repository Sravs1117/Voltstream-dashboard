import { useState, useRef, useEffect } from 'react';
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
    label: 'Normal AI',
    toggleLabel: 'Rag Q&A',
    ToggleIcon: BookOpen,
    banner: '🧠 Chat Mode — Gemini AI, answers anything',
    bannerClass: 'bg-violet-950/40 text-violet-400',
    placeholder: 'Ask me anything...',
    badge: '⚡ Chat · Gemini',
    badgeClass: 'bg-violet-900/40 text-violet-300 border-violet-500/30',
  },
  rag: {
    label: 'Rag Q&A',
    toggleLabel: 'Chat',
    ToggleIcon: BrainCircuit,
    banner: '📚 Rag Q&A Mode — strict answers from documents',
    bannerClass: 'bg-cyan-950/40 text-cyan-400',
    placeholder: 'Ask about Voltstream...',
    badge: '📚 RAG · Documents',
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
  return (
    <div
      className={`flex items-end gap-2 mb-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
      style={{ animation: 'vsFadeUp 0.22s ease forwards' }}
    >
      {isUser ? <UserAvatar /> : <BotAvatar />}
      <div className={`max-w-[80%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Source chips */}
        {!isUser && msg.sources?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1">
            {msg.sources.map((s) => (
              <span key={s} className="text-[9px] bg-cyan-900/30 text-cyan-400 border border-cyan-500/20 rounded-full px-2 py-0.5">
                📄 {s}
              </span>
            ))}
          </div>
        )}
        {/* Bubble */}
        <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-md whitespace-pre-wrap ${isUser
          ? 'bg-gradient-to-br from-cyan-500 to-cyan-700 text-white rounded-br-none'
          : msg.isError
            ? 'bg-red-900/40 border border-red-500/40 text-red-300 rounded-bl-none'
            : 'bg-[#1a2e45] border border-white/10 text-slate-200 rounded-bl-none'
          }`}>
          {msg.text}
        </div>
        <span className="text-[10px] text-slate-600 mt-1 px-1">{fmtTime(msg.ts)}</span>
      </div>
    </div>
  );
}

// ─── Main Widget ──────────────────────────────────────────────────────────────

export default function FloatingChat() {
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
        <button onClick={() => setIsOpen((o) => !o)} className="relative w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500 to-blue-700 shadow-[0_0_24px_rgba(6,182,212,0.45)] flex items-center justify-center text-white transition-all hover:scale-105 hover:shadow-[0_0_32px_rgba(6,182,212,0.65)] active:scale-95 focus:outline-none focus:ring-4 focus:ring-cyan-400/40">
          <span key={isOpen ? 'c' : 'o'} style={{ animation: 'vsFadeUp 0.2s ease forwards' }}>
            {isOpen ? <ChevronDown size={22} /> : <MessageCircle size={22} />}
          </span>
          {!isOpen && (
            <>
              <div className="absolute -top-12 right-0 group bg-[#0c1f35] text-cyan-300 text-xs font-semibold px-3 py-1.5 rounded-full border border-cyan-500/30 shadow-lg whitespace-nowrap pointer-events-none inline-flex items-center gap-1" style={{ animation: 'vsFadeUp 0.3s ease forwards' }}>
                Ask VoltStream
                <span className="inline-block transition-transform duration-300 origin-bottom animate-bounce scale-125">
                  ⚡
                </span>
              </div>
              <span className="absolute inset-0 rounded-full animate-ping bg-cyan-400 opacity-20 pointer-events-none" />
            </>
          )}
          {hasUnread && !isOpen && <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-rose-500 border-2 border-white rounded-full animate-pulse" />}
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
