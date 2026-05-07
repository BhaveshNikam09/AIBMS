import { useState, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, Clock, Circle, ExternalLink, Loader2 } from 'lucide-react';

// ── Single source of truth: import from Navbar ──────────────────────────────
// If you move COMPLIANCE_CALENDAR to a shared file (e.g. src/constants/compliance.js),
// update this import path accordingly.
import { COMPLIANCE_CALENDAR } from './Navbar';

const API_BASE    = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
const getBizId    = () => localStorage.getItem('business_id') || '';
const getToken    = () => localStorage.getItem('access_token') || '';
const authHeaders = () => ({
  'Content-Type':  'application/json',
  'Authorization': `Bearer ${getToken()}`,
});

const statusConfig = {
  completed:     { dot: 'bg-emerald-500 border-emerald-500', bg: 'text-emerald-700 bg-emerald-50'  },
  'in-progress': { dot: 'bg-amber-500 border-amber-500',     bg: 'text-amber-700 bg-amber-50'      },
  upcoming:      { dot: 'bg-white border-slate-300',          bg: 'text-slate-600 bg-slate-50'     },
  overdue:       { dot: 'bg-red-500 border-red-500',          bg: 'text-red-700 bg-red-50'         },
};

export function ComplianceTimeline() {
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Compute status for every calendar item from today's real date
    const withStatus = COMPLIANCE_CALENDAR.map((item, idx) => {
      const due      = new Date(item.dueDate);
      const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24));
      let status;
      if (diffDays < 0)        status = 'overdue';
      else if (diffDays <= 7)  status = 'in-progress';
      else                     status = 'upcoming';

      return { ...item, id: idx + 1, daysUntil: diffDays, status };
    });

    // Sort: overdue first, then by daysUntil ascending
    withStatus.sort((a, b) => {
      if (a.status === 'overdue' && b.status !== 'overdue') return -1;
      if (b.status === 'overdue' && a.status !== 'overdue') return 1;
      return a.daysUntil - b.daysUntil;
    });

    // No business_id = show calendar with computed statuses immediately
    if (!getBizId()) {
      setItems(withStatus);
      setLoading(false);
      return;
    }

    // Optionally mark ITR as completed if user has filed via API
    fetch(`${API_BASE}/api/v1/itr/${getBizId()}/`, { headers: authHeaders() })
      .then(r => r.json())
      .then(raw => {
        const list = raw.data?.results || raw.data || raw.results || raw || [];
        const arr  = Array.isArray(list) ? list : [];
        const hasFiled = arr.some(itr =>
          (itr.status === 'filed' || itr.status === 'completed') &&
          String(itr.assessment_year || '').includes('2025')
        );
        const updated = withStatus.map(item =>
          item.category === 'ITR' && hasFiled
            ? { ...item, status: 'completed' }
            : item
        );
        setItems(updated);
      })
      .catch(() => setItems(withStatus))
      .finally(() => setLoading(false));
  }, []);

  const counts = {
    completed: items.filter(i => i.status === 'completed').length,
    overdue:   items.filter(i => i.status === 'overdue').length,
    pending:   items.filter(i => i.status === 'upcoming' || i.status === 'in-progress').length,
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">

      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Compliance Calendar</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Statutory deadlines &amp; filings</p>
          </div>
          <button
            onClick={() => window.location.href = '/dashboard/itr'}
            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            Full calendar <ExternalLink size={12} />
          </button>
        </div>

        {/* Summary counters */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Completed', value: counts.completed, cls: 'bg-emerald-50 text-emerald-800 border-emerald-100' },
            { label: 'Overdue',   value: counts.overdue,   cls: 'bg-red-50 text-red-800 border-red-100'             },
            { label: 'Pending',   value: counts.pending,   cls: 'bg-blue-50 text-blue-800 border-blue-100'          },
          ].map(s => (
            <div key={s.label} className={`px-3 py-2 rounded-lg border text-center ${s.cls}`}>
              <p className="text-lg font-bold leading-none mb-0.5">{s.value}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="p-5">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 size={20} className="animate-spin text-slate-300" />
          </div>
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[14px] top-4 bottom-4 w-px bg-slate-200" />

            <div className="flex flex-col gap-4">
              {items.map(item => {
                const cfg = statusConfig[item.status];
                return (
                  <div
                    key={item.id}
                    className="flex gap-4 group cursor-pointer"
                    onClick={() => window.location.href = '/dashboard/itr'}
                  >
                    {/* Status dot */}
                    <div className={`relative z-10 w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.dot}`}>
                      {item.status === 'completed'   && <CheckCircle2 size={14} className="text-white" strokeWidth={3} />}
                      {item.status === 'overdue'     && <AlertTriangle size={12} className="text-white" strokeWidth={3} />}
                      {item.status === 'in-progress' && <Clock size={12} className="text-white" strokeWidth={3} />}
                      {item.status === 'upcoming'    && <Circle size={10} className="text-slate-400" />}
                    </div>

                    {/* Card */}
                    <div className="flex-1 p-3 rounded-lg border border-slate-100 bg-slate-50 hover:border-slate-200 hover:bg-white transition-all">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <p className="text-sm font-semibold text-slate-800 leading-tight">{item.title}</p>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap ${cfg.bg}`}>
                          {item.status === 'completed'
                            ? 'Done'
                            : item.status === 'overdue'
                            ? `${Math.abs(item.daysUntil)}d late`
                            : item.status === 'in-progress'
                            ? `${item.daysUntil}d left`
                            : `${item.daysUntil}d away`
                          }
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-slate-400">
                          Due: {new Date(item.dueDate).toLocaleDateString('en-IN', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                        </span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${cfg.bg}`}>
                          {item.category}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 pb-4 border-t border-slate-100 pt-3">
        <button
          onClick={() => window.location.href = '/dashboard/itr'}
          className="w-full py-2 text-xs font-semibold text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-100"
        >
          Manage ITR &amp; Compliance filings →
        </button>
      </div>
    </div>
  );
}