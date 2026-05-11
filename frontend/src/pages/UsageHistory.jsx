import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { Calendar, Download, Zap, ArrowUpRight, ArrowDownRight, RefreshCcw } from 'lucide-react';
import api from '../services/api';
import useApi from '../hooks/useApi';

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

export default function UsageHistory() {
  const [period, setPeriod] = useState('daily');
  const { data: analyticsData, isLoading, error, execute } = useApi(api.getAnalyticsHistory, false);

  useEffect(() => {
    execute(period);
  }, [period, execute]);

  const chartData = (analyticsData?.data || analyticsData || []).map(item => ({
    name: item.label,
    consumption: item.consumption_kwh,
    solar: item.generation_kwh,
    cost: (item.consumption_kwh * 0.28).toFixed(2)
  })) || [];

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
            <ResponsiveContainer width="100%" minHeight={320}>
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
