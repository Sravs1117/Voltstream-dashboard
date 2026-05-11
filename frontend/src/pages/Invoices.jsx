import React, { useEffect } from 'react';
import { 
  FileText, Download, CheckCircle2, Clock, 
  CreditCard, AlertTriangle, TrendingUp, Wallet 
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import api from '../services/api';
import useApi from '../hooks/useApi';

const invoices = [
  { id: 'IV-2026-005', date: 'May 01, 2026', amount: '247.60', status: 'Paid', method: 'Visa •••• 4242' },
  { id: 'IV-2026-004', date: 'Apr 01, 2026', amount: '138.20', status: 'Paid', method: 'Visa •••• 4242' },
  { id: 'IV-2026-003', date: 'Mar 01, 2026', amount: '156.80', status: 'Paid', method: 'Visa •••• 4242' },
];

export default function Invoices() {
  const { data: billSummary, loading, execute } = useApi(api.getBillingSummary);

  useEffect(() => {
    execute();
  }, []);

  const handleDownloadPdf = (inv) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(0, 180, 216);
    doc.text('VoltStream', 20, 20);
    
    // Title
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text('Invoice Details', 20, 35);
    
    // Details
    doc.setFontSize(12);
    doc.setTextColor(100, 116, 139);
    doc.text('Invoice ID:', 20, 50);
    doc.text('Billing Date:', 20, 60);
    doc.text('Payment Status:', 20, 70);
    doc.text('Payment Method:', 20, 80);
    
    // Values
    doc.setTextColor(15, 23, 42);
    doc.text(String(inv.id), 65, 50);
    doc.text(String(inv.date), 65, 60);
    doc.text(String(inv.status).toUpperCase(), 65, 70);
    doc.text(String(inv.method), 65, 80);
    
    // Line separator
    doc.setDrawColor(226, 232, 240);
    doc.line(20, 90, 190, 90);
    
    // Total
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text('Total Amount:', 20, 105);
    doc.text(`Rs. ${inv.amount}`, 65, 105);
    
    // Footer
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text('Thank you for choosing VoltStream.', 20, 130);

    doc.save(`${inv.id}.pdf`);
  };

  const isOverBudget = billSummary?.projected_bill > billSummary?.budget_limit;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Billing & Invoices</h1>
          <p className="text-sm text-gray-500">Live cost tracking and projected monthly billing</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 border-l-4 border-l-sky-500">
           <div className="flex items-center justify-between mb-2 text-gray-400">
              <Wallet size={18} />
              <span className="text-[10px] font-black uppercase">Current Balance</span>
           </div>
           <h2 className="text-3xl font-black text-gray-900">₹{billSummary?.current_cost || '0.00'}</h2>
           <p className="text-xs text-gray-500 mt-2">Due by June 1, 2026</p>
        </div>

        <div className="glass-card p-6 border-l-4 border-l-emerald-500">
           <div className="flex items-center justify-between mb-2 text-gray-400">
              <TrendingUp size={18} />
              <span className="text-[10px] font-black uppercase">Projected Bill</span>
           </div>
           <h2 className="text-3xl font-black text-gray-900">₹{billSummary?.projected_bill || '0.00'}</h2>
           <p className="text-xs text-emerald-600 mt-2 font-bold flex items-center gap-1">
             <CheckCircle2 size={12} /> On track with usage
           </p>
        </div>

        <div className={`glass-card p-6 border-l-4 ${isOverBudget ? 'border-l-rose-500 bg-rose-50/50' : 'border-l-amber-500'}`}>
           <div className="flex items-center justify-between mb-2 text-gray-400">
              <AlertTriangle size={18} className={isOverBudget ? 'text-rose-500' : ''} />
              <span className={`text-[10px] font-black uppercase ${isOverBudget ? 'text-rose-600' : ''}`}>Budget Status</span>
           </div>
           <h2 className={`text-3xl font-black ${isOverBudget ? 'text-rose-700' : 'text-gray-900'}`}>
             {isOverBudget ? 'Over Budget' : 'Safe'}
           </h2>
           <p className="text-xs text-gray-500 mt-2">Limit: ₹{billSummary?.budget_limit || '0.00'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">Historical Invoices</h3>
          </div>
          <div className="divide-y divide-gray-50 text-sm">
            {invoices.map((inv) => (
              <div key={inv.id} className="px-6 py-5 flex items-center justify-between group hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">{inv.id}</h4>
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest">{inv.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <div className="text-right hidden sm:block">
                    <p className="font-bold text-gray-900">₹{inv.amount}</p>
                    <p className="text-[10px] text-gray-400 font-medium">{inv.method}</p>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase tracking-wider">
                    <CheckCircle2 size={12} /> PAID
                  </div>
                  <button onClick={() => handleDownloadPdf(inv)} className="p-2 text-gray-400 hover:text-sky-500 transition-colors block">
                    <Download size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
