'use client'
import { useQuery } from '@tanstack/react-query'
import {
  FileText, Users, ArrowLeftRight, Bot, Send, CheckCircle,
  TrendingUp, Clock, AlertTriangle,
} from 'lucide-react'
import { formatDateTime, stageLabel, stageColor, cn } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

function StatCard({ label, value, icon: Icon, color, sub }: {
  label: string; value: number | string; icon: React.ElementType
  color: string; sub?: string
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={cn('p-2 rounded-lg', color)}>
          <Icon size={18} />
        </div>
      </div>
      <div className="text-2xl font-bold mb-0.5">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  )
}

const STAGE_COLORS: Record<string, string> = {
  NEW: '#94a3b8',
  SCREENED: '#60a5fa',
  SCREENING_CALL: '#a78bfa',
  INTERVIEWING: '#fbbf24',
  SUBMITTED_TO_CLIENT: '#34d399',
  CLIENT_APPROVED: '#10b981',
  ONBOARDING: '#06b6d4',
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const r = await fetch('/api/dashboard')
      return r.json()
    },
  })

  const d = data?.data
  const kpis = d?.kpis || {}
  const pipelineStages = d?.pipelineStages || []
  const activity = d?.recentActivity || []

  if (isLoading) return <DashboardSkeleton />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Tahaluf recruitment pipeline — ACS Technologies</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active JDs" value={kpis.activeJDs ?? 0} icon={FileText} color="bg-brand-50 text-brand-600" sub={`${kpis.totalJDs ?? 0} total`} />
        <StatCard label="External candidates" value={kpis.totalCandidates ?? 0} icon={Users} color="bg-green-50 text-green-600" />
        <StatCard label="Internal resources" value={kpis.internalResources ?? 0} icon={ArrowLeftRight} color="bg-pink-50 text-pink-600" />
        <StatCard label="Pending screening" value={kpis.pendingScreening ?? 0} icon={Bot} color="bg-amber-50 text-amber-600" sub="Need AI screening" />
        <StatCard label="Submitted to Tahaluf" value={kpis.submitted ?? 0} icon={Send} color="bg-teal-50 text-teal-600" />
        <StatCard label="Tahaluf approved" value={kpis.approved ?? 0} icon={CheckCircle} color="bg-emerald-50 text-emerald-600" />
        <StatCard label="Onboarding" value={kpis.onboarding ?? 0} icon={TrendingUp} color="bg-violet-50 text-violet-600" sub="Active onboardings" />
        <StatCard label="Avg time to hire" value="18d" icon={Clock} color="bg-orange-50 text-orange-600" sub="Estimate" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline chart */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold mb-4">Pipeline by stage</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={pipelineStages} layout="vertical" margin={{ left: 20 }}>
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis
                type="category"
                dataKey="stage"
                tick={{ fontSize: 11 }}
                width={120}
                tickFormatter={stageLabel}
              />
              <Tooltip formatter={(v: any) => [v, 'Candidates']} />
              <Bar dataKey="count" radius={4}>
                {pipelineStages.map((s: any) => (
                  <Cell key={s.stage} fill={STAGE_COLORS[s.stage] || '#94a3b8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Activity feed */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold mb-4">Recent activity</h2>
          <div className="space-y-0">
            {activity.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No activity yet</p>
            )}
            {activity.map((item: any) => (
              <div key={item.id} className="flex items-start gap-3 py-3 border-b border-border last:border-0">
                <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-semibold text-brand-700">
                    {item.user?.name ? item.user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2) : 'SY'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{item.action.replace(/_/g, ' ')}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {item.user?.name || 'System'} · {formatDateTime(item.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-muted rounded w-48" />
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-28 bg-muted rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div className="h-72 bg-muted rounded-xl" />
        <div className="h-72 bg-muted rounded-xl" />
      </div>
    </div>
  )
}
