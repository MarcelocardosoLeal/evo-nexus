import { useEffect, useState } from 'react'
import { DollarSign, Zap, Activity, Calculator, type LucideIcon } from 'lucide-react'
import { api } from '../lib/api'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts'

interface CostData {
  today: number
  week: number
  month_estimate: number
  total_cost: number
  daily: { date: string; cost: number }[]
  by_agent: { agent: string; cost: number }[]
  by_routine: {
    name: string
    runs: number
    tokens: number
    cost: number
    total_cost: number
    avg_cost: number
    agent: string
  }[]
}

function normalizeCostData(raw: any): CostData {
  const byRoutine = Array.isArray(raw?.by_routine) ? raw.by_routine : []
  const byAgent = Array.isArray(raw?.by_agent) ? raw.by_agent : []
  const totalCost = Number(raw?.total_cost || 0)
  const normalizedByRoutine = byRoutine.map((r: any) => ({
    ...r,
    name: r.name || '',
    runs: Number(r.runs || 0),
    total_cost: Number(r.total_cost || r.cost || 0),
    avg_cost: Number(r.avg_cost || (r.runs ? (Number(r.cost || 0) / Number(r.runs || 1)) : 0)),
  }))
  return {
    today: Number(raw?.today || 0),
    week: Number(raw?.week || 0),
    month_estimate: Number(raw?.month_estimate || totalCost),
    total_cost: totalCost,
    daily: Array.isArray(raw?.daily) ? raw.daily : [],
    by_agent: byAgent,
    by_routine: normalizedByRoutine,
  }
}

