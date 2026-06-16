import React, { useState, useEffect } from 'react';
import {
  Play, Download, Loader2, CheckCircle2, XCircle, AlertCircle,
  ChevronDown, ChevronUp, ClipboardList, Info, RefreshCw, Star
} from 'lucide-react';
import { jsPDF } from 'jspdf';


// ─── Shared base URL ────────────────────────────────────────────────────────
const BENCHMARK_API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD
    ? 'https://voltstream-api-883519779329.us-central1.run.app/api/v1'
    : 'http://127.0.0.1:8000/api/v1');

// console.log('[BenchmarkResults] env debug', {
//   href: window.location.href,
//   origin: window.location.origin,
//   prod: import.meta.env.PROD,
//   dev: import.meta.env.DEV,
//   viteApiBaseUrl: import.meta.env.VITE_API_BASE_URL,
//   benchmarkBase: BENCHMARK_API_BASE,
// });

export default function BenchmarkResults() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);
  const [error, setError] = useState(null);

  // Load last stored results on mount
  useEffect(() => {
    fetchResults();
  }, []);

  const fetchResults = async () => {
    try {
      setError(null);
      const res = await fetch(`${BENCHMARK_API_BASE}/insights/benchmark`);
      if (!res.ok) throw new Error('Failed to fetch benchmark results');
      const data = await res.json();
      if (data.status === 'success' && Array.isArray(data.results)) {
        setResults(data.results);
      }
    } catch (err) {
      console.error(err);
      setError('Could not load past benchmark results. Is the backend server running?');
    }
  };

  const runBenchmark = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    setResults([]);
    setExpandedRow(null);

    try {
      const res = await fetch(`${BENCHMARK_API_BASE}/insights/benchmark`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Benchmark run failed.');
      const data = await res.json();
      if (data.status === 'success' && Array.isArray(data.results)) {
        setResults(data.results);
      } else {
        throw new Error(data.message || 'Unknown error occurred.');
      }
    } catch (err) {
      console.error(err);
      setError('Error running benchmark: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const exportJSON = () => {
    if (!results || results.length === 0) return;
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `voltstream_rag_benchmark_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportCSV = () => {
    if (!results || results.length === 0) return;
    const headers = ['Question', 'Answer', 'Context', 'Faithfulness', 'Relevance', 'Coverage', 'Status', 'Reason'];
    const csvRows = [headers.join(',')];
    
    results.forEach(r => {
      const row = [
        r.question,
        r.answer,
        r.context || '',
        r.faithfulness,
        r.relevance,
        r.coverage,
        r.status,
        r.reason || ''
      ].map(val => {
        const escaped = ('' + val).replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(row.join(','));
    });
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `voltstream_rag_benchmark_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadPDF = () => {
    if (!results || results.length === 0) return;
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(22);
    doc.setTextColor(6, 182, 212); // Cyan theme matching VoltStream UI
    doc.text('VoltStream RAG Evaluation Report', 20, 20);
    
    // Subtitle
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated on: ${new Date().toLocaleDateString()} | Suite size: ${results.length} Questions`, 20, 28);
    
    // Divider
    doc.setDrawColor(226, 232, 240);
    doc.line(20, 32, 190, 32);
    
    // Summary Metrics
    const passed = results.filter(r => r.status === 'PASS').length;
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.text('Summary Results:', 20, 42);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Total Questions: ${results.length}`, 20, 48);
    doc.text(`Passed: ${passed} / ${results.length}`, 20, 54);
    doc.text(`Pass Rate: ${(passed / results.length * 100).toFixed(1)}%`, 20, 60);
    
    let y = 72;
    results.forEach((r, idx) => {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
      
      // Question
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      const qText = `Q${idx + 1}: ${r.question}`;
      const splitQ = doc.splitTextToSize(qText, 170);
      doc.text(splitQ, 20, y);
      y += (splitQ.length * 5) + 1;
      
      // Scores
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(`Faithfulness: ${r.faithfulness}/10 | Relevance: ${r.relevance}/10 | Coverage: ${r.coverage}/10`, 25, y);
      y += 5;
      
      // Status
      doc.setFont('helvetica', 'bold');
      if (r.status === 'PASS') {
        doc.setTextColor(16, 185, 129); // green
      } else {
        doc.setTextColor(239, 68, 68); // red
      }
      doc.text(`Status: ${r.status}`, 25, y);
      y += 8;
    });
    
    doc.save(`voltstream_evaluation_report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Metrics
  const totalPassed = results.filter(r => r.status === 'PASS').length;
  const totalFailed = results.length - totalPassed;
  
  const avgFaithfulness = results.length > 0 
    ? (results.reduce((acc, curr) => acc + curr.faithfulness, 0) / results.length).toFixed(1)
    : '0.0';
    
  const avgRelevance = results.length > 0 
    ? (results.reduce((acc, curr) => acc + curr.relevance, 0) / results.length).toFixed(1)
    : '0.0';
    
  const avgCoverage = results.length > 0 
    ? (results.reduce((acc, curr) => acc + curr.coverage, 0) / results.length).toFixed(1)
    : '0.0';

  const toggleRow = (idx) => {
    setExpandedRow(expandedRow === idx ? null : idx);
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0d1b2a 0%, #111827 55%, #0a1628 100%)',
      border: '1px solid rgba(6,182,212,0.15)',
      borderRadius: '20px',
      padding: '30px',
      color: '#e2e8f0',
      minHeight: '75vh',
      boxShadow: '0 8px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background glow blobs */}
      <div style={{
        position: 'absolute', top: '-100px', left: '-100px',
        width: '300px', height: '300px',
        background: 'radial-gradient(circle, rgba(6,182,212,0.1) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-100px', right: '-100px',
        width: '350px', height: '350px',
        background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px', marginBottom: '30px', zIndex: 1, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px',
            background: 'rgba(6,182,212,0.1)',
            border: '2.5px solid rgba(6,182,212,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 15px rgba(6,182,212,0.15)',
          }}>
            <ClipboardList size={24} color="#06b6d4" strokeWidth={1.5} />
          </div>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', margin: 0 }}>
              RAG Quality Benchmark
            </h1>
            <p style={{ fontSize: '13px', color: '#9ca3af', marginTop: '4px', margin: 0 }}>
              LLM-as-a-Judge evaluation suite running 10 document-grounded energy efficiency queries.
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          {results.length > 0 && !loading && (
            <button
              onClick={downloadPDF}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 20px',
                background: 'linear-gradient(135deg, #0284c7, #0891b2)',
                border: '1px solid rgba(6,182,212,0.35)',
                borderRadius: '10px',
                color: '#ffffff',
                fontWeight: 700, fontSize: '13px',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(6,182,212,0.2)',
                transition: 'all 0.2s',
              }}
            >
              <Download size={14} /> Download PDF Report
            </button>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '10px',
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: '#fca5a5',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '25px',
          zIndex: 1,
          position: 'relative'
        }}>
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Loading overlay panel */}
      {loading && (
        <div style={{
          padding: '40px',
          borderRadius: '15px',
          background: 'rgba(0, 0, 0, 0.2)',
          border: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          margin: '30px 0',
          zIndex: 1,
          position: 'relative'
        }}>
          <Loader2 size={40} color="#06b6d4" style={{ animation: 'spin 1.5s linear infinite', marginBottom: '16px' }} />
          <h3 style={{ margin: '0 0 8px 0', color: '#ffffff', fontSize: '16px', fontWeight: 700 }}>
            Executing Benchmark Evaluation
          </h3>
          <p style={{ margin: 0, color: '#9ca3af', fontSize: '13px', maxWidth: '450px', lineHeight: '1.6' }}>
            Sending 10 predefined test questions through the Advisor Agent and running the Evaluator Agent LLM-as-a-Judge.
            Please wait (approx. 20s to ensure Gemini rate limit compliance)...
          </p>
        </div>
      )}

      {/* Results panel */}
      {!loading && results.length > 0 && (
        <div style={{ zIndex: 1, position: 'relative' }}>
          {/* Summary Metric Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '15px',
            marginBottom: '30px'
          }}>
            {/* Faithfulness */}
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '12px',
              padding: '16px',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
            }}>
              <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Avg Faithfulness
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '8px' }}>
                <span style={{ fontSize: '26px', fontWeight: 800, color: '#ffffff' }}>{avgFaithfulness}</span>
                <span style={{ fontSize: '13px', color: '#6b7280' }}>/ 10</span>
              </div>
              <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', marginTop: '10px', overflow: 'hidden' }}>
                <div style={{ width: `${parseFloat(avgFaithfulness) * 10}%`, height: '100%', background: '#06b6d4', borderRadius: '2px' }} />
              </div>
            </div>

            {/* Relevance */}
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '12px',
              padding: '16px',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
            }}>
              <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Avg Relevance
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '8px' }}>
                <span style={{ fontSize: '26px', fontWeight: 800, color: '#ffffff' }}>{avgRelevance}</span>
                <span style={{ fontSize: '13px', color: '#6b7280' }}>/ 10</span>
              </div>
              <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', marginTop: '10px', overflow: 'hidden' }}>
                <div style={{ width: `${parseFloat(avgRelevance) * 10}%`, height: '100%', background: '#06b6d4', borderRadius: '2px' }} />
              </div>
            </div>

            {/* Coverage */}
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '12px',
              padding: '16px',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
            }}>
              <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Avg Coverage
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '8px' }}>
                <span style={{ fontSize: '26px', fontWeight: 800, color: '#ffffff' }}>{avgCoverage}</span>
                <span style={{ fontSize: '13px', color: '#6b7280' }}>/ 10</span>
              </div>
              <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', marginTop: '10px', overflow: 'hidden' }}>
                <div style={{ width: `${parseFloat(avgCoverage) * 10}%`, height: '100%', background: '#06b6d4', borderRadius: '2px' }} />
              </div>
            </div>

            {/* Passed */}
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '12px',
              padding: '16px',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
            }}>
              <span style={{ fontSize: '11px', color: '#34d399', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Total Passed
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '8px' }}>
                <span style={{ fontSize: '26px', fontWeight: 800, color: '#34d399' }}>{totalPassed}</span>
                <span style={{ fontSize: '13px', color: '#6b7280' }}>/ 10</span>
              </div>
              <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', marginTop: '10px', overflow: 'hidden' }}>
                <div style={{ width: `${(totalPassed / results.length) * 100}%`, height: '100%', background: '#10b981', borderRadius: '2px' }} />
              </div>
            </div>

            {/* Failed */}
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '12px',
              padding: '16px',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
            }}>
              <span style={{ fontSize: '11px', color: '#f87171', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Total Failed
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '8px' }}>
                <span style={{ fontSize: '26px', fontWeight: 800, color: '#f87171' }}>{totalFailed}</span>
                <span style={{ fontSize: '13px', color: '#6b7280' }}>/ 10</span>
              </div>
              <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', marginTop: '10px', overflow: 'hidden' }}>
                <div style={{ width: `${(totalFailed / results.length) * 100}%`, height: '100%', background: '#ef4444', borderRadius: '2px' }} />
              </div>
            </div>
          </div>

          {/* Results Table */}
          <div style={{
            background: 'rgba(0,0,0,0.15)',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: '15px',
            overflow: 'hidden',
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1.5px solid rgba(255,255,255,0.08)' }}>
                    <th style={{ padding: '16px 20px', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', width: '40%' }}>Question</th>
                    <th style={{ padding: '16px 20px', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Faithfulness</th>
                    <th style={{ padding: '16px 20px', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Relevance</th>
                    <th style={{ padding: '16px 20px', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Coverage</th>
                    <th style={{ padding: '16px 20px', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Status</th>
                    <th style={{ padding: '16px 20px', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center' }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, idx) => {
                    const isExpanded = expandedRow === idx;
                    return (
                      <React.Fragment key={idx}>
                        <tr
                          onClick={() => toggleRow(idx)}
                          style={{
                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                            background: isExpanded ? 'rgba(6, 182, 212, 0.03)' : 'transparent',
                            cursor: 'pointer',
                            transition: 'background 0.2s',
                          }}
                          onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.background = 'rgba(255,255,255,0.01)'; }}
                          onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.background = 'transparent'; }}
                        >
                          <td style={{ padding: '16px 20px', fontWeight: 600, color: '#f3f4f6' }}>{r.question}</td>
                          <td style={{ padding: '16px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontWeight: 700, color: '#ffffff', minWidth: '22px' }}>{r.faithfulness}</span>
                              <div style={{ width: '60px', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{ width: `${r.faithfulness * 10}%`, height: '100%', background: '#06b6d4' }} />
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '16px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontWeight: 700, color: '#ffffff', minWidth: '22px' }}>{r.relevance}</span>
                              <div style={{ width: '60px', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{ width: `${r.relevance * 10}%`, height: '100%', background: '#06b6d4' }} />
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '16px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontWeight: 700, color: '#ffffff', minWidth: '22px' }}>{r.coverage}</span>
                              <div style={{ width: '60px', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{ width: `${r.coverage * 10}%`, height: '100%', background: '#06b6d4' }} />
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '16px 20px' }}>
                            <span style={{
                              background: r.status === 'PASS' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                              color: r.status === 'PASS' ? '#34d399' : '#f87171',
                              fontSize: '11px',
                              fontWeight: 800,
                              padding: '3px 10px',
                              borderRadius: '20px',
                              border: `1px solid ${r.status === 'PASS' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
                              letterSpacing: '0.04em',
                            }}>
                              {r.status}
                            </span>
                          </td>
                          <td style={{ padding: '16px 20px', textAlign: 'center', color: '#9ca3af' }}>
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr>
                            <td colSpan="6" style={{ padding: '20px 24px', background: 'rgba(0, 0, 0, 0.25)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {/* Generated Answer */}
                                <div>
                                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#06b6d4', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                                    Generated Answer
                                  </div>
                                  <div style={{
                                    fontSize: '13px',
                                    color: '#e2e8f0',
                                    lineHeight: '1.6',
                                    background: 'rgba(255,255,255,0.01)',
                                    border: '1px solid rgba(255,255,255,0.03)',
                                    borderRadius: '8px',
                                    padding: '12px 14px'
                                  }}>
                                    {r.answer}
                                  </div>
                                </div>

                                {/* Retrieved Context */}
                                <div>
                                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#06b6d4', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                                    Retrieved Context Chunks
                                  </div>
                                  <div style={{
                                    fontSize: '12px',
                                    color: '#9ca3af',
                                    lineHeight: '1.6',
                                    maxHeight: '180px',
                                    overflowY: 'auto',
                                    background: 'rgba(0,0,0,0.15)',
                                    border: '1px solid rgba(255,255,255,0.03)',
                                    borderRadius: '8px',
                                    padding: '12px 14px',
                                    fontFamily: 'monospace',
                                    whiteSpace: 'pre-wrap'
                                  }} className="custom-scrollbar">
                                    {r.context || 'No context chunks retrieved.'}
                                  </div>
                                </div>

                                {/* Judge Reasoning */}
                                <div>
                                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                                    Judge Reasoning
                                  </div>
                                  <div style={{
                                    fontSize: '13px',
                                    color: '#d1d5db',
                                    lineHeight: '1.5',
                                    background: 'rgba(16, 185, 129, 0.03)',
                                    border: '1px solid rgba(16, 185, 129, 0.08)',
                                    borderRadius: '8px',
                                    padding: '12px 14px'
                                  }}>
                                    {r.reason || 'No explanation provided.'}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && results.length === 0 && !error && (
        <div style={{
          padding: '60px 40px',
          borderRadius: '15px',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          marginTop: '30px',
          zIndex: 1,
          position: 'relative'
        }}>
          <ClipboardList size={48} color="#4b5563" style={{ marginBottom: '16px' }} />
          <h3 style={{ margin: '0 0 8px 0', color: '#ffffff', fontSize: '16px', fontWeight: 700 }}>
            No Evaluation Report Yet
          </h3>
          <p style={{ margin: '0 0 20px 0', color: '#9ca3af', fontSize: '13px', maxWidth: '380px', lineHeight: '1.6' }}>
            Click the button below to initiate the predefined RAG evaluation test suite and run the LLM-as-a-Judge.
          </p>
          <button
            onClick={runBenchmark}
            style={{
              padding: '10px 20px',
              background: 'linear-gradient(135deg, #0284c7, #0891b2)',
              border: '1px solid rgba(6,182,212,0.35)',
              borderRadius: '10px',
              color: '#ffffff',
              fontWeight: 700, fontSize: '13px',
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(6,182,212,0.2)',
              transition: 'all 0.2s',
            }}
          >
            Run Benchmark
          </button>
        </div>
      )}

      {/* Keyframe styles */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
