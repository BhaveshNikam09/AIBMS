import { useState, useEffect } from 'react'
import { FileText, FileSpreadsheet, Download, BarChart3, TrendingUp, Scale, Receipt, Loader2, AlertCircle } from 'lucide-react'
import { filterBranchesForRole, getStoredRole, isScopedBranchRole, normalizeRole } from '../utils/rbac'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
const getBizId = () => localStorage.getItem('business_id') || ''
const getToken = () => localStorage.getItem('access_token') || ''
const authHeaders = () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` })
const fmt = n => `₹${Number(n || 0).toLocaleString('en-IN')}`
const fmtL = n => n >= 100000 ? `₹${(n / 100000).toFixed(2)}L` : fmt(n)

const reportTypes = [
  { id: 'pl', label: 'P&L Statement', icon: TrendingUp, desc: 'Profit & Loss for any period', color: 'bg-blue-50 border-blue-100 text-blue-700' },
  { id: 'cf', label: 'Cash Flow', icon: BarChart3, desc: '6-month income vs expense trend', color: 'bg-emerald-50 border-emerald-100 text-emerald-700' },
  { id: 'exp', label: 'Expense Report', icon: FileSpreadsheet, desc: 'Top expense categories breakdown', color: 'bg-red-50 border-red-100 text-red-700' },
  // { id: 'tax', label: 'Tax Summary', icon: Receipt, desc: 'GST, TDS, advance tax overview', color: 'bg-amber-50 border-amber-100 text-amber-700' },
  { id: 'txn', label: 'Transaction Log', icon: FileText, desc: 'All confirmed transactions', color: 'bg-slate-50 border-slate-200 text-slate-700' },
  // { id: 'itr', label: 'ITR Summary',     icon: Scale,           desc: 'ITR filing history & status',      color: 'bg-purple-50 border-purple-100 text-purple-700' },
]

function exportCSV(filename, rows, headers) {
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${r[h] ?? ''}"`).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export function Reports() {
  const [selectedReport, setSelectedReport] = useState('pl')
  const [dashData, setDashData] = useState(null)
  const [entries, setEntries] = useState([])
  const [itrData, setItrData] = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterBranch, setFilterBranch] = useState('all')
  const [filterPeriod, setFilterPeriod] = useState('this_month')
  const role = normalizeRole(getStoredRole())
  const branchFilterLabel = isScopedBranchRole(role) ? 'Assigned Branches' : 'All Branches'

  useEffect(() => {
    if (!getBizId()) return
    setLoading(true)
    Promise.all([
      fetch(`${API_BASE}/api/v1/dashboard/${getBizId()}/`, { headers: authHeaders() }).then(r => r.json()),
      fetch(`${API_BASE}/api/v1/cashbook/${getBizId()}/entries/?limit=500`, { headers: authHeaders() }).then(r => r.json()),
      fetch(`${API_BASE}/api/v1/branches/${getBizId()}/`, { headers: authHeaders() }).then(r => r.json()),
      fetch(`${API_BASE}/api/v1/itr/${getBizId()}/`, { headers: authHeaders() }).then(r => r.json()).catch(() => ({})),
    ])
      .then(([dashRaw, entRaw, branchRaw, itrRaw]) => {
        setDashData(dashRaw.data || dashRaw)
        const elist = entRaw.data?.results || entRaw.data || entRaw.results || entRaw || []
        setEntries(Array.isArray(elist) ? elist : [])
        const blist = branchRaw.data || branchRaw.results || branchRaw || []
        setBranches(filterBranchesForRole(Array.isArray(blist) ? blist : [], role))
        const ilist = itrRaw.data?.results || itrRaw.data || itrRaw.results || itrRaw || []
        setItrData(Array.isArray(ilist) ? ilist : [])
      })
      .catch(() => { })
      .finally(() => setLoading(false))
  }, [])

  function filteredEntries() {
    let list = entries.filter(e => e.status === 'confirmed')
    if (filterBranch !== 'all') list = list.filter(e => e.branch === filterBranch || e.branch_id === filterBranch)
    const now = new Date()
    if (filterPeriod === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      list = list.filter(e => new Date(e.date) >= start)
    } else if (filterPeriod === 'last_month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const end = new Date(now.getFullYear(), now.getMonth(), 0)
      list = list.filter(e => { const d = new Date(e.date); return d >= start && d <= end })
    } else if (filterPeriod === 'this_year') {
      const fy = now.getMonth() >= 3
        ? new Date(now.getFullYear(), 3, 1)
        : new Date(now.getFullYear() - 1, 3, 1)
      list = list.filter(e => new Date(e.date) >= fy)
    }
    return list
  }

  const fEntries = filteredEntries()
  const income = fEntries.filter(e => e.type === 'credit').reduce((s, e) => s + parseFloat(e.amount || 0), 0)
  const expense = fEntries.filter(e => e.type === 'debit').reduce((s, e) => s + parseFloat(e.amount || 0), 0)
  const netProfit = income - expense
  const profitPct = income > 0 ? ((netProfit / income) * 100).toFixed(1) : '0.0'
  const cashFlow = dashData?.cash_flow || []

  const expGroups = {}
  fEntries.filter(e => e.type === 'debit').forEach(e => {
    const key = e.category || e.description || 'Other'
    expGroups[key] = (expGroups[key] || 0) + parseFloat(e.amount || 0)
  })
  const topExpenses = Object.entries(expGroups)
    .sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([desc, amt]) => ({ desc, amt, pct: expense > 0 ? ((amt / expense) * 100).toFixed(1) : '0' }))

  function handleExportCSV() {
    if (selectedReport === 'pl') {
      exportCSV('pl_statement.csv', [
        { Item: 'Total Income', Amount: income }, { Item: 'Total Expense', Amount: expense },
        { Item: 'Net Profit', Amount: netProfit }, { Item: 'Profit Margin %', Amount: profitPct },
      ], ['Item', 'Amount'])
    } else if (selectedReport === 'txn') {
      exportCSV('transactions.csv', fEntries.map(e => ({
        Date: e.date, Type: e.type, Amount: e.amount, Description: e.description,
        Party: e.party_name || '', Mode: e.payment_mode || '', Status: e.status,
      })), ['Date', 'Type', 'Amount', 'Description', 'Party', 'Mode', 'Status'])
    } else if (selectedReport === 'exp') {
      exportCSV('expenses.csv', topExpenses.map(e => ({ Category: e.desc, Amount: e.amt, Percentage: e.pct + '%' })), ['Category', 'Amount', 'Percentage'])
    } else if (selectedReport === 'cf') {
      exportCSV('cashflow.csv', cashFlow.map(m => ({ Month: m.month, Income: m.income, Expense: m.expense, Profit: m.profit })), ['Month', 'Income', 'Expense', 'Profit'])
    } else {
      alert('Export not available for this report type.')
    }
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Reports & Analytics</h1>
          <p className="text-sm text-slate-400 mt-0.5">Built from your confirmed cashbook entries</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 focus:outline-none">
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="this_year">This Financial Year</option>
            <option value="all">All Time</option>
          </select>
          <select value={filterBranch} onChange={e => setFilterBranch(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 focus:outline-none">
            <option value="all">{branchFilterLabel}</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <button onClick={handleExportCSV} className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800">
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-24"><Loader2 size={24} className="animate-spin text-slate-300" /></div>
      ) : (
        <div className="grid grid-cols-12 gap-5">

          {/* Sidebar */}
          <div className="col-span-3">
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              {reportTypes.map(r => (
                <button
                  key={r.id} onClick={() => setSelectedReport(r.id)}
                  className={`w-full flex items-start gap-3 px-4 py-3.5 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors text-left ${selectedReport === r.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''}`}
                >
                  <div className={`p-1.5 rounded-lg border ${r.color} flex-shrink-0 mt-0.5`}>
                    <r.icon size={13} />
                  </div>
                  <div>
                    <p className={`text-xs font-semibold ${selectedReport === r.id ? 'text-blue-700' : 'text-slate-800'}`}>{r.label}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{r.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="col-span-9">

            {selectedReport === 'pl' && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900">Profit & Loss Statement</h2>
                  <span className="text-xs text-slate-400">{fEntries.length} confirmed entries</span>
                </div>
                <div className="p-6 grid grid-cols-4 gap-4 border-b border-slate-100">
                  {[
                    { label: 'Total Income', value: fmtL(income), color: 'text-emerald-700', bg: 'bg-emerald-50' },
                    { label: 'Total Expense', value: fmtL(expense), color: 'text-red-600', bg: 'bg-red-50' },
                    { label: 'Net Profit', value: fmtL(netProfit), color: netProfit >= 0 ? 'text-emerald-700' : 'text-red-600', bg: netProfit >= 0 ? 'bg-emerald-50' : 'bg-red-50' },
                    { label: 'Profit Margin', value: profitPct + '%', color: 'text-blue-700', bg: 'bg-blue-50' },
                  ].map(s => (
                    <div key={s.label} className={`p-4 rounded-xl ${s.bg}`}>
                      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{s.label}</p>
                      <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                    </div>
                  ))}
                </div>
                <table className="w-full text-sm">
                  <thead><tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Particulars</th>
                    <th className="px-6 py-3 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider">% of Income</th>
                  </tr></thead>
                  <tbody>
                    <tr className="border-b border-slate-50 bg-emerald-50/40">
                      <td className="px-6 py-3 font-semibold text-emerald-800">Total Income (Credit Entries)</td>
                      <td className="px-6 py-3 text-right font-bold text-emerald-700">{fmt(income)}</td>
                      <td className="px-6 py-3 text-right text-emerald-600">100%</td>
                    </tr>
                    <tr className="border-b border-slate-50 bg-red-50/40">
                      <td className="px-6 py-3 font-semibold text-red-700">Total Expenses (Debit Entries)</td>
                      <td className="px-6 py-3 text-right font-bold text-red-600">{fmt(expense)}</td>
                      <td className="px-6 py-3 text-right text-red-500">{income > 0 ? ((expense / income) * 100).toFixed(1) : '0'}%</td>
                    </tr>
                    <tr className={`font-bold ${netProfit >= 0 ? 'bg-emerald-100/60' : 'bg-red-100/60'}`}>
                      <td className="px-6 py-3 text-slate-900">Net Profit / (Loss)</td>
                      <td className={`px-6 py-3 text-right text-lg ${netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{fmt(netProfit)}</td>
                      <td className={`px-6 py-3 text-right ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{profitPct}%</td>
                    </tr>
                  </tbody>
                </table>
                {fEntries.length === 0 && (
                  <div className="py-12 text-center">
                    <AlertCircle size={24} className="text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">No confirmed entries for selected period.</p>
                    <p className="text-xs text-slate-400 mt-1">Add cashbook entries and mark them as confirmed.</p>
                  </div>
                )}
              </div>
            )}

            {selectedReport === 'cf' && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100"><h2 className="text-sm font-semibold text-slate-900">6-Month Cash Flow</h2></div>
                {cashFlow.length === 0 ? (
                  <div className="py-12 text-center text-sm text-slate-400">No cash flow data available.</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead><tr className="bg-slate-50 border-b border-slate-200">
                      {['Month', 'Income', 'Expense', 'Net Profit', 'Margin'].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {cashFlow.map((m, i) => {
                        const margin = m.income > 0 ? ((m.profit / m.income) * 100).toFixed(1) : '0.0'
                        return (
                          <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                            <td className="px-5 py-3 font-semibold text-slate-800">{m.month}</td>
                            <td className="px-5 py-3 text-emerald-700 font-medium">{fmtL(m.income)}</td>
                            <td className="px-5 py-3 text-red-600 font-medium">{fmtL(m.expense)}</td>
                            <td className={`px-5 py-3 font-bold ${m.profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{fmtL(m.profit)}</td>
                            <td className="px-5 py-3">
                              <span className={`px-2 py-0.5 text-xs rounded-full font-semibold ${m.profit >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{margin}%</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {selectedReport === 'exp' && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100"><h2 className="text-sm font-semibold text-slate-900">Top Expense Categories</h2></div>
                {topExpenses.length === 0 ? (
                  <div className="py-12 text-center text-sm text-slate-400">No expense entries for selected period.</div>
                ) : (
                  <div className="p-6 flex flex-col gap-3">
                    {topExpenses.map((e, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-medium text-slate-800 truncate">{e.desc}</p>
                            <p className="text-sm font-bold text-slate-900 ml-4">{fmtL(e.amt)}</p>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5">
                            <div className="bg-red-400 h-1.5 rounded-full" style={{ width: `${e.pct}%` }} />
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">{e.pct}% of total expenses</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selectedReport === 'tax' && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100"><h2 className="text-sm font-semibold text-slate-900">Tax Summary</h2></div>
                <div className="p-6">
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-5">
                    <p className="text-xs font-semibold text-amber-700 mb-1">⚠ Estimated values only</p>
                    <p className="text-xs text-amber-600 leading-relaxed">Tax figures are estimates based on your cashbook income. Actual liability depends on deductions and tax regime. Consult a CA for accurate computation.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: 'Gross Income (Period)', value: fmtL(income), note: 'From credit entries' },
                      { label: 'Est. GST Collected (18%)', value: fmtL(income * 0.18 / 1.18), note: 'If GST-registered @ 18%' },
                      { label: 'Est. Advance Tax Due', value: fmtL(Math.max(0, netProfit * 0.25)), note: '~25% of net profit' },
                      { label: 'Net Profit (Pre-Tax)', value: fmtL(netProfit), note: 'Income minus expenses' },
                    ].map(t => (
                      <div key={t.label} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{t.label}</p>
                        <p className="text-xl font-bold text-slate-900 mb-0.5">{t.value}</p>
                        <p className="text-[11px] text-slate-400">{t.note}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                    <p className="text-xs text-blue-700 font-semibold mb-1">💡 Get accurate tax calculation from AI Chatbot</p>
                    <p className="text-xs text-blue-600">Go to AI Chatbot and ask: "Calculate my advance tax for this financial year" with your income details.</p>
                  </div>
                </div>
              </div>
            )}

            {selectedReport === 'txn' && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900">Transaction Log</h2>
                  <span className="text-xs text-slate-400">{fEntries.length} entries</span>
                </div>
                {fEntries.length === 0 ? (
                  <div className="py-12 text-center text-sm text-slate-400">No confirmed transactions for selected period.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-slate-50 border-b border-slate-200">
                        {['Date', 'Type', 'Amount', 'Description', 'Party', 'Mode'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {fEntries.slice(0, 100).map((e, i) => (
                          <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                            <td className="px-4 py-2.5 text-xs text-slate-600">{e.date}</td>
                            <td className="px-4 py-2.5">
                              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${e.type === 'credit' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                                {e.type === 'credit' ? '+ Income' : '- Expense'}
                              </span>
                            </td>
                            <td className={`px-4 py-2.5 font-semibold text-sm ${e.type === 'credit' ? 'text-emerald-700' : 'text-red-600'}`}>
                              {e.type === 'credit' ? '+' : '-'}{fmt(parseFloat(e.amount))}
                            </td>
                            <td className="px-4 py-2.5 text-xs text-slate-600 max-w-[160px] truncate">{e.description || '—'}</td>
                            <td className="px-4 py-2.5 text-xs text-slate-500">{e.party_name || '—'}</td>
                            <td className="px-4 py-2.5 text-xs text-slate-500 capitalize">{e.payment_mode || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {fEntries.length > 100 && (
                      <p className="px-6 py-3 text-xs text-slate-400 border-t border-slate-100">Showing 100 of {fEntries.length}. Export CSV for full list.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {selectedReport === 'itr' && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100"><h2 className="text-sm font-semibold text-slate-900">ITR Filing History</h2></div>
                {itrData.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-sm text-slate-400 mb-2">No ITR records found.</p>
                    <button onClick={() => { window.location.href = '/dashboard/itr' }} className="text-xs font-semibold text-blue-600 hover:text-blue-700">
                      Go to ITR Analysis → Upload your ITR
                    </button>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead><tr className="bg-slate-50 border-b border-slate-200">
                      {['Assessment Year', 'Status', 'Filing Date', 'Tax Paid'].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {itrData.map((itr, i) => (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="px-5 py-3 font-semibold text-slate-800">{itr.assessment_year || '—'}</td>
                          <td className="px-5 py-3">
                            <span className={`px-2 py-0.5 text-xs rounded-full font-semibold ${itr.status === 'filed' || itr.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                              {itr.status || 'pending'}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-xs text-slate-600">{itr.filing_date || itr.created_at?.split('T')[0] || '—'}</td>
                          <td className="px-5 py-3 font-medium text-slate-800">{itr.tax_paid ? fmt(itr.tax_paid) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  )
}
