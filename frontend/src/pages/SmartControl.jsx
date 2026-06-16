import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Zap, Wind, Thermometer, Lightbulb, Tv,
  Settings2, Clock, RefreshCcw, AlertCircle,
  Flame, Droplets, Refrigerator, WashingMachine, Microwave, AirVent, ChefHat, Plus,
  Loader2, Bot, Send, CheckCircle2, XCircle
} from 'lucide-react';
import api from '../services/api';
import useApi from '../hooks/useApi';

// ─── Shared base URL for the agent endpoint ───────────────────────────────────
const AGENT_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD
    ? 'https://voltstream-api-883519779329.us-central1.run.app/api/v1'
    : 'http://127.0.0.1:8000/api/v1');

// console.log('[SmartControl] env debug', {
//   href: window.location.href,
//   origin: window.location.origin,
//   prod: import.meta.env.PROD,
//   dev: import.meta.env.DEV,
//   viteApiBaseUrl: import.meta.env.VITE_API_BASE_URL,
//   agentBase: AGENT_BASE,
// });

// ─── Device icon resolver ──────────────────────────────────────────────────────
const getDeviceIcon = (device) => {
  const name = device.name.toLowerCase();
  if (/\bac\b/.test(name) || name.includes('air conditioner')) return AirVent;
  if (name.includes('heater')) return Flame;
  if (name.includes('fridge') || name.includes('refrigerator')) return Refrigerator;
  if (name.includes('wash')) return WashingMachine;
  if (name.includes('microwave') || name.includes('oven')) return Microwave;
  if (name.includes('dish')) return Droplets;
  if (name.includes('tv') || name.includes('television')) return Tv;
  if (name.includes('light')) return Lightbulb;
  const typeMap = { hvac: Wind, appliance: Zap, lighting: Lightbulb, entertainment: Tv, kitchen: ChefHat };
  return typeMap[device.type] || Zap;
};

