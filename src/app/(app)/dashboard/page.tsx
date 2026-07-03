'use client'

import type { ElementType } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeftRight,
  BarChart3,
  Bot,
  Briefcase,
  CalendarClock,
  CheckCircle,
  CircleDollarSign,
  Clock,
  FileText,
  Send,
  ShieldAlert,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { cn, formatCurrency, formatDateTime, stageColor, stageLabel } from '@/lib/utils'

type DashboardData = {
  generatedAt: string
  kpis: Record<string, number>
  ratios: Record<string, number>
  pipelineStages: Array<{ stage: string; count: number; share: number }>
  topJDs: Array<{
    id: string
    title: string
    client: string
    openings: number
    pipelineCount: number
    shortlisted: number
    submitted: number
    approved: number
    averageScore: number
  }>
  highScoreCandidates: Array<{
    id: string
    candidate: string
    title?: string
    isInternal: boolean
    jd: string
    client: string
    stage: string
    score: number
  }>
  stalledEntries: Array<{
    id: string
    candidate: string
    jd: string
    client: string
    stage: string
    ageDays: number
  }>
  upcomingInterviews: Array<{
    id: string
    candidate: string
    title?: string
    jd: string
    scheduledAt: string
    roundNumber: number
    interviewerName?: string
  }>
  openSubmissions: Array<{
    id: string
    candidate: string
    jd: string
    status: string
    ageDays: number
  }>
  sourceBreakdown: Array<{ source: string; count: number }>
  submissionStatusBreakdown: Array<{ status: string; count: number }>
  recentActivity: Array<{
    id: string
    action: string
    createdAt: string
    user?: { name?: string | null; avatarUrl?: string | null } | null
  }>
}

const STAGE_COLORS: Record<string, string> = {
  NEW: '#64748b',
  SCREENING: '#38bdf8',
  SCREENED: '#2563eb',
  SCREENING_CALL: '#8b5cf6',
  INTERVIEW_SCHEDULED: '#f59e0b',
  INTERVIEWING: '#d97706',
  INTERNAL_APPROVED: '#16a34a',
  SUBMITTED_TO_CLIENT: '#0f766e',
  CLIENT_APPROVED: '#059669',
  ONBOARDING: '#0891b2',
  ONBOARDED: '#047857',
  REJECTED: '#dc2626',
}

const PIE_COLORS = ['#0f766e', '#2563eb', '#f59e0b', '#16a34a', '#dc2626', '#64748b']

function numberValue(value?: number) {
  return new Intl.NumberFormat('en-GB').format(value ?? 0)
}

function compactCurrency(value?: number) {
  return formatCurrency(value ?? 0).replace('.00', '')
}

function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
  urgent,
}: {
  label: string
  value: number | string
  sub?: string
  icon: ElementType
  tone: string
  urgent?: boolean
}) {
  return (
    <div className={cn('bg-card border rounded-xl p-4 min-h-[124px]', urgent ? 'border-red-200' : 'border-border')}>
      <div className="flex items-start justify-between gap-3">
        <div className={cn('p-2 rounded-lg', tone)}>
          <Icon size={18} />
        </div>
        {urgent && <span className="text-[11px] font-semibold text-red-700 bg-red-50 px-2 py-1 rounded-full">Watch</span>}
      </div>
      <div className="mt-4 text-2xl font-bold tracking-tight">{value}</div>
      <div className="mt-1 text-sm text-muted-foreground">{label}</div>
      {sub && <div className="mt-2 text-xs text-muted-foreground">{sub}</div>}
    </div>
  )
}

function RatioTile({ label, value, detail, tone = 'bg-brand-600' }: {
  label: string
  value: number
  detail: string
  tone?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs text-muted-foreground mt-1">{detail}</div>
        </div>
        <div className="text-2xl font-bold">{value}%</div>
      </div>
      <div className="mt-4 h-2 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full', tone)} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  )
}

function Panel({ title, subtitle, children, className }: {
  title: string
  subtitle?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('bg-card border border-border rounded-xl p-5', className)}>
      <div className="mb-4">
        <h2 className="font-semibold">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {children}
    </section>
  )
}