const COLORS = ['#00FFA7', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316']

// --- Stat Card (matches Overview.tsx) ---
function StatCard({
  label,
  value,
  subtitle,
  icon: Icon,
}: {
  label: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
}) {
  return (
    <div className="group relative bg-[#161b22] border border-[#21262d] rounded-2xl p-5 transition-all duration-300 hover:border-[#00FFA7]/40 hover:shadow-[0_0_24px_rgba(0,255,167,0.06)]">
      {/* Subtle top gradient accent */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#00FFA7]/20 to-transparent rounded-t-2xl" />

      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#00FFA7]/8 border border-[#00FFA7]/15">
          <Icon size={18} className="text-[#00FFA7]" />
        </div>
      </div>

      <p className="text-3xl font-bold text-[#e6edf3] tracking-tight">{value}</p>
      <p className="text-sm text-[#667085] mt-1">{label}</p>
      {subtitle && <p className="text-xs text-[#667085]/60 mt-0.5">{subtitle}</p>}
    </div>
  )
}

// --- Skeleton ---
function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-[#21262d] bg-[#161b22] p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="h-9 w-9 rounded-xl bg-[#21262d] animate-pulse" />
      </div>
      <div className="h-8 w-24 rounded bg-[#21262d] animate-pulse mb-2" />
      <div className="h-4 w-20 rounded bg-[#21262d] animate-pulse" />
    </div>
  )
}

export default function Costs() {
  const [data, setData] = useState<CostData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/costs')
      .then((raw) => setData(normalizeCostData(raw)))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="max-w-[1400px] mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#e6edf3] tracking-tight">Costs</h1>
          <p className="text-[#667085] text-sm mt-1">AI usage cost analysis</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="skeleton h-80 rounded-2xl" />
          <div className="skeleton h-80 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-16">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#161b22] border border-[#21262d]">
          <DollarSign size={32} className="text-[#3F3F46]" />
        </div>
        <p className="text-[#667085] text-lg">No cost data available</p>
        <p className="text-[#3F3F46] text-sm mt-1">Cost data will appear after routines run</p>
      </div>
    )
  }

  const totalRuns = (data.by_routine || []).reduce((sum, r) => sum + Number(r.runs || 0), 0)
  const avgCostPerRun = totalRuns > 0 ? data.total_cost / totalRuns : 0

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#e6edf3] tracking-tight">Costs</h1>
        <p className="text-[#667085] text-sm mt-1">AI usage cost analysis</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Today"
          value={`$${Number(data.today || 0).toFixed(2)}`}
          subtitle="Current day spend"
          icon={DollarSign}
        />
        <StatCard
          label="This Week"
          value={`$${Number(data.week || 0).toFixed(2)}`}
          subtitle="Rolling 7 days"
          icon={Activity}
        />
        <StatCard
          label="Month Estimate"
          value={`$${Number(data.month_estimate || data.total_cost || 0).toFixed(2)}`}
          subtitle="Projected total"
          icon={Zap}
        />
        <StatCard
          label="Avg Cost / Run"
          value={`$${avgCostPerRun.toFixed(4)}`}
          subtitle={`${totalRuns} total runs`}
          icon={Calculator}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Line Chart: Cost per day */}
        <div className="bg-[#161b22] border border-[#21262d] rounded-2xl p-6 transition-all duration-300 hover:shadow-[0_0_32px_rgba(0,255,167,0.04)]">
          <h2 className="text-base font-semibold text-[#e6edf3] mb-4 flex items-center gap-2.5">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#00FFA7]/8 border border-[#00FFA7]/15">
              <Activity size={14} className="text-[#00FFA7]" />
            </div>
            Cost per Day
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data.daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
              <XAxis dataKey="date" tick={{ fill: '#667085', fontSize: 11 }} />
              <YAxis tick={{ fill: '#667085', fontSize: 11 }} tickFormatter={(v) => `$${v.toFixed(2)}`} />
              <Tooltip
                contentStyle={{ background: '#161b22', border: '1px solid #21262d', borderRadius: '12px', color: '#e6edf3' }}
                formatter={(value: unknown) => [`$${Number(value).toFixed(4)}`, 'Cost']}
              />
              <Line type="monotone" dataKey="cost" stroke="#00FFA7" strokeWidth={2} dot={{ fill: '#00FFA7', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart: Cost per agent */}
        <div className="bg-[#161b22] border border-[#21262d] rounded-2xl p-6 transition-all duration-300 hover:shadow-[0_0_32px_rgba(0,255,167,0.04)]">
          <h2 className="text-base font-semibold text-[#e6edf3] mb-4 flex items-center gap-2.5">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#00FFA7]/8 border border-[#00FFA7]/15">
              <DollarSign size={14} className="text-[#00FFA7]" />
            </div>
            Cost per Agent
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={data.by_agent}
                dataKey="cost"
                nameKey="agent"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={({ name, percent }: any) => `${name || ''} ${((percent || 0) * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {(data.by_agent || []).map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#161b22', border: '1px solid #21262d', borderRadius: '12px', color: '#e6edf3' }}
                formatter={(value: unknown) => [`$${Number(value).toFixed(4)}`, 'Cost']}
              />
              <Legend wrapperStyle={{ color: '#8b949e', fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Per Routine Table */}
      <div className="bg-[#161b22] border border-[#21262d] rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-[0_0_32px_rgba(0,255,167,0.04)]">
        <div className="p-5 border-b border-[#21262d]">
          <h2 className="text-base font-semibold text-[#e6edf3] flex items-center gap-2.5">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#00FFA7]/8 border border-[#00FFA7]/15">
              <Calculator size={14} className="text-[#00FFA7]" />
            </div>
            Per Routine Breakdown
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[#667085] text-[11px] uppercase tracking-wider font-medium">
                <th className="text-left p-4 pb-3">Routine</th>
                <th className="text-right p-4 pb-3">Runs</th>
                <th className="text-right p-4 pb-3">Total Cost</th>
                <th className="text-right p-4 pb-3">Avg Cost</th>
              </tr>
            </thead>
            <tbody>
              {(data.by_routine || []).map((r, i) => (
                <tr
                  key={i}
                  className="border-t border-[#21262d]/60 hover:bg-white/[0.02] transition-colors group"
                >
                  <td className="p-4 text-[#e6edf3] text-[13px] font-medium group-hover:text-white transition-colors">{r.name}</td>
                  <td className="p-4 text-right text-[#8b949e] tabular-nums text-[13px]">{Number(r.runs || 0)}</td>
                  <td className="p-4 text-right text-[#8b949e] tabular-nums text-[13px]">
                    <span className="text-[#e6edf3]">${Number(r.total_cost || 0).toFixed(4)}</span>
                  </td>
                  <td className="p-4 text-right text-[#667085] tabular-nums text-[13px]">${Number(r.avg_cost || 0).toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
