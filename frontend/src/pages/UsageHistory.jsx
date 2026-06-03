import React, { useState, useEffect, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import {
  ArrowUpRight, ArrowDownRight, RefreshCcw,
  Send, Loader2, CheckCircle2, XCircle, ChevronDown, ChevronUp,
  BarChart2, Lightbulb, Brain
} from 'lucide-react';
import api from '../services/api';
import useApi from '../hooks/useApi';

// ─── Lightweight markdown → JSX renderer ───────────────────────────────────
const MarkdownReply = ({ text, color }) => {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];
  let i = 0;

  const renderInline = (raw) => {
    // Bold: **text**
    const parts = raw.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((p, idx) =>
      p.startsWith('**') && p.endsWith('**')
        ? <strong key={idx} style={{ color: '#f0f9ff', fontWeight: 700 }}>{p.slice(2, -2)}</strong>
        : <span key={idx}>{p}</span>
    );
  };

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();

    // Blank line → spacer
    if (!trimmed) {
      elements.push(<div key={i} style={{ height: '6px' }} />);
      i++; continue;
    }

    // Horizontal rule
    if (/^---+$/.test(trimmed)) {
      elements.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)', margin: '10px 0' }} />);
      i++; continue;
    }

    // Section header (ALL CAPS line or ends with ':')
    if (/^[A-Z][A-Z\s(),-]+:?$/.test(trimmed) || (trimmed === trimmed.toUpperCase() && trimmed.length > 2 && !/^[•\-\d*]/.test(trimmed))) {
      elements.push(
        <div key={i} style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', color: '#67e8f9', marginTop: '10px', marginBottom: '4px' }}>
          {trimmed}
        </div>
      );
      i++; continue;
    }

    // Markdown headers ## or ###
    if (trimmed.startsWith('##')) {
      const txt = trimmed.replace(/^#+\s*/, '');
      elements.push(
        <div key={i} style={{ fontSize: '12px', fontWeight: 800, color: '#a5f3fc', marginTop: '10px', marginBottom: '4px' }}>
          {renderInline(txt)}
        </div>
      );
      i++; continue;
    }

    // Bullet: • or - or *
    if (/^[•\-\*]\s+/.test(trimmed)) {
      const txt = trimmed.replace(/^[•\-\*]\s+/, '');
      elements.push(
        <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '3px' }}>
          <span style={{ color: '#06b6d4', flexShrink: 0, marginTop: '1px', fontSize: '12px' }}>•</span>
          <span style={{ fontSize: '13px', lineHeight: '1.6' }}>{renderInline(txt)}</span>
        </div>
      );
      i++; continue;
    }

    // Numbered list: 1. or 1)
    const numMatch = trimmed.match(/^(\d+)[.):]\s+(.+)$/);
    if (numMatch) {
      elements.push(
        <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '3px' }}>
          <span style={{ color: '#06b6d4', flexShrink: 0, fontSize: '11px', fontWeight: 700, minWidth: '18px', marginTop: '1px' }}>{numMatch[1]}.</span>
          <span style={{ fontSize: '13px', lineHeight: '1.6' }}>{renderInline(numMatch[2])}</span>
        </div>
      );
      i++; continue;
    }

    // Key : Value  (indented metric lines)
    const kvMatch = trimmed.match(/^([^:]+)\s*:\s*(.+)$/);
    if (kvMatch && !trimmed.startsWith('http')) {
      elements.push(
        <div key={i} style={{ display: 'flex', gap: '6px', fontSize: '13px', lineHeight: '1.6', marginBottom: '2px' }}>
          <span style={{ color: '#9ca3af', minWidth: '140px', flexShrink: 0 }}>{kvMatch[1]}:</span>
          <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{renderInline(kvMatch[2])}</span>
        </div>
      );
      i++; continue;
    }

    // Plain paragraph
    elements.push(
      <p key={i} style={{ fontSize: '13px', lineHeight: '1.75', margin: '2px 0' }}>
        {renderInline(trimmed)}
      </p>
    );
    i++;
  }

  return <div style={{ color }}>{elements}</div>;
};

