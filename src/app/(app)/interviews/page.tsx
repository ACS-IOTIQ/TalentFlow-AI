'use client'
import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Briefcase,
  CalendarDays,
  CheckCircle,
  ClipboardCheck,
  Clock,
  Loader2,
  Mail,
  MapPin,
  Plus,
  Search,
  User,
  Video,
  X,
} from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { cn, formatDateTime, initials } from '@/lib/utils'

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: 'bg-blue-50 text-blue-700 border-blue-100',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  CANCELLED: 'bg-red-50 text-red-700 border-red-100',
  NO_SHOW: 'bg-slate-100 text-slate-600 border-slate-200',
}

function toLocalDateInput(date = new Date()) {
  return date.toISOString().slice(0, 10)
}

function toIsoFromLocal(date: string, time: string) {
  return new Date(`${date}T${time}`).toISOString()
}

function ScheduleModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    pipelineEntryId: '',
    roundNumber: 1,
    roundName: 'Round 1',
    date: toLocalDateInput(),
    time: '10:00',
    durationMinutes: 60,
    location: '',
    videoLink: '',
    interviewerName: '',
    interviewerEmail: '',
  })

  const { data, isLoading } = useQuery({
    queryKey: ['interview-options'],
    queryFn: async () => {
      const response = await fetch('/api/interviews?options=true')
      return response.json()
    },
  })

  const entries = data?.data?.entries || []
  const selectedEntry = entries.find((entry: any) => entry.id === form.pipelineEntryId)
  const roundOptions = useMemo(
    () => selectedEntry?.jd?.interviewRounds?.length
      ? selectedEntry.jd.interviewRounds
      : [1, 2, 3].map(roundNumber => ({ id: String(roundNumber), roundNumber, roundName: `Round ${roundNumber}`, durationMinutes: 60 })),
    [selectedEntry?.jd?.interviewRounds],
  )

  useEffect(() => {
    const firstRound = roundOptions[0]
    if (!firstRound) return
    setForm(current => ({
      ...current,
      roundNumber: Number(firstRound.roundNumber),
      roundName: firstRound.roundName || `Round ${firstRound.roundNumber}`,
      durationMinutes: Number(firstRound.durationMinutes || current.durationMinutes),
    }))
  }, [form.pipelineEntryId, roundOptions])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.pipelineEntryId) {
      toast.error('Select a candidate and JD')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/interviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pipelineEntryId: form.pipelineEntryId,
          roundNumber: Number(form.roundNumber),
          roundName: form.roundName,
          scheduledAt: toIsoFromLocal(form.date, form.time),
          durationMinutes: Number(form.durationMinutes),
          location: form.location,
          videoLink: form.videoLink,
          interviewerName: form.interviewerName,
          interviewerEmail: form.interviewerEmail,
        }),
      })
      const result = await response.json()
      if (!result.success) {
        toast.error(result.error || 'Unable to schedule interview')
        return
      }

      toast.success('Interview scheduled')
      qc.invalidateQueries({ queryKey: ['interviews'] })
      qc.invalidateQueries({ queryKey: ['interview-options'] })
      onClose()
    } catch {
      toast.error('Unable to schedule interview')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[1px]">
      <div className="w-full max-w-[780px] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Schedule interview</h2>
            <p className="mt-1 text-sm text-slate-500">Choose the candidate, round, calendar date, and time.</p>
          </div>
          <button onClick={onClose} disabled={saving} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-5 p-6">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-600">Candidate and JD</span>
            <select
              required
              value={form.pipelineEntryId}
              onChange={event => setForm(current => ({ ...current, pipelineEntryId: event.target.value }))}
              className="h-12 w-full rounded-xl border border-input bg-slate-50 px-4 text-sm outline-none focus:border-brand-400"
            >
              <option value="">Select linked candidate...</option>
              {entries.map((entry: any) => (
                <option key={entry.id} value={entry.id}>
                  {entry.candidate?.fullName} - {entry.jd?.title} ({entry.jd?.client})
                </option>
              ))}
            </select>
          </label>

          {isLoading && (
            <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
              <Loader2 size={15} className="animate-spin" /> Loading schedulable candidates...
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-600">Round number</span>
              <select
                value={form.roundNumber}
                onChange={event => {
                  const roundNumber = Number(event.target.value)
                  const round = roundOptions.find((item: any) => Number(item.roundNumber) === roundNumber)
                  setForm(current => ({
                    ...current,
                    roundNumber,
                    roundName: round?.roundName || `Round ${roundNumber}`,
                    durationMinutes: Number(round?.durationMinutes || current.durationMinutes),
                  }))
                }}
                className="h-12 w-full rounded-xl border border-input bg-slate-50 px-4 text-sm outline-none focus:border-brand-400"
              >
                {roundOptions.map((round: any) => (
                  <option key={`${round.roundNumber}-${round.roundName}`} value={round.roundNumber}>
                    {round.roundName || `Round ${round.roundNumber}`}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-600">Round name</span>
              <input
                required
                value={form.roundName}
                onChange={event => setForm(current => ({ ...current, roundName: event.target.value }))}
                placeholder="Technical interview"
                className="h-12 w-full rounded-xl border border-input bg-slate-50 px-4 text-sm outline-none focus:border-brand-400"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-600">Calendar date</span>
              <input
                required
                type="date"
                value={form.date}
                onChange={event => setForm(current => ({ ...current, date: event.target.value }))}
                className="h-12 w-full rounded-xl border border-input bg-slate-50 px-4 text-sm outline-none focus:border-brand-400"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-600">Time</span>
              <input
                required
                type="time"
                value={form.time}
                onChange={event => setForm(current => ({ ...current, time: event.target.value }))}
                className="h-12 w-full rounded-xl border border-input bg-slate-50 px-4 text-sm outline-none focus:border-brand-400"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-600">Duration</span>
              <select
                value={form.durationMinutes}
                onChange={event => setForm(current => ({ ...current, durationMinutes: Number(event.target.value) }))}
                className="h-12 w-full rounded-xl border border-input bg-slate-50 px-4 text-sm outline-none focus:border-brand-400"
              >
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>60 minutes</option>
                <option value={90}>90 minutes</option>
                <option value={120}>2 hours</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-600">Location</span>
              <input
                value={form.location}
                onChange={event => setForm(current => ({ ...current, location: event.target.value }))}
                placeholder="Office / Online"
                className="h-12 w-full rounded-xl border border-input bg-slate-50 px-4 text-sm outline-none focus:border-brand-400"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-600">Video link</span>
              <input
                value={form.videoLink}
                onChange={event => setForm(current => ({ ...current, videoLink: event.target.value }))}
                placeholder="https://..."
                className="h-12 w-full rounded-xl border border-input bg-slate-50 px-4 text-sm outline-none focus:border-brand-400"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-600">Interviewer name</span>
              <input
                required
                value={form.interviewerName}
                onChange={event => setForm(current => ({ ...current, interviewerName: event.target.value }))}
                placeholder="Who will take this interview?"
                className="h-12 w-full rounded-xl border border-input bg-slate-50 px-4 text-sm outline-none focus:border-brand-400"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-600">Interviewer email</span>
              <input
                required
                type="email"
                value={form.interviewerEmail}
                onChange={event => setForm(current => ({ ...current, interviewerEmail: event.target.value }))}
                placeholder="interviewer@company.com"
                className="h-12 w-full rounded-xl border border-input bg-slate-50 px-4 text-sm outline-none focus:border-brand-400"
              />
            </label>
          </div>

          {selectedEntry && (
            <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-slate-50 p-4 text-sm md:grid-cols-3">
              <Info label="Candidate" value={selectedEntry.candidate?.fullName} icon={<User size={14} />} />
              <Info label="JD" value={selectedEntry.jd?.title} icon={<Briefcase size={14} />} />
              <Info label="Last interview" value={selectedEntry.interviews?.[0] ? formatDateTime(selectedEntry.interviews[0].scheduledAt) : 'None'} icon={<CalendarDays size={14} />} />
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-border pt-5">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-border px-5 py-3 text-sm font-medium hover:bg-accent disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Schedule interview
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Info({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-400">{icon}</span>
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase text-slate-400">{label}</div>
        <div className="truncate font-medium text-slate-700">{value}</div>
      </div>
    </div>
  )
}

export default function InterviewsPage() {
  const searchParams = useSearchParams()
  const [showModal, setShowModal] = useState(false)
  const [assessmentInterview, setAssessmentInterview] = useState<any | null>(null)
  const [status, setStatus] = useState('')
  const [view, setView] = useState<'upcoming' | 'all'>('upcoming')
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['interviews', status, view],
    queryFn: async () => {
      const now = new Date()
      const params = new URLSearchParams({
        pageSize: '100',
        ...(status && { status }),
        ...(view === 'upcoming' && { from: now.toISOString() }),
      })
      const response = await fetch(`/api/interviews?${params}`)
      return response.json()
    },
  })

  const interviews = useMemo(() => data?.data || [], [data?.data])
  const filteredInterviews = useMemo(() => {
    return interviews.filter((interview: any) => {
      const candidate = interview.pipelineEntry?.candidate?.fullName || ''
      const jd = interview.pipelineEntry?.jd?.title || ''
      const client = interview.pipelineEntry?.jd?.client || ''
      return !search || [candidate, jd, client].some(value => String(value).toLowerCase().includes(search.toLowerCase()))
    })
  }, [interviews, search])

  const today = interviews.filter((interview: any) => new Date(interview.scheduledAt).toDateString() === new Date().toDateString())
  const completed = interviews.filter((interview: any) => interview.status === 'COMPLETED').length

  useEffect(() => {
    const assessmentId = searchParams.get('assessment')
    if (!assessmentId || !interviews.length || assessmentInterview) return
    const interview = interviews.find((item: any) => item.id === assessmentId)
    if (interview) setAssessmentInterview(interview)
  }, [assessmentInterview, interviews, searchParams])

  return (
    <div className="mx-auto max-w-[1408px] space-y-6 px-2 py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">Interviews</h1>
          <p className="mt-2 text-base text-slate-500">Schedule rounds, track meetings, and jump into video interviews.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-700">
          <Plus size={16} /> Schedule interview
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Metric label="Scheduled" value={interviews.length} icon={<CalendarDays size={18} />} />
        <Metric label="Today" value={today.length} icon={<Clock size={18} />} />
        <Metric label="Completed" value={completed} icon={<CheckCircle size={18} />} />
      </div>

      {today.length > 0 && (
        <div className="rounded-2xl border border-brand-200 bg-brand-50 p-5">
          <div className="mb-4 flex items-center gap-2 font-semibold text-brand-800">
            <CalendarDays size={17} /> Today's interviews
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {today.map((interview: any) => <InterviewCard key={interview.id} interview={interview} compact onAssess={setAssessmentInterview} />)}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex overflow-hidden rounded-xl border border-border">
            <button onClick={() => setView('upcoming')} className={cn('px-4 py-2.5 text-sm font-semibold', view === 'upcoming' ? 'bg-brand-600 text-white' : 'text-slate-500 hover:bg-accent')}>
              Upcoming
            </button>
            <button onClick={() => setView('all')} className={cn('px-4 py-2.5 text-sm font-semibold', view === 'all' ? 'bg-brand-600 text-white' : 'text-slate-500 hover:bg-accent')}>
              All interviews
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-11 w-72 items-center gap-2 rounded-xl border border-border bg-slate-50 px-3">
              <Search size={16} className="text-slate-400" />
              <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search candidate or JD..." className="flex-1 bg-transparent text-sm outline-none" />
            </div>
            <select value={status} onChange={event => setStatus(event.target.value)} className="h-11 rounded-xl border border-border bg-slate-50 px-3 text-sm outline-none">
              <option value="">All statuses</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="NO_SHOW">No show</option>
            </select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-44 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : filteredInterviews.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-20 text-center text-slate-500 shadow-sm">
          <CalendarDays size={44} className="mx-auto mb-4 opacity-30" />
          <p className="font-medium">No interviews found</p>
          <p className="mt-1 text-sm">Schedule an interview from a linked candidate and JD.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {filteredInterviews.map((interview: any) => <InterviewCard key={interview.id} interview={interview} onAssess={setAssessmentInterview} />)}
        </div>
      )}

      {showModal && <ScheduleModal onClose={() => setShowModal(false)} />}
      {assessmentInterview && <AssessmentModal interview={assessmentInterview} onClose={() => setAssessmentInterview(null)} />}
    </div>
  )
}

function Metric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</div>
          <div className="mt-2 text-3xl font-bold text-slate-950">{value}</div>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">{icon}</div>
      </div>
    </div>
  )
}

function InterviewCard({ interview, compact = false, onAssess }: { interview: any; compact?: boolean; onAssess: (interview: any) => void }) {
  const candidate = interview.pipelineEntry?.candidate
  const jd = interview.pipelineEntry?.jd
  const scheduledAt = new Date(interview.scheduledAt)
  const roundLabel = interview.roundTemplate?.roundName || `Round ${interview.roundNumber}`

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-brand-200 hover:bg-slate-50/50">
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border border-brand-100 bg-brand-50">
          <div className="text-lg font-bold leading-none text-brand-700">{scheduledAt.getDate()}</div>
          <div className="text-xs font-semibold uppercase text-brand-500">{scheduledAt.toLocaleString('en', { month: 'short' })}</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
              {initials(candidate?.fullName || '??')}
            </div>
            <span className="font-semibold text-slate-950">{candidate?.fullName || 'Unknown candidate'}</span>
            <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase', STATUS_COLORS[interview.status] || STATUS_COLORS.SCHEDULED)}>
              {interview.status}
            </span>
          </div>

          <div className="mt-2 text-sm font-medium text-slate-700">{jd?.title || 'Unknown JD'}</div>
          <div className="text-sm text-slate-500">{jd?.client || 'Client'} - {roundLabel} - {interview.durationMinutes} min</div>
          {(interview.interviewerName || interview.interviewerEmail) && (
            <div className="mt-2 inline-flex max-w-full items-center gap-2 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
              <Mail size={13} />
              <span className="truncate">
                {interview.interviewerName || 'Interviewer'}{interview.interviewerEmail ? ` - ${interview.interviewerEmail}` : ''}
              </span>
            </div>
          )}

          {!compact && (
            <div className="mt-4 grid grid-cols-1 gap-2 text-sm text-slate-500 sm:grid-cols-2">
              <span className="inline-flex items-center gap-2"><Clock size={14} /> {formatDateTime(interview.scheduledAt)}</span>
              {interview.location && <span className="inline-flex items-center gap-2"><MapPin size={14} /> {interview.location}</span>}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          {interview.videoLink && (
            <a href={interview.videoLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700">
              <Video size={14} /> Join
            </a>
          )}
          <button onClick={() => onAssess(interview)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-accent">
            <ClipboardCheck size={14} /> Assess
          </button>
        </div>
      </div>
    </div>
  )
}

function AssessmentModal({ interview, onClose }: { interview: any; onClose: () => void }) {
  const qc = useQueryClient()
  const existing = interview.feedback?.[0]
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    technicalScore: existing?.technicalScore ? String(existing.technicalScore) : '',
    communicationScore: existing?.communicationScore ? String(existing.communicationScore) : '',
    cultureFitScore: existing?.cultureFitScore ? String(existing.cultureFitScore) : '',
    overallScore: existing?.overallScore ? String(existing.overallScore) : '',
    recommendation: existing?.recommendation || 'yes',
    strengths: existing?.strengths || '',
    concerns: existing?.concerns || '',
    notes: existing?.notes || '',
  })
  const candidate = interview.pipelineEntry?.candidate
  const jd = interview.pipelineEntry?.jd
  const roundLabel = interview.roundTemplate?.roundName || `Round ${interview.roundNumber}`

  const set = (key: string, value: string) => setForm(current => ({ ...current, [key]: value }))

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      const response = await fetch('/api/interviews?action=feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interviewId: interview.id,
          technicalScore: form.technicalScore ? Number(form.technicalScore) : undefined,
          communicationScore: form.communicationScore ? Number(form.communicationScore) : undefined,
          cultureFitScore: form.cultureFitScore ? Number(form.cultureFitScore) : undefined,
          overallScore: form.overallScore ? Number(form.overallScore) : undefined,
          recommendation: form.recommendation,
          strengths: form.strengths,
          concerns: form.concerns,
          notes: form.notes,
        }),
      })
      const result = await response.json()
      if (!result.success) {
        toast.error(result.error || 'Unable to submit assessment')
        return
      }
      toast.success('Candidate assessment saved')
      qc.invalidateQueries({ queryKey: ['interviews'] })
      onClose()
    } catch {
      toast.error('Unable to submit assessment')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[1px]">
      <div className="w-full max-w-[840px] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Candidate assessment</h2>
            <p className="mt-1 text-sm text-slate-500">{candidate?.fullName || 'Candidate'} - {jd?.title || 'Interview'} - {roundLabel}</p>
          </div>
          <button onClick={onClose} disabled={saving} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="max-h-[75vh] space-y-5 overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {[
              ['technicalScore', 'Technical'],
              ['communicationScore', 'Communication'],
              ['cultureFitScore', 'Culture fit'],
              ['overallScore', 'Overall'],
            ].map(([key, label]) => (
              <label key={key} className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-600">{label}</span>
                <select value={(form as any)[key]} onChange={event => set(key, event.target.value)} className="h-12 w-full rounded-xl border border-input bg-slate-50 px-3 text-sm outline-none focus:border-brand-400">
                  <option value="">Select</option>
                  {Array.from({ length: 10 }).map((_, index) => (
                    <option key={index + 1} value={index + 1}>{index + 1}/10</option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-600">Recommendation</span>
            <select value={form.recommendation} onChange={event => set('recommendation', event.target.value)} className="h-12 w-full rounded-xl border border-input bg-slate-50 px-4 text-sm outline-none focus:border-brand-400">
              <option value="strong_yes">Strong yes</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
              <option value="strong_no">Strong no</option>
            </select>
          </label>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextArea label="Strengths" value={form.strengths} onChange={value => set('strengths', value)} placeholder="What went well?" />
            <TextArea label="Concerns" value={form.concerns} onChange={value => set('concerns', value)} placeholder="Risks, gaps, or follow-ups" />
          </div>

          <TextArea label="Detailed notes" value={form.notes} onChange={value => set('notes', value)} placeholder="Interview observations, evidence, and hiring recommendation rationale" rows={5} />

          <div className="flex justify-end gap-3 border-t border-border pt-5">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-border px-5 py-3 text-sm font-medium hover:bg-accent disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              Submit assessment
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function TextArea({ label, value, onChange, placeholder, rows = 4 }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; rows?: number }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-600">{label}</span>
      <textarea
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full resize-none rounded-xl border border-input bg-slate-50 px-4 py-3 text-sm outline-none focus:border-brand-400"
      />
    </label>
  )
}
