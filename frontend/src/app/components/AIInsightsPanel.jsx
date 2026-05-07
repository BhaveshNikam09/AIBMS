import { useState, useEffect } from 'react';
import { TrendingUp, AlertCircle, Target, ChevronRight, Zap, Cpu, Loader2 } from 'lucide-react';

const API_BASE    = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
const getBizId    = () => localStorage.getItem('business_id') || '';
const getToken    = () => localStorage.getItem('access_token') || '';
const authHeaders = () => ({
  'Content-Type':  'application/json',
  'Authorization': `Bearer ${getToken()}`,
});

export function AIInsightsPanel() {
  const [summary,   setSummary]   = useState('');
  const [insights,  setInsights]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [updatedAt, setUpdatedAt] = useState('');

  useEffect(() => {
    if (!getBizId()) return;
    setLoading(true);

    fetch(`${API_BASE}/api/v1/dashboard/${getBizId()}/`, { headers: authHeaders() })
      .then(r => r.json())
      .then(raw => {
        const d          = raw.data || raw;
        const aiInsight  = d.ai_insight  || {};
        const overview   = d.overview    || {};
        const alerts     = d.alerts      || [];

        // Set the AI summary text
        setSummary(aiInsight.summary || '');
        setUpdatedAt(aiInsight.generated_at ? new Date(aiInsight.generated_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '');

        // Build insight cards from alerts + overview
        const cards = [];

        // Card 1: Revenue/Profit signal from overview
        if (overview.net_profit !== undefined) {
          const isProfit = overview.net_profit >= 0;
          cards.push({
            id:           1,
            Icon:         isProfit ? TrendingUp : AlertCircle,
            title:        isProfit ? 'Profitable This Month' : 'Loss Alert',
            description:  isProfit
              ? `Net profit ₹${Number(overview.net_profit).toLocaleString('en-IN')} with ${overview.profit_margin}% margin. Income ${overview.income_change_pct >= 0 ? 'up' : 'down'} ${Math.abs(overview.income_change_pct)}% vs last month.`
              : `Net loss of ₹${Math.abs(Number(overview.net_profit)).toLocaleString('en-IN')} this month. Expenses exceed income by ${Math.abs(overview.profit_margin)}%.`,
            confidence:   88,
            impact:       isProfit ? 'Positive' : 'Critical',
            impactColor:  isProfit ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50',
            iconColor:    isProfit ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50',
            accentColor:  isProfit ? 'border-emerald-400' : 'border-red-400',
            route:        '/dashboard/cashbook',
          });
        }

        // Card 2: From alerts (most critical one)
        const criticalAlert = alerts.find(a => a.color === 'red' || a.color === 'orange');
        if (criticalAlert) {
          cards.push({
            id:           2,
            Icon:         AlertCircle,
            title:        criticalAlert.level,
            description:  criticalAlert.message,
            confidence:   92,
            impact:       criticalAlert.color === 'red' ? 'Critical' : 'Warning',
            impactColor:  criticalAlert.color === 'red' ? 'text-red-700 bg-red-50' : 'text-amber-700 bg-amber-50',
            iconColor:    criticalAlert.color === 'red' ? 'text-red-700 bg-red-50' : 'text-amber-700 bg-amber-50',
            accentColor:  criticalAlert.color === 'red' ? 'border-red-400' : 'border-amber-400',
            route:        '/dashboard/reports',
          });
        }

        // Card 3: Compliance / ITR reminder
        // cards.push({
        //   id:           3,
        //   Icon:         Target,
        //   title:        'ITR & Compliance',
        //   description:  `Check your compliance calendar. GST return and TDS deadlines are approaching. Keep your filings up to date to avoid penalties.`,
        //   confidence:   95,
        //   impact:       'Action Needed',
        //   impactColor:  'text-blue-700 bg-blue-50',
        //   iconColor:    'text-blue-700 bg-blue-50',
        //   accentColor:  'border-blue-400',
        //   route:        '/dashboard/itr',
        // });

        setInsights(cards.slice(0, 3));
      })
      .catch(() => {
        // Fallback cards when API fails
        setInsights([
          {
            id: 1, Icon: TrendingUp, title: 'Track Your Revenue',
            description: 'Record your income and expenses in the Digital Cashbook to get AI-powered insights here.',
            confidence: 100, impact: 'Get Started',
            impactColor: 'text-blue-700 bg-blue-50', iconColor: 'text-blue-700 bg-blue-50',
            accentColor: 'border-blue-400', route: '/dashboard/cashbook',
          },
        ]);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-7 h-7 bg-slate-900 rounded-lg flex items-center justify-center">
            <Cpu size={14} className="text-white" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900">AI Business Intelligence</h3>
        </div>
        <p className="text-xs text-slate-400 pl-9">
          {updatedAt ? `Updated at ${updatedAt}` : 'Predictive insights from your data'}
        </p>
      </div>

      {/* AI Summary */}
      {summary && !loading && (
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
          <p className="text-xs text-slate-600 leading-relaxed">{summary}</p>
        </div>
      )}

      {/* Insights */}
      <div className="flex-1 p-4 flex flex-col gap-3 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full py-8">
            <Loader2 size={20} className="animate-spin text-slate-300" />
          </div>
        ) : (
          insights.map(insight => {
            const { Icon } = insight;
            return (
              <div
                key={insight.id}
                className={`border-l-[3px] ${insight.accentColor} bg-white rounded-lg p-4 shadow-sm border border-slate-100 hover:shadow-md hover:border-slate-200 transition-all cursor-pointer group`}
                onClick={() => { window.location.href = insight.route; }}
              >
                <div className="flex gap-4">
                  <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${insight.iconColor}`}>
                    <Icon size={15} strokeWidth={2.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-sm font-semibold text-slate-800 leading-tight">{insight.title}</p>
                      <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500 transition-colors flex-shrink-0" />
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed mb-2.5">{insight.description}</p>
                      <div className="flex items-center justify-between mt-1">
                        <div className="flex items-center gap-1.5 opacity-80">
                          <Zap size={11} className="text-amber-500" />
                          <span className="text-[10px] font-medium text-slate-400">{insight.confidence}% confidence</span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${insight.impactColor}`}>
                          {insight.impact}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-100">
        <button
          onClick={() => {
            const fab = document.getElementById('ai-chat-fab')
            if (fab) fab.click()
          }}
          className="w-full py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-lg transition-colors"
        >
          Open AI Intelligence Hub →
        </button>
      </div>
    </div>
  );
}