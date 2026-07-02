'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { cn, stageLabel, stageColor, scoreColor, initials } from '@/lib/utils'
import Link from 'next/link'
import { GitMerge } from 'lucide-react'

const STAGES = [
  'NEW', 'SCREENED', 'SCREENING_CALL', 'INTERVIEW_SCHEDULED',
  'INTERVIEWING', 'INTERNAL_APPROVED', 'SUBMITTED_TO_CLIENT',
  'CLIENT_APPROVED', 'ONBOARDING',
]

export default function PipelinePage() {
  const [jdId, setJdId] = useState('')
  const [view, setView] = useState<'kanban' | 'list'>('list')

  const { data: jdsData } = useQuery({
    queryKey: ['jds-pipeline'],
    queryFn: async () => {
      const r = await fetch('/api/jds?pageSize=50')
      return r.json()
    },
  })

  const { data, isLoading } = useQuery({
    queryKey: ['candidates-pipeline', jdId],
    queryFn: async () => {
      const p = new URLSearchParams({ pageSize: '200', ...(jdId && { jdId }) })
      const r = await fetch(`/api/candidates?${p}`)
      return r.json()
    },
  })

  const jds = jdsData?.data || []
  const candidates = data?.data || []

  const byStage = (stage: string) =>
    candidates.filter((c: any) =>
      c.pipelineEntries?.some((pe: any) => pe.stage === stage && (!jdId || pe.jdId === jdId))
    )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{candidates.length} candidates in pipeline</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={jdId} onChange={e => setJdId(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-background">
            <option value="">All JDs</option>
            {jds.map((jd: any) => <option key={jd.id} value={jd.id}>{jd.title}</option>)}
          </select>
          <div className="flex border border-border rounded-lg overflow-hidden">
            {(['list', 'kanban'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={cn('px-3 py-2 text-sm capitalize', view === v ? 'bg-brand-600 text-white' : 'hover:bg-accent text-muted-foreground')}>
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === 'kanban' ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.map(stage => {
            const items = byStage(stage)
            return (
              <div key={stage} className="flex-shrink-0 w-64">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{stageLabel(stage)}</span>
                  <span className="text-xs bg-muted px-1.5 py-0.5 rounded-full">{items.length}</span>
                </div>
                <div className="space-y-2 min-h-24">
                  {items.map((c: any) => {
                    const entry = c.pipelineEntries?.find((pe: any) => pe.stage === stage)
                    return (
                      <Link href={`/candidates/${c.id}`} key={c.id}
                        className="block bg-card border border-border rounded-lg p-3 hover:border-brand-300 hover:shadow-sm transition-all">
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold',
                            c.isInternal ? 'bg-pink-100 text-pink-700' : 'bg-brand-100 text-brand-700')}>
                            {initials(c.fullName)}
                          </div>
                          <span className="text-sm font-medium truncate">{c.fullName}</span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{c.currentTitle || 'No title'}</div>
                        {entry?.compositeScore && (
                          <div className={cn('text-xs font-semibold mt-1.5 w-fit px-1.5 py-0.5 rounded', scoreColor(Number(entry.compositeScore)))}>
                            {Math.round(Number(entry.compositeScore))}
                          </div>
                        )}
                      </Link>
                    )
                  })}
                  {items.length === 0 && (
                    <div className="h-16 border-2 border-dashed border-border rounded-lg flex items-center justify-center text-xs text-muted-foreground">
                      Empty
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Candidate</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">JD</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Stage</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Score</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Shortlisted</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-border animate-pulse">
                  {Array.from({ length: 5 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded" /></td>)}
                </tr>
              ))}
              {candidates.length === 0 && !isLoading && (
                <tr><td colSpan={5} className="py-12 text-center text-muted-foreground">No candidates in pipeline</td></tr>
              )}
              {candidates.flatMap((c: any) =>
                (c.pipelineEntries || [])
                  .filter((pe: any) => !jdId || pe.jdId === jdId)
                  .map((pe: any) => (
                    <tr key={`${c.id}-${pe.id}`} className="border-b border-border hover:bg-muted/20 last:border-0">
                      <td className="px-4 py-3">
                        <Link href={`/candidates/${c.id}`} className="flex items-center gap-2.5">
                          <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold',
                            c.isInternal ? 'bg-pink-100 text-pink-700' : 'bg-brand-100 text-brand-700')}>
                            {initials(c.fullName)}
                          </div>
                          <div>
                            <div className="font-medium">{c.fullName}</div>
                            <div className="text-xs text-muted-foreground">{c.currentTitle || '—'}</div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm">{pe.jd?.title || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', stageColor(pe.stage))}>
                          {stageLabel(pe.stage)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {pe.compositeScore ? (
                          <span className={cn('px-2 py-0.5 rounded text-xs font-semibold', scoreColor(Number(pe.compositeScore)))}>
                            {Math.round(Number(pe.compositeScore))}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs', pe.isShortlisted ? 'text-green-600' : 'text-muted-foreground')}>
                          {pe.isShortlisted ? '✓ Yes' : 'No'}
                        </span>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
