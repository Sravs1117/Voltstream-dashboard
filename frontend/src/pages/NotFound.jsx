import React from 'react';
import { Link } from 'react-router-dom';
import { Home, AlertCircle, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6 bg-white rounded-[3rem] border border-slate-100 shadow-xl m-4">
      <div className="w-24 h-24 bg-rose-50 text-rose-500 flex items-center justify-center rounded-[2rem] mb-8 animate-bounce">
        <AlertCircle size={48} />
      </div>
      <h1 className="text-6xl font-black text-slate-900 mb-4">404</h1>
      <h2 className="text-2xl font-bold text-slate-800 mb-4">Not Found</h2>
      <p className="text-slate-500 font-medium max-w-md mb-10 leading-relaxed">
        The energy coordinate you requested does not exist or has been shifted. 
        Please navigate back to the main station.
      </p>
      <Link 
        to="/" 
        className="flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
      >
        <ArrowLeft size={20} />
        Back to Dashboard
      </Link>
    </div>
  );
}
