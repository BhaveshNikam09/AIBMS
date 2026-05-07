import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { TrendingUp, TrendingDown, Download, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

const fmt = n => {
  if (n == null || isNaN(n)) return '₹0'
  const abs  = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(1)}L`
  if (abs >= 1000)   return `${sign}₹${(abs / 1000).toFixed(1)}K`
  return `${sign}₹${abs}`
}

const PERIOD_LABEL = {
  daily:    'Today',
  '1month': 'Last 30 days',
  '3months':'Last 3 months',
  '6months':'Last 6 months',
  '1yr':    'Last 12 months',
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-900 text-white px-3 py-2.5 rounded-lg shadow-xl border border-slate-700 text-xs">
      <p className="text-slate-400 mb-2 font-medium">{payload[0]?.payload?.month}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center justify-between gap-5 py-0.5">
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            {entry.name}
          </span>
          <span className="font-semibold">{fmt(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Props ─────────────────────────────────────────────────────────────────
// data    : cash_flow[] from Dashboard (fetched with correct ?period=)
// period  : 'daily' | '1month' | '3months' | '6months'
// loading : boolean
// ──────────────────────────────────────────────────────────────────────────
export function CashFlowChart({ data = [], period = '6months', loading = false }) {

  const chartData = useMemo(() =>
    data.map(m => ({
      month:   m.month,
      income:  m.income   ?? 0,
      expense: m.expense  ?? 0,
      net:     m.profit   ?? ((m.income ?? 0) - (m.expense ?? 0)),
    })),
    [data]
  )

  const stats = useMemo(() => {
    const totalIncome  = data.reduce((s, m) => s + (m.income  ?? 0), 0)
    const totalExpense = data.reduce((s, m) => s + (m.expense ?? 0), 0)
    const netProfit    = totalIncome - totalExpense

    let avgGrowth = 0
    const nonZero = data.filter(m => (m.income ?? 0) > 0)
    if (nonZero.length >= 2) {
      const first = nonZero[0].income
      const last  = nonZero[nonZero.length - 1].income
      avgGrowth   = Math.round(((last - first) / first) * 100 * 10) / 10
    }
    return { totalIncome, totalExpense, netProfit, avgGrowth }
  }, [data])

  const isPositiveGrowth = stats.avgGrowth >= 0
  const periodLabel      = PERIOD_LABEL[period] || 'Period'
  // For daily/1month: show chart even if all zeros (flat line is valid data).
  // For monthly views: only show chart if there's actual activity.
  const hasActivity =
    period === 'daily' || period === '1month'
      ? chartData.length > 0
      : chartData.some(d => d.income > 0 || d.expense > 0)

  const xInterval =
    period === 'daily'   ? 1 :              // hourly: show every 2nd label
    period === '1month'  ? 4 :              // daily: show every 5th label (~6 ticks)
    period === '3months' ? 0 :              // monthly: show all 3 labels
    period === '6months' ? 0 :              // monthly: show all 6 labels
    period === '1yr'     ? 1 : 0            // monthly: show every other label (12 months)

  const dotR =
    period === '1month' ? 2 :
    period === 'daily'  ? 3 :
    period === '1yr'    ? 2 : 4

  const handleExport = () => {
    const header = 'Month,Income,Expense,Net Profit\n'
    const rows   = chartData.map(d => `${d.month},${d.income},${d.expense},${d.net}`).join('\n')
    const blob   = new Blob([header + rows], { type: 'text/csv' })
    const url    = URL.createObjectURL(blob)
    const a      = document.createElement('a')
    a.href       = url
    a.download   = `cashflow-${period}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <motion.div
      initial    = {{ opacity: 0, y: 15 }}
      animate    = {{ opacity: 1, y: 0 }}
      transition = {{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}
      className  = "bg-white/80 backdrop-blur-md border border-slate-200/60 rounded-xl shadow-[0px_2px_8px_rgba(0,0,0,0.015)] overflow-hidden"
    >
      {/* ── Header ── */}
      <div className="px-6 pt-5 pb-4 border-b border-slate-100/60">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <h3 className="text-sm font-semibold text-slate-900">Cash Flow Analysis</h3>

              {!loading && hasActivity && (
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border ${
                  isPositiveGrowth ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'
                }`}>
                  {isPositiveGrowth
                    ? <TrendingUp  size={11} className="text-emerald-600" />
                    : <TrendingDown size={11} className="text-red-600" />}
                  <span className={`text-[11px] font-semibold ${isPositiveGrowth ? 'text-emerald-700' : 'text-red-700'}`}>
                    {isPositiveGrowth ? '+' : ''}{stats.avgGrowth}% avg growth
                  </span>
                </div>
              )}

              <span className="text-[11px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                {periodLabel}
              </span>
            </div>

            <div className="flex items-center gap-5">
              {[
                { label: 'Inflow',  color: '#2563eb' },
                { label: 'Outflow', color: '#e11d48' },
                { label: 'Net',     color: '#64748b', dashed: true },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <svg width="20" height="10">
                    {item.dashed
                      ? <line x1="0" y1="5" x2="20" y2="5" stroke={item.color} strokeWidth="2" strokeDasharray="4 2" />
                      : <line x1="0" y1="5" x2="20" y2="5" stroke={item.color} strokeWidth="2.5" />}
                  </svg>
                  <span className="text-xs text-slate-500">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick   = {handleExport}
            disabled  = {loading || !hasActivity}
            className = "p-1.5 text-slate-500 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors disabled:opacity-40"
            title     = "Export CSV"
          >
            <Download size={15} />
          </button>
        </div>
      </div>

      {/* ── Chart ── */}
      <div className="px-4 py-5">
        {loading ? (
          <div className="flex items-center justify-center" style={{ height: 280 }}>
            <Loader2 size={24} className="animate-spin text-slate-300" />
          </div>

        ) : chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 text-slate-400 text-sm" style={{ height: 280 }}>
            <span className="text-2xl">📊</span>
            No data available for {periodLabel.toLowerCase()}.
            <span className="text-xs text-slate-300">Add confirmed cashbook entries to see trends.</span>
          </div>

        ) : (
          // Render chart even when all values are 0 — shows a flat ₹0 line
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey  = "month"
                stroke   = "#94a3b8"
                fontSize = {11}
                tickLine = {false}
                axisLine = {{ stroke: '#e2e8f0' }}
                interval = {xInterval}
              />
              <YAxis
                stroke        = "#94a3b8"
                fontSize      = {11}
                tickLine      = {false}
                axisLine      = {false}
                tickFormatter = {v => fmt(v)}
                width         = {60}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="#e2e8f0" strokeDasharray="4 2" />
              <Line
                type="monotone" dataKey="income" stroke="#2563eb" strokeWidth={2.5} name="Inflow"
                dot={{ fill: '#2563eb', r: dotR, strokeWidth: 0 }}
                activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                connectNulls
              />
              <Line
                type="monotone" dataKey="expense" stroke="#e11d48" strokeWidth={2.5} name="Outflow"
                dot={{ fill: '#e11d48', r: dotR, strokeWidth: 0 }}
                activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                connectNulls
              />
              <Line
                type="monotone" dataKey="net" stroke="#64748b" strokeWidth={1.8} strokeDasharray="5 4" name="Net"
                dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Footer Stats ── */}
      <div className="px-6 pb-5 pt-1 border-t border-slate-100 grid grid-cols-3 gap-4">
        {[
          { label: 'Total Income',  value: fmt(stats.totalIncome),  color: 'text-emerald-600' },
          { label: 'Total Expense', value: fmt(stats.totalExpense), color: 'text-red-500' },
          {
            label: 'Net Profit',
            value: fmt(stats.netProfit),
            color: stats.netProfit >= 0 ? 'text-slate-900' : 'text-red-600',
          },
        ].map(stat => (
          <div key={stat.label}>
            <p className="text-[11px] text-slate-400 mb-0.5">
              {stat.label} <span className="text-slate-300">({periodLabel})</span>
            </p>
            <p className={`text-base font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>
    </motion.div>
  )
}