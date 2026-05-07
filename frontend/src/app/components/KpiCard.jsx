import { ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { motion } from 'framer-motion'

export function KpiCard({ title, value, change, changeLabel, data = [], prefix = '' }) {
  const isPositive = change >= 0

  const generateSparklinePath = () => {
    if (data.length < 2) return ''
    const max   = Math.max(...data)
    const min   = Math.min(...data)
    const range = max - min || 1
    const w     = 72
    const h     = 28
    return data.map((v, i) => {
      const x = (i / (data.length - 1)) * w
      const y = h - ((v - min) / range) * h
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="bg-white/80 backdrop-blur-md border border-slate-200/60 rounded-xl p-5 shadow-[0px_2px_4px_rgba(0,0,0,0.02)] transition-shadow duration-300 hover:shadow-md hover:border-slate-300"
    >
      {/* Label */}
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">{title}</p>

      {/* Value + Arrow */}
      <div className="flex items-start justify-between mb-4">
        <p className="text-2xl font-bold text-slate-900 tracking-tight">{value}</p>
        <div className={`p-1.5 rounded-md ${isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
          {isPositive
            ? <ArrowUpRight size={16} strokeWidth={2.5} />
            : <ArrowDownRight size={16} strokeWidth={2.5} />
          }
        </div>
      </div>

      {/* Sparkline + Change */}
      <div className="flex items-end justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
            {isPositive ? '+' : ''}{change}%
          </span>
          <span className="text-xs text-slate-400">{changeLabel}</span>
        </div>
        {data.length >= 2 && (
          <svg width="72" height="28" className="overflow-visible">
            <path
              d           = {generateSparklinePath()}
              fill        = "none"
              stroke      = {isPositive ? '#10b981' : '#ef4444'}
              strokeWidth = "1.8"
              strokeLinecap  = "round"
              strokeLinejoin = "round"
              opacity = "0.6"
            />
          </svg>
        )}
      </div>
    </motion.div>
  )
}