// ─── Device card ──────────────────────────────────────────────────────────────
const DeviceCard = ({ device, onToggle }) => {
  const Icon = getDeviceIcon(device);
  const isOn = device.is_on;
  return (
    <div className="glass-card p-5 group">
      <div className="flex items-start justify-between mb-6">
        <div className={`p-3 rounded-2xl transition-colors ${isOn ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-50 text-gray-400'}`}>
          <Icon size={24} />
        </div>
        <button
          onClick={() => onToggle(device.id, !isOn)}
          className={`w-12 h-6 rounded-full transition-colors relative flex items-center ${isOn ? 'bg-emerald-500' : 'bg-gray-200'}`}
        >
          <div className={`w-4 h-4 bg-white rounded-full absolute transition-all ${isOn ? 'right-1' : 'left-1'}`} />
        </button>
      </div>
      <div>
        <h3 className="font-bold text-gray-900 group-hover:text-emerald-600 transition-colors uppercase text-sm tracking-tight">{device.name}</h3>
        <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-widest">{device.type}</p>
      </div>
      <div className="mt-6 flex items-center justify-between border-t border-gray-50 pt-4">
        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400">
          <Zap size={14} className={isOn ? 'text-emerald-500' : ''} />
          {isOn ? `${(device.power_w / 1000).toFixed(1)}kW` : '0.0kW'}
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-widest ${isOn ? 'text-emerald-600' : 'text-gray-400'}`}>
          {isOn ? 'Active' : 'Offline'}
        </span>
      </div>
    </div>
  );
};

// ─── VoltStream AI Agent Panel ────────────────────────────────────────────────
const CHIP_SUGGESTIONS = [
  'Turn on all devices',
  'Switch on bedroom lights',
  'Turn off all devices',
];

const AgentPanel = ({ onAgentAction }) => {
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [reply, setReply]       = useState(null);   // { text, ok }
  const inputRef                = useRef(null);

  const runAgent = async (prompt) => {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setReply(null);
    try {
      // console.log('[SmartControl] fetch request', {
      //   url: `${AGENT_BASE}/agent`,
      //   prompt: prompt.trim(),
      // });
      const res = await fetch(`${AGENT_BASE}/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), session_id: 'voltstream_ui_session' }),
      });
      const data = await res.json();
      setReply({ text: data.reply || 'Done.', ok: res.ok });
      if (onAgentAction) onAgentAction();   // trigger device list refresh
    } catch (err) {
      setReply({ text: 'Could not reach the VoltStream AI Agent. Is the backend running?', ok: false });
    } finally {
    
      setLoading(false);
      setInput('');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    runAgent(input);
  };

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #0f1923 0%, #111827 60%, #0d2118 100%)',
        border: '1px solid rgba(52, 211, 153, 0.18)',
        borderRadius: '20px',
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      {/* Background glow blobs */}
      <div style={{
        position: 'absolute', top: '-40px', left: '-40px',
        width: '160px', height: '160px',
        background: 'radial-gradient(circle, rgba(52,211,153,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-30px', right: '200px',
        width: '120px', height: '120px',
        background: 'radial-gradient(circle, rgba(52,211,153,0.07) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* ── Avatar ─────────────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
        <div style={{
          width: '56px', height: '56px', borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, #1a3d2e, #0d1f17)',
          border: '2px solid rgba(52,211,153,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 18px rgba(52,211,153,0.25), 0 0 6px rgba(52,211,153,0.15)',
          animation: 'agentPulse 3s ease-in-out infinite',
        }}>
          <Bot size={28} color="#34d399" strokeWidth={1.5} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ color: '#f9fafb', fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
            VoltStream AI Agent
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
            <span style={{
              width: '7px', height: '7px', borderRadius: '50%', background: '#34d399',
              boxShadow: '0 0 6px #34d399', display: 'inline-block',
              animation: 'agentDot 2s ease-in-out infinite',
            }} />
            <span style={{ color: '#34d399', fontSize: '10px', fontWeight: 600, letterSpacing: '0.05em' }}>Agent Online</span>
          </span>
          <span style={{ color: '#6b7280', fontSize: '10px', marginTop: '2px', whiteSpace: 'nowrap' }}>
            Control devices using natural language
          </span>
        </div>
      </div>

      {/* ── Input column ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <form onSubmit={handleSubmit}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'rgba(255,255,255,0.04)',
            border: '1.5px solid rgba(52,211,153,0.25)',
            borderRadius: '12px',
            padding: '10px 14px',
            backdropFilter: 'blur(8px)',
            transition: 'border-color 0.2s',
          }}
            onFocus={() => {}}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder='Try: "Turn off living room AC"'
              disabled={loading}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                color: '#f3f4f6', fontSize: '14px', fontWeight: 500,
                '::placeholder': { color: '#6b7280' },
              }}
            />
          </div>
        </form>

        {/* Chip suggestions */}
        <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
          {CHIP_SUGGESTIONS.map((chip) => (
            <button
              key={chip}
              onClick={() => { setInput(chip); inputRef.current?.focus(); }}
              disabled={loading}
              style={{
                background: 'rgba(52,211,153,0.08)',
                border: '1px solid rgba(52,211,153,0.18)',
                borderRadius: '20px',
                color: '#9ca3af',
                fontSize: '11px',
                fontWeight: 500,
                padding: '3px 10px',
                cursor: 'pointer',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(52,211,153,0.15)';
                e.currentTarget.style.color = '#d1fae5';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(52,211,153,0.08)';
                e.currentTarget.style.color = '#9ca3af';
              }}
            >
              "{chip}"
            </button>
          ))}
        </div>

        {/* Reply banner */}
        {reply && (
          <div style={{
            marginTop: '10px',
            padding: '9px 14px',
            borderRadius: '10px',
            background: reply.ok ? 'rgba(52,211,153,0.09)' : 'rgba(239,68,68,0.09)',
            border: `1px solid ${reply.ok ? 'rgba(52,211,153,0.25)' : 'rgba(239,68,68,0.25)'}`,
            display: 'flex', alignItems: 'flex-start', gap: '8px',
          }}>
            {reply.ok
              ? <CheckCircle2 size={15} color="#34d399" style={{ flexShrink: 0, marginTop: '1px' }} />
              : <XCircle     size={15} color="#f87171" style={{ flexShrink: 0, marginTop: '1px' }} />
            }
            <span style={{ color: reply.ok ? '#a7f3d0' : '#fca5a5', fontSize: '12px', fontWeight: 500, lineHeight: 1.5 }}>
              {reply.text}
            </span>
          </div>
        )}
      </div>

      {/* ── Execute button ───────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0 }}>
        <button
          onClick={() => runAgent(input)}
          disabled={loading || !input.trim()}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '13px 22px',
            background: loading || !input.trim()
              ? 'rgba(52,211,153,0.15)'
              : 'linear-gradient(135deg, #0d1f17 0%, #111827 100%)',
            border: '1.5px solid rgba(52,211,153,0.4)',
            borderRadius: '14px',
            color: loading || !input.trim() ? '#6b7280' : '#34d399',
            fontWeight: 700,
            fontSize: '14px',
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
            boxShadow: loading || !input.trim() ? 'none' : '0 4px 20px rgba(52,211,153,0.2)',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            if (!loading && input.trim()) {
              e.currentTarget.style.boxShadow = '0 4px 28px rgba(52,211,153,0.35)';
              e.currentTarget.style.borderColor = 'rgba(52,211,153,0.7)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(52,211,153,0.2)';
            e.currentTarget.style.borderColor = 'rgba(52,211,153,0.4)';
          }}
        >
          {loading
            ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
            : <Send size={15} />
          }
          Execute
        </button>
      </div>

      {/* Keyframe styles injected inline */}
      <style>{`
        @keyframes agentPulse {
          0%, 100% { box-shadow: 0 0 18px rgba(52,211,153,0.25), 0 0 6px rgba(52,211,153,0.15); }
          50%       { box-shadow: 0 0 28px rgba(52,211,153,0.45), 0 0 12px rgba(52,211,153,0.3); }
        }
        @keyframes agentDot {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SmartControl() {
  const { data: devices, isLoading, error, execute } = useApi(api.getDevices);
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') || '';

  const [policies, setPolicies] = useState([
    { id: 1, title: 'Peak Load Protection', desc: 'Auto-shed non-critical loads during peak tariff hours.', icon: Zap, status: 'Active' },
    { id: 2, title: 'Away Protocol', desc: 'Secure and shut down all entertainment and climate systems.', icon: Clock, status: 'Inactive' },
  ]);

  const [isAutomationModalOpen, setIsAutomationModalOpen] = useState(false);
  const [automationRule, setAutomationRule] = useState({ device: '', action: 'off', time: '' });
  const [activeRules, setActiveRules] = useState([]);

  const [isAddDeviceModalOpen, setIsAddDeviceModalOpen] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newDeviceType, setNewDeviceType] = useState('appliance');

  const [localDevices, setLocalDevices] = useState([]);

  useEffect(() => { execute(); }, []);

  useEffect(() => {
    if (devices) setLocalDevices(devices?.data || devices || []);
  }, [devices]);

  // Automation rule timer
  useEffect(() => {
    if (activeRules.length === 0) return;
    const interval = setInterval(() => {
      const now = new Date();
      const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      activeRules.forEach(rule => {
        if (!rule.executed && rule.time === currentTimeStr) {
          // console.log(`Executing automation: Turn ${rule.action} device ${rule.device}`);
          handleToggle(rule.device, rule.action === 'on');
          setActiveRules(prev => prev.map(r => r === rule ? { ...r, executed: true } : r));
        }
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [activeRules, localDevices]);

  const handleToggle = async (id, newState) => {
    setLocalDevices(prev => prev.map(d => d.id === id ? { ...d, is_on: newState } : d));
    try {
      await api.toggleDevice(id, newState);
    } catch (err) {
      setLocalDevices(prev => prev.map(d => d.id === id ? { ...d, is_on: !newState } : d));
      alert('Failed to update device. Rolling back.');
      console.error('Failed to toggle device:', err);
    }
  };

  const togglePolicy = (id) =>
    setPolicies(policies.map(p => p.id === id ? { ...p, status: p.status === 'Active' ? 'Inactive' : 'Active' } : p));

  const handleSaveAutomation = (e) => {
    e.preventDefault();
    const deviceName = localDevices.find(d => d.id === automationRule.device)?.name || 'Unknown Device';
    alert(`Automation saved!\n\nDevice: ${deviceName}\nAction: Turn ${automationRule.action}\nTime: ${automationRule.time}`);
    setActiveRules(prev => [...prev, { ...automationRule, executed: false }]);
    setIsAutomationModalOpen(false);
    setAutomationRule({ device: '', action: 'off', time: '' });
  };

  const handleAddDevice = async (e) => {
    e.preventDefault();
    const name = newDeviceName.trim();
    if (!name) return;
    try {
      const response = await api.addDevice({ name, type: newDeviceType });
      setLocalDevices(prev => [...prev, response.data]);
      setIsAddDeviceModalOpen(false);
      setNewDeviceName('');
      setNewDeviceType('appliance');
    } catch (err) {
      alert('Failed to add new device. Please try again.');
      console.error('Failed to add device:', err);
    }
  };

  const filteredDevices = localDevices.filter(device =>
    device.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    device.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Smart Control</h1>
          <p className="text-sm text-gray-500">Live grid of connected appliances with remote toggle</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => execute()} className="p-2 text-gray-400 hover:text-emerald-500 transition-colors">
            <RefreshCcw size={20} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setIsAutomationModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-800 transition-colors shadow-lg shadow-gray-200">
            <Settings2 size={16} /> Automation
          </button>
          <button onClick={() => setIsAddDeviceModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-bold hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-100">
            <Plus size={16} /> Add Device
          </button>
        </div>
      </div>

      {/* ── VoltStream AI Agent Panel ──────────────────────────────────── */}
      <AgentPanel onAgentAction={() => execute()} />

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      {isAutomationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <h2 className="text-xl font-extrabold text-gray-900 mb-2">Create Automation Rule</h2>
            <p className="text-sm text-gray-500 mb-6">Set up a timer or schedule for your smart devices.</p>
            <form onSubmit={handleSaveAutomation} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Select Device</label>
                <select
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-emerald-500"
                  value={automationRule.device}
                  onChange={(e) => setAutomationRule({ ...automationRule, device: e.target.value })}
                  required
                >
                  <option value="">-- Choose a device --</option>
                  {localDevices?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Action</label>
                  <select
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-emerald-500"
                    value={automationRule.action}
                    onChange={(e) => setAutomationRule({ ...automationRule, action: e.target.value })}
                  >
                    <option value="on">Turn On</option>
                    <option value="off">Turn Off</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Time</label>
                  <input
                    type="time"
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-emerald-500"
                    value={automationRule.time}
                    onChange={(e) => setAutomationRule({ ...automationRule, time: e.target.value })}
                    required
                  />
                  <p className="text-[10px] text-gray-400 mt-1">In 24-hour format (e.g., 22:30 for 10:30 PM)</p>
                </div>
              </div>
              <div className="flex gap-3 pt-6">
                <button type="button" onClick={() => setIsAutomationModalOpen(false)} className="flex-1 py-3 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
                <button type="submit" className="flex-1 py-3 text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl shadow-lg shadow-emerald-200 transition-colors">Save Rule</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAddDeviceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <h2 className="text-xl font-extrabold text-gray-900 mb-2">Add Smart Device</h2>
            <p className="text-sm text-gray-500 mb-6">Register a new home appliance to your smart grid dashboard.</p>
            <form onSubmit={handleAddDevice} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Device Name</label>
                <input
                  type="text"
                  placeholder="e.g. Guest Room AC, Study Lights"
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-emerald-500"
                  value={newDeviceName}
                  onChange={(e) => setNewDeviceName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Device Type</label>
                <select
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-emerald-500"
                  value={newDeviceType}
                  onChange={(e) => setNewDeviceType(e.target.value)}
                  required
                >
                  <option value="hvac">HVAC / Air Conditioning</option>
                  <option value="appliance">Appliance / General Smart Plug</option>
                  <option value="lighting">Lighting / Smart Bulb</option>
                  <option value="entertainment">Entertainment / TV & Audio</option>
                  <option value="kitchen">Kitchen / Oven & Fridge</option>
                </select>
              </div>
              <div className="flex gap-3 pt-6">
                <button type="button" onClick={() => setIsAddDeviceModalOpen(false)} className="flex-1 py-3 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
                <button type="submit" className="flex-1 py-3 text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl shadow-lg shadow-emerald-200 transition-colors">Add Appliance</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600">
          <AlertCircle size={20} />
          <p className="text-sm font-bold">Failed to load devices: {error}</p>
        </div>
      )}

      {/* ── Device Grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {isLoading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="glass-card p-5 h-48 animate-pulse bg-gray-50/50" />
          ))
        ) : filteredDevices?.length > 0 ? (
          filteredDevices.map((device) => (
            <DeviceCard key={device.id} device={device} onToggle={handleToggle} />
          ))
        ) : (
          <div className="col-span-4 p-8 text-center text-gray-500 bg-gray-50 rounded-3xl border border-gray-100 border-dashed">
            <p className="font-bold">No devices matched your search "{searchQuery}"</p>
            <button onClick={() => setSearchParams({})} className="mt-4 px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:text-emerald-500 shadow-sm transition-colors">
              Clear Search
            </button>
          </div>
        )}
      </div>

      {/* ── Policies Section ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        <div className="lg:col-span-2 glass-card p-6">
          <h3 className="text-base font-bold text-gray-900 mb-6">Device Management Policies</h3>
          <div className="space-y-4">
            {policies.map((policy) => (
              <div
                key={policy.id}
                onClick={() => togglePolicy(policy.id)}
                className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 border border-gray-100 group hover:border-emerald-200 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl bg-white flex items-center justify-center transition-all shadow-sm ${policy.status === 'Active' ? 'text-emerald-500' : 'text-gray-400 group-hover:text-emerald-500'}`}>
                    <policy.icon size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">{policy.title}</h4>
                    <p className="text-xs text-gray-500 mt-0.5">{policy.desc}</p>
                  </div>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full transition-colors ${policy.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'}`}>
                  {policy.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
