import { useState, useEffect } from 'react';
import { Clock, CheckCircle2, ArrowRight, PlusCircle, Loader2 } from 'lucide-react';

const API_BASE    = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
const getBizId    = () => localStorage.getItem('business_id') || '';
const getToken    = () => localStorage.getItem('access_token') || '';
const authHeaders = () => ({
  'Content-Type':  'application/json',
  'Authorization': `Bearer ${getToken()}`,
});

const fmt = (n) =>
  n >= 100000 ? `₹${(n / 100000).toFixed(1)}L`
  : n >= 1000  ? `₹${(n / 1000).toFixed(1)}K`
  : `₹${n}`;

export function ReceivablesSummary() {
  const [entries,  setEntries]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [summary,  setSummary]  = useState({ totalReceivable: 0, totalPayable: 0, overdue: 0 });

  useEffect(() => {
    if (!getBizId()) return;
    setLoading(true);

    // Fetch cashbook entries — credit = receivable (money in), debit = payable (money out)
    fetch(`${API_BASE}/api/v1/cashbook/${getBizId()}/entries/?limit=50`, { headers: authHeaders() })
      .then(r => r.json())
      .then(raw => {
        const list = raw.data?.results || raw.data || raw.results || raw || [];
        const arr  = Array.isArray(list) ? list : [];

        // Build receivables: credit entries with party_name = someone owes us money
        // Build payables: debit entries with party_name = we owe someone
        const receivables = arr.filter(e => e.type === 'credit' && e.party_name);
        const payables    = arr.filter(e => e.type === 'debit'  && e.party_name);

        const totalReceivable = receivables.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
        const totalPayable    = payables.reduce((s, e) => s + parseFloat(e.amount || 0), 0);

        // Entries older than 30 days with party_name = considered overdue receivables
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const overdue = receivables
          .filter(e => new Date(e.date) < thirtyDaysAgo)
          .reduce((s, e) => s + parseFloat(e.amount || 0), 0);

        setSummary({ totalReceivable, totalPayable, overdue });

        // Show most recent 5 with party
        setEntries(arr.filter(e => e.party_name).slice(0, 5));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-900">Accounts Receivable / Payable</h3>
          <button
            onClick={() => window.location.href = '/dashboard/cashbook'}
            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            View all <ArrowRight size={13} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Total Receivable</p>
            <p className="text-xl font-bold text-slate-900">{fmt(summary.totalReceivable)}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Money owed to you</p>
          </div>
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
            <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-1">Total Payable</p>
            <p className="text-xl font-bold text-amber-700">{fmt(summary.totalPayable)}</p>
            <p className="text-[11px] text-amber-500 mt-0.5">Money you owe</p>
          </div>
        </div>

        {summary.overdue > 0 && (
          <div className="mt-3 px-3 py-2 bg-red-50 border border-red-100 rounded-lg">
            <p className="text-xs font-semibold text-red-700">
              ⚠ {fmt(summary.overdue)} in receivables older than 30 days
            </p>
          </div>
        )}
      </div>

      {/* List */}
      <div className="p-4 flex flex-col gap-2 min-h-[120px]">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-slate-300" />
          </div>
        )}

        {!loading && entries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <p className="text-sm text-slate-400">No receivable/payable entries found.</p>
            <button
              onClick={() => window.location.href = '/dashboard/cashbook'}
              className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              <PlusCircle size={13} /> Add a transaction with party name
            </button>
          </div>
        )}

        {!loading && entries.map((e) => {
          const isCredit  = e.type === 'credit';
          const isOverdue = isCredit && new Date(e.date) < thirtyDaysAgo;
          return (
            <div
              key={e.id}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all cursor-pointer group"
              onClick={() => window.location.href = '/dashboard/cashbook'}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                isCredit
                  ? isOverdue ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                  : 'bg-amber-50 text-amber-700'
              }`}>
                {(e.party_name?.[0] || '?').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{e.party_name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {isOverdue ? (
                    <>
                      <Clock size={11} className="text-red-500" />
                      <span className="text-xs text-red-600">Overdue · {e.date}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={11} className={isCredit ? 'text-emerald-500' : 'text-amber-500'} />
                      <span className={`text-xs ${isCredit ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {isCredit ? 'Receivable' : 'Payable'} · {e.date}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className={`text-sm font-bold ${isCredit ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {isCredit ? '+' : '-'}{fmt(parseFloat(e.amount))}
                </p>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                  isCredit
                    ? isOverdue ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                    : 'bg-amber-50 text-amber-700'
                }`}>
                  {isCredit ? (isOverdue ? 'Overdue' : 'Receivable') : 'Payable'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-5 pb-4 pt-2 border-t border-slate-100">
        <p className="text-[11px] text-slate-400">
          💡 Tip: Add a <strong>Party Name</strong> when recording cashbook entries to track receivables &amp; payables here.
        </p>
      </div>
    </div>
  );
}