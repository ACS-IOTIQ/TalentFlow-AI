'use client'
import { useQuery } from '@tanstack/react-query'
import { ClipboardCheck, CheckCircle, Clock } from 'lucide-react'
import { cn, formatDate, initials } from '@/lib/utils'

export default function OnboardingPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['onboarding'],
    queryFn: async () => {
      const r = await fetch('/api/candidates?pageSize=50')
      return r.json()
    },
  })

  const candidates = (data?.data || []).filter((c: any) =>
    c.pipelineEntries?.some((pe: any) =>
      ['CLIENT_APPROVED', 'ONBOARDING', 'ONBOARDED'].includes(pe.stage)
    )
  )

  const DEFAULT_CHECKLIST = [
    { category: 'Documents', items: ['Offer letter signed', 'Visa application submitted', 'ID copy received', 'Contract signed'] },
    { category: 'Access', items: ['Email account created', 'System access granted', 'Badge / access card issued'] },
    { category: 'Induction', items: ['Orientation scheduled', 'Manager intro done', 'Team intro done'] },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Onboarding</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{candidates.length} active onboardings</p>
      </div>

      {!isLoading && candidates.length === 0 && (
        <div className="bg-card border border-border rounded-xl py-16 text-center text-muted-foreground">
          <ClipboardCheck size={40} className="mx-auto mb-3 opacity-30" />
          <p>No candidates in onboarding yet</p>
          <p className="text-xs mt-1">Candidates appear here once Tahaluf approves them</p>
        </div>
      )}

      <div className="grid gap-5">
        {isLoading && Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-48 bg-muted rounded-xl animate-pulse" />
        ))}
        {candidates.map((c: any) => {
          const entry = c.pipelineEntries?.find((pe: any) =>
            ['CLIENT_APPROVED', 'ONBOARDING', 'ONBOARDED'].includes(pe.stage)
          )
          return (
            <div key={c.id} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-4 p-5 border-b border-border">
                <div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold',
                  c.isInternal ? 'bg-pink-100 text-pink-700' : 'bg-brand-100 text-brand-700')}>
                  {initials(c.fullName)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{c.fullName}</span>
                    {c.isInternal && <span className="text-xs px-1.5 py-0.5 bg-pink-100 text-pink-700 rounded">Internal</span>}
                  </div>
                  <div className="text-sm text-muted-foreground">{c.currentTitle} → {entry?.jd?.title}</div>
                </div>
                <div className="text-right">
                  <span className={cn('px-2.5 py-1 rounded-full text-xs font-medium',
                    entry?.stage === 'ONBOARDED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700')}>
                    {entry?.stage?.replace('_', ' ')}
                  </span>
                </div>
              </div>

              <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {DEFAULT_CHECKLIST.map(section => (
                    <div key={section.category}>
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                        {section.category}
                      </div>
                      <div className="space-y-1.5">
                        {section.items.map(item => (
                          <div key={item} className="flex items-center gap-2 text-sm">
                            <div className="w-4 h-4 rounded border-2 border-muted-foreground/30 flex-shrink-0" />
                            <span className="text-muted-foreground">{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