// ─── Shared base URL (same pattern as SmartControl) ────────────────────────
const isProd = import.meta.env.PROD;
const INSIGHTS_BASE = isProd
  ? 'https://voltstream-api-883519779329.us-central1.run.app/api/v1'
  : 'http://127.0.0.1:8000/api/v1';

// ─── Stat Card (unchanged) ──────────────────────────────────────────────────
const StatCard = ({ title, value, subtext, trend, isPositive }) => (
  <div className="glass-card p-5">
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</p>
    <div className="flex items-end justify-between mt-2">
      <div>
        <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
        <p className="text-xs text-gray-500 mt-1">{subtext}</p>
      </div>
      <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${
        isPositive ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'
      }`}>
        {isPositive ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
        {trend}%
      </div>
    </div>
  </div>
);

// ─── Agent Step Node ────────────────────────────────────────────────────────
const AgentNode = ({ label, icon: Icon, color, state }) => {
  const colors = {
    cyan:   { ring: 'rgba(6,182,212,0.5)',   glow: 'rgba(6,182,212,0.3)',   dot: '#06b6d4', text: '#a5f3fc' },
    violet: { ring: 'rgba(139,92,246,0.5)',  glow: 'rgba(139,92,246,0.3)',  dot: '#8b5cf6', text: '#ddd6fe' },
    emerald:{ ring: 'rgba(52,211,153,0.5)',  glow: 'rgba(52,211,153,0.3)',  dot: '#34d399', text: '#a7f3d0' },
  };
  const c = colors[color];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
      <div style={{
        width: '48px', height: '48px', borderRadius: '50%',
        background: `radial-gradient(circle at 35% 35%, rgba(15,25,35,0.9), #0a0f14)`,
        border: `2px solid ${state === 'idle' ? 'rgba(255,255,255,0.08)' : c.ring}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: state === 'active'
          ? `0 0 18px ${c.glow}, 0 0 6px ${c.glow}`
          : state === 'done'
          ? `0 0 10px ${c.glow}`
          : 'none',
        transition: 'all 0.4s ease',
        animation: state === 'active' ? 'agentPulse 1.8s ease-in-out infinite' : 'none',
      }}>
        <Icon size={20} color={state === 'idle' ? '#4b5563' : c.dot} strokeWidth={1.5} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {state === 'active' && (
          <span style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: c.dot, display: 'inline-block',
            animation: 'agentDot 1.2s ease-in-out infinite',
          }} />
        )}
        {state === 'done' && <CheckCircle2 size={10} color={c.dot} />}
        <span style={{
          color: state === 'idle' ? '#4b5563' : c.text,
          fontSize: '10px', fontWeight: 700,
          letterSpacing: '0.04em', whiteSpace: 'nowrap',
          transition: 'color 0.4s',
        }}>
          {label}
        </span>
      </div>
    </div>
  );
};

// ─── Arrow connector ─────────────────────────────────────────────────────────
const FlowArrow = ({ active }) => (
  <div style={{
    flex: 1, height: '2px', maxWidth: '48px',
    background: active
      ? 'linear-gradient(90deg, rgba(6,182,212,0.6), rgba(139,92,246,0.6))'
      : 'rgba(255,255,255,0.06)',
    borderRadius: '2px',
    transition: 'background 0.5s',
    position: 'relative',
    alignSelf: 'center',
    marginBottom: '24px',
  }}>
    <span style={{
      position: 'absolute', right: '-6px', top: '50%',
      transform: 'translateY(-50%)',
      color: active ? 'rgba(139,92,246,0.8)' : 'rgba(255,255,255,0.1)',
      fontSize: '10px', lineHeight: 1,
      transition: 'color 0.5s',
    }}>▶</span>
  </div>
);

// ─── Chip suggestions ────────────────────────────────────────────────────────
const CHIPS = [
  { label: 'Show last week\'s usage',                  icon: '📊' },
  { label: 'Give me energy-saving tips',               icon: '💡' },
  { label: 'Tips based on my last week\'s usage',      icon: '🎯' },
];

// ═══════════════════════════════════════════════════════════════════════════════
//  MULTI-AGENT PANEL
// ═══════════════════════════════════════════════════════════════════════════════
const MultiAgentPanel = ({ period }) => {
  const [input, setInput]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [agentStep, setAgentStep]   = useState('idle'); // idle | orchestrating | analysing | advising | done
  const [reply, setReply]           = useState(null);   // { text, ok }
  const [trace, setTrace]           = useState('');
  const [intent, setIntent]         = useState(null);   // { usage, advice }
  const [traceOpen, setTraceOpen]   = useState(false);
  const inputRef                    = useRef(null);

  // Derive per-node states from agentStep + actual intent
  const orchestratorState =
    agentStep === 'idle'   ? 'idle'
    : agentStep === 'done' ? 'done'
    : 'active';

  const analystState =
    agentStep === 'idle' || agentStep === 'orchestrating'                    ? 'idle'
    : agentStep === 'analysing'                                              ? 'active'
    : agentStep === 'done' && intent?.usage                                  ? 'done'
    : agentStep === 'advising' && intent?.usage                              ? 'done'
    : 'idle';

  const advisorState =
    !intent?.advice && agentStep === 'done'                                  ? 'idle'
    : agentStep === 'idle' || agentStep === 'orchestrating'                  ? 'idle'
    : agentStep === 'analysing'                                              ? 'idle'
    : agentStep === 'advising'                                               ? 'active'
    : agentStep === 'done' && intent?.advice                                 ? 'done'
    : 'idle';

  const runInsights = async (prompt) => {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setReply(null);
    setTrace('');
    setIntent(null);
    setTraceOpen(false);
    setAgentStep('orchestrating');

    // Timers to animate the step nodes progressively while waiting
    const t1 = setTimeout(() => setAgentStep('analysing'), 1000);
    const t2 = setTimeout(() => setAgentStep('advising'), 2400);

    try {
      const res = await fetch(`${INSIGHTS_BASE}/insights/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          period: period || 'weekly',
          session_id: 'insights_ui_session',
        }),
      });

      clearTimeout(t1); clearTimeout(t2);

      const data = await res.json();
      const detectedIntent = data.intent || { usage: false, advice: true };

      // Skip analysing step animation if intent is advice-only
      if (!detectedIntent.usage) setAgentStep('advising');

      setIntent(detectedIntent);
      await new Promise(r => setTimeout(r, 300)); // let node animate to 'done'
      setAgentStep('done');
      setReply({ text: data.reply || 'Analysis complete.', ok: res.ok });
      setTrace(data.agent_trace || '');
      if (data.agent_trace) setTraceOpen(true);

    } catch (err) {
      clearTimeout(t1); clearTimeout(t2);
      setAgentStep('idle');
      setReply({
        text: 'Could not reach the VoltStream Multi-Agent backend. Is the server running?',
        ok: false,
      });
    } finally {
      setLoading(false);
      setInput('');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    runInsights(input);
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0d1b2a 0%, #111827 55%, #0a1628 100%)',
      border: '1px solid rgba(6,182,212,0.15)',
      borderRadius: '20px',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: '0 8px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
    }}>

      {/* Background glow blobs */}
      <div style={{
        position: 'absolute', top: '-60px', left: '-60px',
        width: '200px', height: '200px',
        background: 'radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-40px', right: '80px',
        width: '160px', height: '160px',
        background: 'radial-gradient(circle, rgba(139,92,246,0.07) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 35%, #1a2d3e, #0d1f2d)',
            border: '2px solid rgba(6,182,212,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 18px rgba(6,182,212,0.2)',
            animation: 'agentPulse 3s ease-in-out infinite',
            flexShrink: 0,
          }}>
            <Brain size={22} color="#06b6d4" strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#f9fafb', fontSize: '15px', fontWeight: 800, letterSpacing: '-0.01em' }}>
                VoltStream Multi-Agent System
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{
                  width: '7px', height: '7px', borderRadius: '50%', background: '#06b6d4',
                  boxShadow: '0 0 6px #06b6d4', display: 'inline-block',
                  animation: 'agentDot 2s ease-in-out infinite',
                }} />
                <span style={{ color: '#06b6d4', fontSize: '10px', fontWeight: 600, letterSpacing: '0.05em' }}>
                  Online
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* Intent badges */}
        {intent && (
          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
            {intent.usage && (
              <span style={{
                background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.3)',
                color: '#67e8f9', fontSize: '10px', fontWeight: 700,
                padding: '3px 10px', borderRadius: '20px', letterSpacing: '0.05em',
              }}>📊 USAGE</span>
            )}
            {intent.advice && (
              <span style={{
                background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)',
                color: '#c4b5fd', fontSize: '10px', fontWeight: 700,
                padding: '3px 10px', borderRadius: '20px', letterSpacing: '0.05em',
              }}>💡 ADVICE</span>
            )}
          </div>
        )}
      </div>


      {/* ── Input Row ───────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          background: 'rgba(255,255,255,0.04)',
          border: '1.5px solid rgba(6,182,212,0.2)',
          borderRadius: '12px',
          padding: '10px 14px',
          backdropFilter: 'blur(8px)',
        }}>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='Ask about your usage or get energy-saving tips...'
            disabled={loading}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: '#f3f4f6', fontSize: '13px', fontWeight: 500,
            }}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px',
              background: loading || !input.trim()
                ? 'rgba(6,182,212,0.08)'
                : 'linear-gradient(135deg, #0369a1, #0e7490)',
              border: '1px solid rgba(6,182,212,0.35)',
              borderRadius: '10px',
              color: loading || !input.trim() ? '#4b5563' : '#e0f7fa',
              fontWeight: 700, fontSize: '12px',
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              boxShadow: loading || !input.trim() ? 'none' : '0 4px 16px rgba(6,182,212,0.2)',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
          >
            {loading
              ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
              : <Send size={13} />
            }
            {loading ? 'Running...' : 'Run Agents'}
          </button>
        </div>
      </form>

      {/* ── Chip suggestions ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
        {CHIPS.map((chip) => (
          <button
            key={chip.label}
            onClick={() => { setInput(chip.label); inputRef.current?.focus(); }}
            disabled={loading}
            style={{
              background: 'rgba(6,182,212,0.07)',
              border: '1px solid rgba(6,182,212,0.15)',
              borderRadius: '20px',
              color: '#9ca3af',
              fontSize: '11px', fontWeight: 500,
              padding: '4px 12px',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s', whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', gap: '5px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(6,182,212,0.14)';
              e.currentTarget.style.color = '#a5f3fc';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(6,182,212,0.07)';
              e.currentTarget.style.color = '#9ca3af';
            }}
          >
            <span>{chip.icon}</span> {chip.label}
          </button>
        ))}
      </div>

      {/* ── Agent trace (collapsible) ───────────────────────────────────── */}
      {trace && (
        <div style={{ marginTop: '14px' }}>
          <button
            onClick={() => setTraceOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '8px',
              color: '#6b7280', fontSize: '11px', fontWeight: 600,
              padding: '5px 12px', cursor: 'pointer',
              letterSpacing: '0.04em',
            }}
          >
            ⚙️ AGENT TRACE
            {traceOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {traceOpen && (
            <div style={{
              marginTop: '8px',
              padding: '12px 14px',
              background: 'rgba(0,0,0,0.25)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '10px',
              fontSize: '11px', lineHeight: '1.8',
              color: '#9ca3af', fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
            }}>
              {trace}
            </div>
          )}
        </div>
      )}

      {/* ── Reply panel ─────────────────────────────────────────────────── */}
      {reply && (
        <div style={{
          marginTop: '14px',
          padding: '14px 16px',
          borderRadius: '12px',
          background: reply.ok
            ? 'rgba(6,182,212,0.06)'
            : 'rgba(239,68,68,0.07)',
          border: `1px solid ${reply.ok ? 'rgba(6,182,212,0.2)' : 'rgba(239,68,68,0.2)'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '8px' }}>
            {reply.ok
              ? <CheckCircle2 size={14} color="#06b6d4" />
              : <XCircle     size={14} color="#f87171" />
            }
            <span style={{
              color: reply.ok ? '#a5f3fc' : '#fca5a5',
              fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em',
            }}>
              {reply.ok ? 'AGENT RESPONSE' : 'ERROR'}
            </span>
          </div>
          {reply.ok
            ? <MarkdownReply text={reply.text} color="#e2e8f0" />
            : <p style={{ color: '#fca5a5', fontSize: '13px', lineHeight: '1.6' }}>{reply.text}</p>
          }
        </div>
      )}

      {/* Keyframe styles */}
      <style>{`
        @keyframes agentPulse {
          0%, 100% { box-shadow: 0 0 18px rgba(6,182,212,0.2), 0 0 6px rgba(6,182,212,0.1); }
          50%       { box-shadow: 0 0 30px rgba(6,182,212,0.4), 0 0 12px rgba(6,182,212,0.25); }
        }
        @keyframes agentDot {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};


// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function UsageHistory() {
  const [period, setPeriod] = useState('daily');
  const { data: analyticsData, isLoading, error, execute } = useApi(api.getAnalyticsHistory, false);

  useEffect(() => {
    execute(period);
  }, [period, execute]);

  const dataArray = Array.isArray(analyticsData?.data)
    ? analyticsData.data
    : Array.isArray(analyticsData)
      ? analyticsData
      : [];

  const chartData = dataArray.map(item => ({
    name: item.label || 'N/A',
    consumption: item.consumption_kwh || 0,
    solar: item.generation_kwh || 0,
    cost: ((item.consumption_kwh || 0) * 0.28).toFixed(2)
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Usage History</h1>
          <p className="text-sm text-gray-500">Detailed breakdown of your energy analytics</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
            {['daily', 'weekly', 'monthly'].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                  period === p
                    ? 'bg-gray-900 text-white shadow-md'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Total Consumption" value={`${chartData.reduce((acc, curr) => acc + curr.consumption, 0).toFixed(1)} kWh`} subtext={`Aggregate for ${period} view`} trend="9.1" isPositive={true} />
        <StatCard title="Solar Contribution" value={`${chartData.reduce((acc, curr) => acc + curr.solar, 0).toFixed(1)} kWh`} subtext="Yield from connected arrays" trend="8.7" isPositive={false} />
        <StatCard title="Total Cost" value={`₹${chartData.reduce((acc, curr) => acc + parseFloat(curr.cost), 0).toFixed(2)}`} subtext="Estimated period billing" trend="4.2" isPositive={true} />
      </div>

      {/* ── Multi-Agent System (replaces static AI Insights) ──────────── */}
      <MultiAgentPanel period={period} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6 relative min-h-[400px]">
          <div className="flex items-center justify-between mb-8">
             <h3 className="text-base font-bold text-gray-900">Consumption vs Production</h3>
             {isLoading && <RefreshCcw size={16} className="text-emerald-500 animate-spin" />}
          </div>

          {error ? (
            <div className="h-64 flex items-center justify-center text-rose-500 font-medium">{error}</div>
          ) : (
            <div className="w-full flex-1 min-h-[320px]">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                  <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                  <Bar dataKey="consumption" fill="#00B4D8" radius={[4, 4, 0, 0]} name="Consumption (kWh)" />
                  <Bar dataKey="solar" fill="#06D6A0" radius={[4, 4, 0, 0]} name="Solar (kWh)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="glass-card p-6 min-h-[400px] flex flex-col">
          <h3 className="text-base font-bold text-gray-900 mb-8">Cost Breakdown</h3>
          <div className="w-full flex-1 min-h-[320px]">
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00B4D8" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#00B4D8" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                <Area type="monotone" dataKey="cost" stroke="#00B4D8" strokeWidth={3} fillOpacity={1} fill="url(#colorCost)" name="Daily Cost (₹)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
