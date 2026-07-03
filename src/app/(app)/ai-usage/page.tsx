'use client'

import type { ElementType } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  Bot,
  CalendarDays,
  Clock3,
  Cpu,
  Database,
  Layers3,
  Users,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { cn, formatDateTime } from '@/lib/utils'

type AIUsageData = {
  generatedAt: string
  range: { days: number; start: string; end: string }
  totals: {
    today: UsageTotals
    month: UsageTotals
    range: UsageTotals
  }
  byFeature: Array<BreakdownRow & { feature: string; averageDurationMs: number }>
  byProvider: Array<BreakdownRow & { provider: string; model: string }>
  byUser: Array<{ userId: string | null; name: string; email?: string; requests: number; totalTokens: number; share: number }>
  timeline: Array<{ date: string; requests: number; promptTokens: number; completionTokens: number; totalTokens: number }>
  recentLogs: Array<{
    id: string
    createdAt: string
    feature: string
    provider: string
    model: string
    promptTokens: number
    completionTokens: number
    totalTokens: number
    cachedTokens?: number | null
    requestChars?: number | null
    responseChars?: number | null
    durationMs?: number | null
    user?: { name: string; email: string } | null
  }>
}

type UsageTotals = {
  requests: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cachedTokens: number
  averageDurationMs: number
}

type BreakdownRow = {
  requests: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
  share: number
}

function numberValue(value?: number | null) {
  return new Intl.NumberFormat('en-GB').format(value || 0)
}

function compactValue(value?: number | null) {
  return new Intl.NumberFormat('en-GB', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value || 0)
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(new Date(value))
}

function msLabel(value?: number | null) {
  if (!value) return '0 ms'
  if (value < 1000) return `${value} ms`
  return `${(value / 1000).toFixed(1)} s`
}

function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string
  value: string
  sub: string
  icon: ElementType
  tone: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 min-h-[126px]">
      <div className="flex items-start justify-between gap-3">
        <div className={cn('rounded-lg p-2', tone)}>
          <Icon size={18} />
        </div>
      </div>
      <div className="mt-4 text-2xl font-bold tracking-tight">{value}</div>
      <div className="mt-1 text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 text-xs text-muted-foreground">{sub}</div>
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
    <section className={cn('rounded-xl border border-border bg-card p-5', className)}>
      <div className="mb-4">
        <h2 className="font-semibold">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </section>
  )
}

function EmptyState({ label }: { label: string }) {
  return <div className="py-10 text-center text-sm text-muted-foreground">{label}</div>
}

