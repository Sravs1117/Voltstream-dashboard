import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Sun, Activity, ArrowUpRight, ArrowDownRight, ShieldCheck, Download, 
  Clock, Leaf, HardDrive, Cpu, Zap, Battery, ZapOff, Home as HomeIcon
} from "lucide-react";
import { 
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend
} from "recharts";

// Clean mock data for dual-line comparison
const liveData = [
  { time: "00:00", solar: 0, grid: 2.1 },
  { time: "04:00", solar: 0, grid: 2.4 },
  { time: "08:00", solar: 3.2, grid: 0.8 },
  { time: "12:00", solar: 6.8, grid: 0.1 },
  { time: "16:00", solar: 4.5, grid: 0.5 },
  { time: "20:00", solar: 0.2, grid: 3.2 },
  { time: "23:59", solar: 0, grid: 2.3 },
];

const KPICard = ({ title, value, unit, trend, icon: Icon, color, glowColor }) => (
  <motion.div 
    whileHover={{ y: -8, scale: 1.02 }}
    className="relative overflow-hidden group rounded-[32px] p-7 bg-white/70 backdrop-blur-2xl border border-white/40 shadow-xl transition-all duration-500"
    style={{ 
      boxShadow: `0 20px 40px -15px ${glowColor}25`
    }}
  >
    <div 
      className="absolute -right-10 -bottom-10 w-40 h-40 rounded-full blur-[80px] opacity-20 group-hover:opacity-40 transition-opacity duration-700"
      style={{ background: color }}
    />
    
    <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-[0.03] group-hover:opacity-[0.07] group-hover:scale-125 transition-all duration-700 text-slate-900 pointer-events-none">
      <Icon size={120} strokeWidth={1} />
    </div>

    <div className="relative z-10">
      <div className="flex justify-between items-start mb-6">
        <div 
          className="p-4 rounded-2xl bg-white shadow-lg border border-white/50 relative overflow-hidden group-hover:shadow-2xl transition-all duration-500"
          style={{ color }}
        >
          <div className="absolute inset-0 opacity-10 blur-md scale-150" style={{ background: color }} />
          <Icon size={24} className="relative z-10" />
        </div>
        <div className={`flex items-center gap-1 text-[11px] font-black px-3 py-1.5 rounded-full backdrop-blur-md ${trend >= 0 ? "text-emerald-700 bg-emerald-100/50" : "text-rose-700 bg-rose-100/50"}`}>
          {trend >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {Math.abs(trend)}%
        </div>
      </div>
      
      <div>
        <p className="text-[12px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-2">{title}</p>
        <div className="flex items-baseline gap-2">
          <h3 className="text-4xl font-black text-slate-800 tracking-tighter">{value}</h3>
          <span className="text-sm font-bold text-slate-400 tracking-wider font-mono">{unit}</span>
        </div>
      </div>
    </div>

    <div 
      className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[80%] h-[2px] opacity-0 group-hover:opacity-100 transition-all duration-500 blur-[1px]"
      style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
    />
  </motion.div>
);

export default function LiveDashboard() {
  const [filter, setFilter] = useState("24h");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded (true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-10 pb-10 max-w-[1600px] mx-auto animate-fade-in py-8 px-8">
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <KPICard 
          title="Solar Generated" 
          value="42.8" 
          unit="kWh" 
          trend={14} 
          icon={Sun} 
          color="#FBBF24" 
          glowColor="#FBBF24"
        />
        <KPICard 
          title="Grid Imported" 
          value="12.4" 
          unit="kWh" 
          trend={-8} 
          icon={HardDrive} 
          color="#0EA5E9" 
          glowColor="#0EA5E9"
        />
        <KPICard 
          title="Battery Efficiency" 
          value="95.2" 
          unit="%" 
          trend={1.2} 
          icon={Battery} 
          color="#10B981" 
          glowColor="#10B981"
        />
        <KPICard 
          title="Total Consumption" 
          value="50.4" 
          unit="kWh" 
          trend={5} 
          icon={HomeIcon} 
          color="#F43F5E" 
          glowColor="#F43F5E"
        />
      </div>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-9 glass-card flex flex-col min-h-[600px] rounded-[32px] overflow-hidden bg-white shadow-xl shadow-slate-200/50">
          <div className="px-10 py-8 border-b border-slate-100 flex flex-wrap items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">Live Power Status</h3>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest border border-emerald-100 shadow-sm shadow-emerald-50">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Real-Time
                </div>
              </div>
              <p className="text-sm font-medium text-slate-400 mt-1.5">Real-time comparison of solar generation and grid draw</p>
            </div>
          </div>

          <div className="flex-1 p-10 bg-gradient-to-b from-transparent to-slate-50/30">
            {!isLoaded ? (
              <div className="w-full h-full shimmer rounded-[32px]" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={liveData} margin={{ top: 20, right: 30, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSolar" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#fbbf24" stopOpacity={0.25}/><stop offset="95%" stopColor="#fbbf24" stopOpacity={0}/></linearGradient>
                    <linearGradient id="colorGrid" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.25}/><stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="time" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: "#94a3b8", fontWeight: 700 }}
                    dy={15}
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#94a3b8", fontWeight: 700 }} />
                  <Tooltip 
                    cursor={{ stroke: "#cbd5e1", strokeWidth: 2, strokeDasharray: "5 5" }}
                    contentStyle={{ borderRadius: "24px", border: "1px solid #f1f5f9", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.15)", padding: "20px", fontWeight: "bold", background: "rgba(255,255,255,0.98)", backdropFilter: "blur(20px)" }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: "30px", fontWeight: "bold", fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px" }} />
                  
                  <Area type="monotone" name="Grid Draw" dataKey="grid" stroke="#0ea5e9" strokeWidth={4} fillOpacity={1} fill="url(#colorGrid)" animationDuration={1500} />
                  <Area type="monotone" name="Solar Gen" dataKey="solar" stroke="#fbbf24" strokeWidth={4} fillOpacity={1} fill="url(#colorSolar)" animationDuration={1500} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
          
          <div className="px-10 py-8 border-t border-slate-100 bg-slate-50/50 grid grid-cols-2 md:grid-cols-4 gap-10">
            {[
              { label: "Peak Usage Time", val: "16:45 PM", icon: Zap, color: "#f43f5e" },
              { label: "Lowest Consumption", val: "03:15 AM", icon: ZapOff, color: "#10b981" },
              { label: "Efficiency Score", val: "94.2 / 100", icon: Cpu, color: "#0ea5e9" },
              { label: "Carbon Savings", val: "14.2 kg", icon: Leaf, color: "#10b981" },
            ].map((stat, i) => (
              <div key={i} className="flex flex-col gap-1.5 transition-transform hover:translate-x-1 duration-300">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-white shadow-sm border border-slate-100/60">
                    <stat.icon size={16} style={{ color: stat.color }} />
                  </div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{stat.label}</span>
                </div>
                <p className="text-xl font-black text-slate-800 ml-10 tracking-tight">{stat.val}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right side panels */}
        <div className="col-span-12 lg:col-span-3 space-y-8">
          <div className="glass-card p-8 rounded-[32px] bg-slate-900 text-white relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-700">
               <Sun size={120} />
            </div>
            <div className="relative z-10">
              <h3 className="text-xl font-black tracking-tight mb-2">Solar Yield</h3>
              <p className="text-sm font-medium text-slate-400 mb-8">Today s optimal performance</p>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-5xl font-black tracking-tighter text-sky-400">42.8</span>
                <span className="text-xl font-bold text-slate-500">kWh</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full mt-6 overflow-hidden">
                <motion.div 
                   initial={{ width: 0 }}
                   animate={{ width: "75%" }}
                   transition={{ duration: 1.5, delay: 0.5 }}
                   className="h-full bg-gradient-to-r from-sky-500 to-emerald-400 rounded-full"
                />
              </div>
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 mt-4">75% of Daily Target</p>
            </div>
          </div>

          <div className="glass-card p-8 rounded-[32px] bg-white border border-slate-100 shadow-xl shadow-slate-200/40">
             <div className="flex items-center justify-between mb-8">
                <h3 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                  <Activity size={18} className="text-sky-500" />
                  Device Insights
                </h3>
             </div>
             <div className="space-y-6">
                {[
                  { name: "HVAC System", load: "2.4 kW", prop: "35%" },
                  { name: "EV Charger", load: "7.2 kW", prop: "55%" },
                  { name: "Lighting", load: "0.4 kW", prop: "10%" },
                ].map((device, i) => (
                  <div key={i} className="group cursor-pointer">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-bold text-slate-600 group-hover:text-slate-900 transition-colors">{device.name}</span>
                      <span className="text-sm font-black text-slate-800">{device.load}</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-slate-300 group-hover:bg-sky-500 transition-colors" style={{ width: device.prop }} />
                    </div>
                  </div>
                ))}
             </div>
             <button 
               onClick={() => window.location.href = '/control'}
               className="w-full mt-8 py-3 rounded-2xl bg-slate-50 text-[11px] font-black text-slate-500 uppercase tracking-widest hover:bg-slate-100 hover:text-slate-700 transition-colors"
             >
               Manage Devices
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}