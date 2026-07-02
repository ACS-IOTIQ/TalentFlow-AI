'use client'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Filter,
  Loader2,
  Play,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react'
import { cn, initials, scoreColor, stageColor, stageLabel } from '@/lib/utils'

type ScreeningAnalysis = {
  summary?: string
  justification?: string
  recommendation?: 'SHORTLIST' | 'REVIEW' | 'REJECT'
  strengths?: string[]
  weaknesses?: string[]
  missingSkills?: string[]
  criteriaScores?: Array<{ label: string; score: number; justification: string }>
  screeningCallChecklist?: string[]
}

function parseAnalysis(value?: string | null): ScreeningAnalysis {
  if (!value) return {}
  try {
    return JSON.parse(value)
  } catch {
    return { summary: value }
  }
}

function flagSummary(flags: any[]) {
  const critical = flags.filter(flag => flag.severity === 'CRITICAL').length
  const warning = flags.filter(flag => flag.severity === 'WARNING').length
  return { critical, warning, total: flags.length }
}

function score(entry: any) {
  return entry.compositeScore == null ? null : Math.round(Number(entry.compositeScore))
}

export default function ScreeningPage() {
  const [selectedJd, setSelectedJd] = useState('')
  const [running, setRunning] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [selectedEntries, setSelectedEntries] = useState<Record<string, boolean>>({})
  const [search, setSearch] = useState('')
  const [recommendationFilter, setRecommendationFilter] = useState('')
  const [minScore, setMinScore] = useState(0)
  const [config, setConfig] = useState({
    skillWeight: 60,
    availabilityWeight: 20,
    locationWeight: 20,
    minMatchScore: 65,
    gapThresholdMonths: 6,
    maxNoticeDays: 90,
    preferredLocations: 'Dubai, Abu Dhabi',
    requiredSkills: '',
  })
  const qc = useQueryClient()

  const { data: jdsData } = useQuery({
    queryKey: ['jds-all'],
    queryFn: async () => {
      const response = await fetch('/api/jds?pageSize=50')
      return response.json()
    },
  })

  const { data: screeningData, isLoading } = useQuery({
    queryKey: ['screening-results', selectedJd],
    queryFn: async () => {
      if (!selectedJd) return null
      const response = await fetch(`/api/screening?jdId=${selectedJd}`)
      return response.json()
    },
    enabled: Boolean(selectedJd),
  })

  const entries = screeningData?.data?.entries || []
  const selectedJdData = screeningData?.data?.jd || jdsData?.data?.find((jd: any) => jd.id === selectedJd)

  const rankedEntries = useMemo(() => {
    return entries
      .map((entry: any) => ({ ...entry, analysis: parseAnalysis(entry.screeningNotes), score: score(entry) }))
      .filter((entry: any) => {
        const candidate = entry.candidate
        const matchesSearch = !search || [candidate.fullName, candidate.email, candidate.currentTitle, candidate.location]
          .filter(Boolean)
          .some(value => String(value).toLowerCase().includes(search.toLowerCase()))
        const matchesRecommendation = !recommendationFilter || entry.analysis.recommendation === recommendationFilter
        const matchesScore = entry.score == null ? minScore === 0 : entry.score >= minScore
        return matchesSearch && matchesRecommendation && matchesScore
      })
      .sort((a: any, b: any) => (b.score ?? -1) - (a.score ?? -1))
  }, [entries, search, recommendationFilter, minScore])

  const selectedCount = Object.values(selectedEntries).filter(Boolean).length
  const analyzedCount = entries.filter((entry: any) => entry.compositeScore != null).length
  const averageScore = analyzedCount
    ? Math.round(entries.reduce((sum: number, entry: any) => sum + (score(entry) || 0), 0) / analyzedCount)
    : null

  const saveConfig = async () => {
    if (!selectedJd) throw new Error('Select a JD first')
    const response = await fetch('/api/screening?action=config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jdId: selectedJd,
        ...config,
        preferredLocations: config.preferredLocations.split(',').map(item => item.trim()).filter(Boolean),
        requiredSkills: config.requiredSkills.split(',').map(item => item.trim()).filter(Boolean),
      }),
    })
    const data = await response.json()
    if (!data.success) throw new Error(data.error)
  }

  const runScreening = async () => {
    if (!selectedJd) {
      toast.error('Select a JD first')
      return
    }

    setRunning(true)
    try {
      await saveConfig()
      const response = await fetch('/api/screening?action=run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jdId: selectedJd, force: true }),
      })
      const data = await response.json()
      if (data.success) {
        toast.success(`AI screened ${data.data.screened}/${data.data.total} linked candidate(s)`)
        setSelectedEntries({})
        qc.invalidateQueries({ queryKey: ['screening-results', selectedJd] })
      } else {
        toast.error(data.error)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'AI screening failed')
    } finally {
      setRunning(false)
    }
  }

  const finalize = async () => {
    if (!selectedJd || selectedCount === 0) {
      toast.error('Select candidates to finalize')
      return
    }

    setFinalizing(true)
    try {
      const response = await fetch('/api/screening?action=finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jdId: selectedJd,
          selectedEntryIds: Object.entries(selectedEntries).filter(([, selected]) => selected).map(([id]) => id),
          rejectOthers: false,
        }),
      })
      const data = await response.json()
      if (data.success) {
        toast.success(`${data.data.selected} candidate(s) moved to pipeline screening stage`)
        setSelectedEntries({})
        qc.invalidateQueries({ queryKey: ['screening-results', selectedJd] })
      } else {
        toast.error(data.error)
      }
    } catch {
      toast.error('Unable to finalize screening')
    } finally {
      setFinalizing(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1408px] space-y-6 px-2 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">AI screening</h1>
          <p className="mt-2 text-base text-slate-500">Deep AI research, ranking, justification, and recruiter finalization</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={runScreening}
            disabled={running || !selectedJd}
            className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-700 disabled:opacity-50"
          >
            {running ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            Run AI deep screening
          </button>
          <button
            onClick={finalize}
            disabled={finalizing || selectedCount === 0}
            className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
          >
            {finalizing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            Finalize selected ({selectedCount})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[360px_1fr]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Settings size={17} className="text-slate-400" />
              <h2 className="font-semibold">Screening configuration</h2>
            </div>

            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-600">Select JD</label>
                <select
                  value={selectedJd}
                  onChange={event => {
                    setSelectedJd(event.target.value)
                    setSelectedEntries({})
                  }}
                  className="w-full rounded-xl border border-input bg-slate-50 px-4 py-3 text-sm outline-none focus:border-brand-400"
                >
                  <option value="">Choose a JD...</option>
                  {(jdsData?.data || []).map((jd: any) => (
                    <option key={jd.id} value={jd.id}>{jd.title} - {jd.client}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Score weights</p>
                {([
                  ['skillWeight', 'Skill match'],
                  ['availabilityWeight', 'Availability'],
                  ['locationWeight', 'Location'],
                ] as const).map(([key, label]) => (
                  <div key={key}>
                    <div className="mb-1.5 flex justify-between text-sm">
                      <span className="font-medium text-slate-600">{label}</span>
                      <span className="font-bold text-brand-600">{config[key]}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={config[key]}
                      onChange={event => setConfig(current => ({ ...current, [key]: Number(event.target.value) }))}
                      className="w-full accent-brand-600"
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Min score" value={String(config.minMatchScore)} onChange={value => setConfig(current => ({ ...current, minMatchScore: Number(value) }))} />
                <Field label="Max notice days" value={String(config.maxNoticeDays)} onChange={value => setConfig(current => ({ ...current, maxNoticeDays: Number(value) }))} />
              </div>

              <Field label="Preferred locations" value={config.preferredLocations} onChange={value => setConfig(current => ({ ...current, preferredLocations: value }))} placeholder="Dubai, Abu Dhabi" />
              <Field label="Required skills override" value={config.requiredSkills} onChange={value => setConfig(current => ({ ...current, requiredSkills: value }))} placeholder="AWS, Spark, React" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Stat label="Linked" value={entries.length || '-'} />
            <Stat label="Analyzed" value={analyzedCount || '-'} />
            <Stat label="Avg score" value={averageScore ?? '-'} />
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Candidate comparison</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedJdData ? selectedJdData.title : 'Select a JD to load linked candidates'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-11 w-64 items-center gap-2 rounded-xl border border-border bg-slate-50 px-3">
                  <Search size={16} className="text-slate-400" />
                  <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search candidates..." className="flex-1 bg-transparent text-sm outline-none" />
                </div>
                <select value={recommendationFilter} onChange={event => setRecommendationFilter(event.target.value)} className="h-11 rounded-xl border border-border bg-slate-50 px-3 text-sm outline-none">
                  <option value="">All recommendations</option>
                  <option value="SHORTLIST">Shortlist</option>
                  <option value="REVIEW">Review</option>
                  <option value="REJECT">Reject</option>
                </select>
                <div className="flex h-11 items-center gap-2 rounded-xl border border-border bg-slate-50 px-3 text-sm">
                  <Filter size={15} className="text-slate-400" />
                  <span className="text-slate-500">Min</span>
                  <input type="number" min={0} max={100} value={minScore} onChange={event => setMinScore(Number(event.target.value))} className="w-12 bg-transparent outline-none" />
                </div>
              </div>
            </div>
          </div>

          {!selectedJd && (
            <EmptyState icon={<Bot size={38} />} text="Select a JD to load linked candidates from resumes." />
          )}

          {selectedJd && isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-44 animate-pulse rounded-2xl bg-muted" />)}
            </div>
          )}

          {selectedJd && !isLoading && rankedEntries.length === 0 && (
            <EmptyState icon={<SlidersHorizontal size={38} />} text="No linked candidates match the current filters." />
          )}

          <div className="space-y-4">
            {rankedEntries.map((entry: any, index: number) => {
              const candidate = entry.candidate
              const analysis = entry.analysis as ScreeningAnalysis
              const flags = candidate.redFlags || []
              const flagCounts = flagSummary(flags)
              const candidateScore = entry.score
              const selected = Boolean(selectedEntries[entry.id])

              return (
                <div key={entry.id} className={cn('rounded-2xl border bg-card p-5 shadow-sm transition-colors', selected ? 'border-brand-300 ring-2 ring-brand-100' : 'border-border')}>
                  <div className="flex flex-wrap items-start gap-5">
                    <label className="mt-2 flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={event => setSelectedEntries(current => ({ ...current, [entry.id]: event.target.checked }))}
                        className="h-4 w-4 accent-brand-600"
                      />
                      <span className="text-sm font-bold text-slate-400">#{index + 1}</span>
                    </label>

                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">
                      {initials(candidate.fullName)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/candidates/${candidate.id}`} className="text-lg font-bold text-slate-950 hover:text-brand-600">{candidate.fullName}</Link>
                        {candidate.isInternal && <span className="rounded-md bg-violet-100 px-2 py-1 text-[10px] font-bold uppercase text-violet-700">Internal</span>}
                        {analysis.recommendation && (
                          <span className={cn(
                            'rounded-md px-2 py-1 text-[10px] font-bold uppercase',
                            analysis.recommendation === 'SHORTLIST' ? 'bg-emerald-50 text-emerald-700' :
                              analysis.recommendation === 'REJECT' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700',
                          )}>
                            {analysis.recommendation}
                          </span>
                        )}
                        <span className={cn('rounded-md px-2 py-1 text-[10px] font-bold uppercase', stageColor(entry.stage))}>{stageLabel(entry.stage)}</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">{candidate.currentTitle || 'No title'} - {candidate.location || 'Location unknown'}</p>
                      <p className="mt-3 text-sm leading-6 text-slate-600">{analysis.summary || 'Run AI screening to generate a candidate assessment.'}</p>
                    </div>

                    <div className="text-right">
                      {candidateScore !== null ? (
                        <div className={cn('rounded-2xl px-5 py-3 text-center', scoreColor(candidateScore))}>
                          <div className="text-3xl font-bold">{candidateScore}</div>
                          <div className="text-xs font-semibold">/100</div>
                        </div>
                      ) : (
                        <div className="rounded-2xl bg-slate-50 px-5 py-4 text-sm text-slate-400">Not analyzed</div>
                      )}
                    </div>
                  </div>

                  {analysis.criteriaScores?.length ? (
                    <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-5">
                      {analysis.criteriaScores.map(item => (
                        <div key={item.label} className="rounded-xl border border-border bg-slate-50/70 p-3">
                          <div className="mb-2 flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-600">{item.label}</span>
                            <span className="font-bold text-slate-900">{item.score}</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${item.score}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
                    <Insight title="Justification" items={analysis.justification ? [analysis.justification] : []} empty="No justification yet." />
                    <Insight title="Strengths" items={analysis.strengths || []} empty="No strengths listed." positive />
                    <Insight title="Weaknesses" items={[...(analysis.weaknesses || []), ...(analysis.missingSkills || []).map(skill => `Missing: ${skill}`)]} empty="No weaknesses listed." />
                  </div>

                  {flags.length > 0 && (
                    <div className="mt-5 rounded-xl border border-red-100 bg-red-50 p-4">
                      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-red-700">
                        <AlertTriangle size={16} /> {flagCounts.total} flag(s), {flagCounts.critical} critical, {flagCounts.warning} warning
                      </div>
                      <div className="grid gap-2 md:grid-cols-2">
                        {flags.map((flag: any) => (
                          <div key={flag.id} className="rounded-lg bg-white/70 px-3 py-2 text-sm text-red-700">
                            <span className="font-semibold">{String(flag.flagType).replace(/_/g, ' ')}: </span>{flag.description}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-500">{label}</label>
      <input
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-input bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-brand-400"
      />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-bold text-slate-950">{value}</div>
    </div>
  )
}

function EmptyState({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card py-16 text-center text-slate-500 shadow-sm">
      <div className="mx-auto mb-3 flex justify-center opacity-30">{icon}</div>
      <p className="text-sm">{text}</p>
    </div>
  )
}

function Insight({ title, items, empty, positive }: { title: string; items: string[]; empty: string; positive?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-slate-50/70 p-4">
      <div className="mb-2 text-sm font-bold text-slate-800">{title}</div>
      {items.length ? (
        <ul className="space-y-1.5 text-sm text-slate-600">
          {items.map(item => (
            <li key={item} className="flex gap-2">
              <span className={cn('mt-2 h-1.5 w-1.5 shrink-0 rounded-full', positive ? 'bg-emerald-500' : 'bg-amber-500')} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-400">{empty}</p>
      )}
    </div>
  )
}