export default function AIUsagePage() {
  const { data, isLoading } = useQuery({
    queryKey: ['ai-usage'],
    queryFn: async () => {
      const response = await fetch('/api/ai-usage')
      return response.json()
    },
  })

  const usage: AIUsageData | undefined = data?.data
  const today = usage?.totals.today
  const month = usage?.totals.month
  const range = usage?.totals.range
  const timeline = usage?.timeline || []

  if (isLoading) return <AIUsageSkeleton />

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI Usage</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Token consumption across AI queries, models, users, and workflows.
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          Updated {usage?.generatedAt ? formatDateTime(usage.generatedAt) : 'just now'}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Tokens today"
          value={compactValue(today?.totalTokens)}
          icon={Bot}
          tone="bg-brand-50 text-brand-700"
          sub={`${numberValue(today?.requests)} requests today`}
        />
        <MetricCard
          label="Tokens this month"
          value={compactValue(month?.totalTokens)}
          icon={CalendarDays}
          tone="bg-blue-50 text-blue-700"
          sub={`${numberValue(month?.promptTokens)} input / ${numberValue(month?.completionTokens)} output`}
        />
        <MetricCard
          label={`${usage?.range.days || 14}-day tokens`}
          value={compactValue(range?.totalTokens)}
          icon={Database}
          tone="bg-emerald-50 text-emerald-700"
          sub={`${numberValue(range?.cachedTokens)} cached tokens`}
        />
        <MetricCard
          label="Average response time"
          value={msLabel(range?.averageDurationMs)}
          icon={Clock3}
          tone="bg-amber-50 text-amber-700"
          sub={`${numberValue(range?.requests)} AI queries in range`}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-5">
        <Panel title="Daily Token Trend" subtitle="Prompt and completion tokens by day" className="xl:col-span-3">
          {timeline.length ? (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={timeline} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={dateLabel} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={compactValue} />
                <Tooltip
                  labelFormatter={dateLabel}
                  formatter={(value: number, name: string) => [numberValue(value), name === 'promptTokens' ? 'Prompt tokens' : 'Completion tokens']}
                />
                <Area type="monotone" dataKey="promptTokens" stackId="tokens" stroke="#2563eb" fill="#93c5fd" />
                <Area type="monotone" dataKey="completionTokens" stackId="tokens" stroke="#0f766e" fill="#5eead4" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState label="No AI usage has been recorded yet" />
          )}
        </Panel>

        <Panel title="Provider Mix" subtitle="Models consuming the most tokens" className="xl:col-span-2">
          <div className="space-y-3">
            {(usage?.byProvider || []).map(row => (
              <div key={`${row.provider}-${row.model}`} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium capitalize">{row.provider}</div>
                    <div className="truncate text-xs text-muted-foreground">{row.model}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{compactValue(row.totalTokens)}</div>
                    <div className="text-xs text-muted-foreground">{row.share}%</div>
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.min(row.share, 100)}%` }} />
                </div>
              </div>
            ))}
            {(usage?.byProvider || []).length === 0 && <EmptyState label="No provider usage yet" />}
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Usage By Workflow" subtitle="Where the AI tokens are going">
          {(usage?.byFeature || []).length ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={usage?.byFeature || []} margin={{ top: 8, right: 16, left: 0, bottom: 36 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="feature" tick={{ fontSize: 11 }} interval={0} angle={-22} textAnchor="end" />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={compactValue} />
                <Tooltip formatter={(value: number) => [numberValue(value), 'Tokens']} />
                <Bar dataKey="totalTokens" fill="#0f766e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState label="No workflow usage yet" />
          )}
        </Panel>

        <Panel title="Top Users" subtitle="Token use by signed-in user">
          <div className="space-y-3">
            {(usage?.byUser || []).map(user => (
              <div key={user.userId || user.name} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                    <Users size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{user.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{user.email || `${user.requests} requests`}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{compactValue(user.totalTokens)}</div>
                  <div className="text-xs text-muted-foreground">{user.share}%</div>
                </div>
              </div>
            ))}
            {(usage?.byUser || []).length === 0 && <EmptyState label="No signed-in user usage yet" />}
          </div>
        </Panel>
      </div>

      <Panel title="Recent AI Queries" subtitle="Latest token records captured after each AI response">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="pb-3 font-medium">Time</th>
                <th className="pb-3 font-medium">Workflow</th>
                <th className="pb-3 font-medium">Provider</th>
                <th className="pb-3 font-medium">User</th>
                <th className="pb-3 text-right font-medium">Prompt</th>
                <th className="pb-3 text-right font-medium">Output</th>
                <th className="pb-3 text-right font-medium">Total</th>
                <th className="pb-3 text-right font-medium">Latency</th>
              </tr>
            </thead>
            <tbody>
              {(usage?.recentLogs || []).map(log => (
                <tr key={log.id} className="border-b border-border last:border-0">
                  <td className="whitespace-nowrap py-3 pr-3 text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</td>
                  <td className="py-3 pr-3">
                    <div className="font-medium">{log.feature}</div>
                    <div className="text-xs text-muted-foreground">
                      {numberValue(log.requestChars)} chars in / {numberValue(log.responseChars)} chars out
                    </div>
                  </td>
                  <td className="py-3 pr-3">
                    <div className="capitalize">{log.provider}</div>
                    <div className="max-w-[180px] truncate text-xs text-muted-foreground">{log.model}</div>
                  </td>
                  <td className="py-3 pr-3 text-muted-foreground">{log.user?.name || 'System'}</td>
                  <td className="py-3 text-right">{numberValue(log.promptTokens)}</td>
                  <td className="py-3 text-right">{numberValue(log.completionTokens)}</td>
                  <td className="py-3 text-right font-semibold">{numberValue(log.totalTokens)}</td>
                  <td className="py-3 text-right">{msLabel(log.durationMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(usage?.recentLogs || []).length === 0 && <EmptyState label="No AI queries logged yet" />}
        </div>
      </Panel>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: 'Prompt tokens', value: range?.promptTokens, icon: Layers3, tone: 'bg-blue-50 text-blue-700' },
          { label: 'Completion tokens', value: range?.completionTokens, icon: Activity, tone: 'bg-teal-50 text-teal-700' },
          { label: 'Total AI requests', value: range?.requests, icon: Cpu, tone: 'bg-slate-100 text-slate-700' },
        ].map(item => (
          <div key={item.label} className="rounded-xl border border-border bg-card p-4">
            <div className={cn('mb-3 w-fit rounded-lg p-2', item.tone)}>
              <item.icon size={18} />
            </div>
            <div className="text-2xl font-bold">{numberValue(item.value)}</div>
            <div className="mt-1 text-sm text-muted-foreground">{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AIUsageSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-10 w-64 rounded bg-muted" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-32 rounded-xl bg-muted" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-5">
        <div className="h-96 rounded-xl bg-muted xl:col-span-3" />
        <div className="h-96 rounded-xl bg-muted xl:col-span-2" />
      </div>
    </div>
  )
}