function EmptyState({ label }: { label: string }) {
  return <div className="py-10 text-center text-sm text-muted-foreground">{label}</div>
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard')
      return response.json()
    },
  })

  const dashboard: DashboardData | undefined = data?.data
  const kpis = dashboard?.kpis || {}
  const ratios = dashboard?.ratios || {}
  const pipelineStages = dashboard?.pipelineStages || []

  const executiveAlerts = dashboard
    ? [
      {
        label: 'Screening backlog',
        value: kpis.pendingScreening || 0,
        note: `${ratios.screeningCoverage || 0}% screened coverage`,
        tone: (kpis.pendingScreening || 0) > 0 ? 'text-amber-700 bg-amber-50' : 'text-green-700 bg-green-50',
      },
      {
        label: 'Stalled pipeline',
        value: dashboard.stalledEntries.length,
        note: 'No movement in 7+ days',
        tone: dashboard.stalledEntries.length ? 'text-red-700 bg-red-50' : 'text-green-700 bg-green-50',
      },
      {
        label: 'Critical flags',
        value: kpis.criticalFlags || 0,
        note: `${kpis.redFlags || 0} total flags`,
        tone: (kpis.criticalFlags || 0) > 0 ? 'text-red-700 bg-red-50' : 'text-green-700 bg-green-50',
      },
      {
        label: 'Client decisions',
        value: kpis.openSubmissions || 0,
        note: `${ratios.clientApprovalRate || 0}% approval rate`,
        tone: (kpis.openSubmissions || 0) > 0 ? 'text-blue-700 bg-blue-50' : 'text-green-700 bg-green-50',
      },
    ]
    : []

  if (isLoading) return <DashboardSkeleton />

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Executive Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            TalentFlow command view for ACS and Tahaluf hiring performance.
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          Updated {dashboard?.generatedAt ? formatDateTime(dashboard.generatedAt) : 'just now'}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {executiveAlerts.map(alert => (
          <div key={alert.label} className="rounded-xl border border-border bg-card p-4">
            <div className="text-sm text-muted-foreground">{alert.label}</div>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div className="text-3xl font-bold">{numberValue(alert.value)}</div>
              <span className={cn('text-xs font-medium rounded-full px-2 py-1', alert.tone)}>{alert.note}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-6">
        <MetricCard
          label="Open roles"
          value={numberValue(kpis.openRoles)}
          icon={Briefcase}
          tone="bg-brand-50 text-brand-600"
          sub={`${numberValue(kpis.activeJDs)} active JDs`}
        />
        <MetricCard
          label="Active pipeline"
          value={numberValue(kpis.activePipeline)}
          icon={Users}
          tone="bg-blue-50 text-blue-700"
          sub={`${numberValue(kpis.newCandidates30d)} new in 30 days`}
        />
        <MetricCard
          label="Internal resources"
          value={numberValue(kpis.internalResources)}
          icon={ArrowLeftRight}
          tone="bg-pink-50 text-pink-700"
          sub={`${ratios.internalMix || 0}% of talent pool`}
        />
        <MetricCard
          label="Pending screening"
          value={numberValue(kpis.pendingScreening)}
          icon={Bot}
          tone="bg-amber-50 text-amber-700"
          sub="Need AI or HR review"
          urgent={(kpis.pendingScreening || 0) > 0}
        />
        <MetricCard
          label="Client approved"
          value={numberValue(kpis.approved)}
          icon={CheckCircle}
          tone="bg-emerald-50 text-emerald-700"
          sub={`${ratios.clientApprovalRate || 0}% approval rate`}
        />
        <MetricCard
          label="Monthly margin"
          value={compactCurrency(kpis.monthlyMargin)}
          icon={CircleDollarSign}
          tone="bg-teal-50 text-teal-700"
          sub={`${ratios.marginRate || 0}% margin on placements`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <RatioTile label="Fulfillment" value={ratios.fulfillment || 0} detail="Late-stage plus onboarded vs openings" tone="bg-emerald-600" />
        <RatioTile label="Screening coverage" value={ratios.screeningCoverage || 0} detail="Pipeline entries with scores or movement" tone="bg-blue-600" />
        <RatioTile label="Shortlist rate" value={ratios.shortlistRate || 0} detail="Shortlisted share of active pipeline" tone="bg-amber-500" />
        <RatioTile label="Onboarding completion" value={ratios.onboardingCompletion || 0} detail="Completed checklist items" tone="bg-teal-600" />
      </div>

      <div className="grid gap-5 xl:grid-cols-5">
        <Panel title="Pipeline Flow" subtitle="Where candidates sit right now" className="xl:col-span-3">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={pipelineStages} margin={{ top: 8, right: 16, left: 0, bottom: 28 }}>
              <XAxis dataKey="stage" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" tickFormatter={stageLabel} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip formatter={(value: number) => [value, 'Candidates']} labelFormatter={stageLabel} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {pipelineStages.map(stage => (
                  <Cell key={stage.stage} fill={STAGE_COLORS[stage.stage] || '#64748b'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Decision Mix" subtitle="Client response and source quality" className="xl:col-span-2">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dashboard?.submissionStatusBreakdown || []}
                    dataKey="count"
                    nameKey="status"
                    innerRadius={42}
                    outerRadius={66}
                    paddingAngle={3}
                  >
                    {(dashboard?.submissionStatusBreakdown || []).map((item, index) => (
                      <Cell key={item.status} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [value, 'Submissions']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {(dashboard?.sourceBreakdown || []).map((source, index) => (
                <div key={source.source} className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                    <span className="truncate">{source.source}</span>
                  </div>
                  <span className="font-semibold">{source.count}</span>
                </div>
              ))}
              {(dashboard?.sourceBreakdown || []).length === 0 && <EmptyState label="No source data yet" />}
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Role Coverage" subtitle="Open JDs ranked by current coverage">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-3 font-medium">Role</th>
                  <th className="pb-3 font-medium">Open</th>
                  <th className="pb-3 font-medium">Pipe</th>
                  <th className="pb-3 font-medium">Sub</th>
                  <th className="pb-3 font-medium">Appr</th>
                  <th className="pb-3 font-medium">Avg</th>
                </tr>
              </thead>
              <tbody>
                {(dashboard?.topJDs || []).map(jd => (
                  <tr key={jd.id} className="border-b border-border last:border-0">
                    <td className="py-3 pr-3">
                      <div className="font-medium max-w-[260px] truncate">{jd.title}</div>
                      <div className="text-xs text-muted-foreground">{jd.client}</div>
                    </td>
                    <td className="py-3">{jd.openings}</td>
                    <td className="py-3">{jd.pipelineCount}</td>
                    <td className="py-3">{jd.submitted}</td>
                    <td className="py-3">{jd.approved}</td>
                    <td className="py-3">{jd.averageScore || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(dashboard?.topJDs || []).length === 0 && <EmptyState label="No active JDs yet" />}
          </div>
        </Panel>

        <Panel title="Best Matches" subtitle="High-score candidates leadership should notice">
          <div className="space-y-3">
            {(dashboard?.highScoreCandidates || []).map(candidate => (
              <div key={candidate.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{candidate.candidate}</span>
                    {candidate.isInternal && (
                      <span className="text-[11px] font-medium rounded-full bg-pink-50 text-pink-700 px-2 py-0.5">Internal</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{candidate.jd}</div>
                  <span className={cn('mt-2 inline-flex px-2 py-0.5 rounded-full text-xs font-medium', stageColor(candidate.stage))}>
                    {stageLabel(candidate.stage)}
                  </span>
                </div>
                <div className="text-2xl font-bold text-emerald-700">{candidate.score}</div>
              </div>
            ))}
            {(dashboard?.highScoreCandidates || []).length === 0 && <EmptyState label="No high-score candidates yet" />}
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Panel title="Needs Action" subtitle="Aged items and risk signals">
          <div className="space-y-3">
            {(dashboard?.stalledEntries || []).map(entry => (
              <div key={entry.id} className="rounded-lg border border-red-100 bg-red-50/40 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{entry.candidate}</div>
                    <div className="text-xs text-muted-foreground truncate">{entry.jd}</div>
                  </div>
                  <span className="text-xs font-semibold text-red-700">{entry.ageDays}d</span>
                </div>
                <span className={cn('mt-2 inline-flex px-2 py-0.5 rounded-full text-xs font-medium', stageColor(entry.stage))}>
                  {stageLabel(entry.stage)}
                </span>
              </div>
            ))}
            {(dashboard?.stalledEntries || []).length === 0 && <EmptyState label="No stalled pipeline items" />}
          </div>
        </Panel>

        <Panel title="Upcoming Interviews" subtitle="Next 7 days">
          <div className="space-y-3">
            {(dashboard?.upcomingInterviews || []).map(interview => (
              <div key={interview.id} className="flex gap-3 rounded-lg border border-border p-3">
                <CalendarClock size={18} className="mt-0.5 text-brand-600" />
                <div className="min-w-0">
                  <div className="font-medium truncate">{interview.candidate}</div>
                  <div className="text-xs text-muted-foreground truncate">{interview.jd}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    R{interview.roundNumber} - {formatDateTime(interview.scheduledAt)}
                  </div>
                </div>
              </div>
            ))}
            {(dashboard?.upcomingInterviews || []).length === 0 && <EmptyState label="No interviews scheduled this week" />}
          </div>
        </Panel>

        <Panel title="Client Responses" subtitle="Submissions awaiting movement">
          <div className="space-y-3">
            {(dashboard?.openSubmissions || []).map(submission => (
              <div key={submission.id} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{submission.candidate}</div>
                    <div className="text-xs text-muted-foreground truncate">{submission.jd}</div>
                  </div>
                  <span className="text-xs font-semibold text-blue-700">{submission.ageDays}d</span>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">{submission.status.replace(/_/g, ' ')}</div>
              </div>
            ))}
            {(dashboard?.openSubmissions || []).length === 0 && <EmptyState label="No pending client responses" />}
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Operating Snapshot" subtitle="All management numbers in one place">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: 'Total JDs', value: kpis.totalJDs, icon: FileText },
              { label: 'Total candidates', value: kpis.totalCandidates, icon: Users },
              { label: 'Scheduled interviews', value: kpis.scheduledInterviews, icon: Clock },
              { label: 'Completed interviews', value: kpis.completedInterviews, icon: CheckCircle },
              { label: 'Submitted', value: kpis.submitted, icon: Send },
              { label: 'Rejected by client', value: kpis.rejectedByClient, icon: ShieldAlert },
              { label: 'Onboarding', value: kpis.onboarding, icon: TrendingUp },
              { label: 'Active placements', value: kpis.activePlacements, icon: Target },
            ].map(item => (
              <div key={item.label} className="rounded-lg border border-border p-3">
                <item.icon size={16} className="text-muted-foreground mb-2" />
                <div className="text-xl font-bold">{numberValue(item.value)}</div>
                <div className="text-xs text-muted-foreground">{item.label}</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Recent Activity" subtitle="Latest system and user actions">
          <div className="space-y-0">
            {(dashboard?.recentActivity || []).map(item => (
              <div key={item.id} className="flex items-start gap-3 py-3 border-b border-border last:border-0">
                <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <BarChart3 size={15} className="text-brand-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{item.action.replace(/_/g, ' ')}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {item.user?.name || 'System'} - {formatDateTime(item.createdAt)}
                  </div>
                </div>
              </div>
            ))}
            {(dashboard?.recentActivity || []).length === 0 && <EmptyState label="No activity yet" />}
          </div>
        </Panel>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-10 bg-muted rounded w-72" />
      <div className="grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-24 bg-muted rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-32 bg-muted rounded-xl" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-5">
        <div className="h-96 bg-muted rounded-xl xl:col-span-3" />
        <div className="h-96 bg-muted rounded-xl xl:col-span-2" />
      </div>
    </div>
  )
}
