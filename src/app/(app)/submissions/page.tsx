'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  CheckCircle,
  Clock,
  Edit3,
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  Search,
  Send,
  Trash2,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react'
import { cn, formatDate, initials, stageColor, stageLabel } from '@/lib/utils'

const STATUS_OPTIONS = [
  ['', 'All'],
  ['SUBMITTED', 'Submitted'],
  ['UNDER_REVIEW', 'Under review'],
  ['APPROVED', 'Approved'],
  ['REJECTED', 'Rejected'],
]

const STATUS_STYLE: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  SUBMITTED: { color: 'bg-blue-50 text-blue-700 border-blue-100', icon: Send, label: 'Submitted' },
  UNDER_REVIEW: { color: 'bg-amber-50 text-amber-700 border-amber-100', icon: Clock, label: 'Under review' },
  APPROVED: { color: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: CheckCircle, label: 'Approved' },
  REJECTED: { color: 'bg-red-50 text-red-700 border-red-100', icon: XCircle, label: 'Rejected' },
}

function emptyForm() {
  return {
    pipelineEntryId: '',
    clientContact: '',
    clientNotes: '',
    profilePdfKey: '',
    status: 'SUBMITTED',
    rejectionReason: '',
  }
}

function formFromSubmission(submission: any) {
  return {
    pipelineEntryId: submission.pipelineEntryId || '',
    clientContact: submission.clientContact || '',
    clientNotes: submission.clientNotes || '',
    profilePdfKey: submission.profilePdfKey || '',
    status: submission.status || 'SUBMITTED',
    rejectionReason: submission.rejectionReason || '',
  }
}

function countFor(counts: any[], status: string) {
  return counts.find(item => item.status === status)?._count?.status || 0
}

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLE[status] || STATUS_STYLE.SUBMITTED
  const Icon = style.icon
  return (
    <span className={cn('inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold', style.color)}>
      <Icon size={13} /> {style.label}
    </span>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-2 block text-sm font-semibold text-slate-600">{children}</span>
}

function SubmissionModal({
  submission,
  initialStatus,
  onClose,
}: {
  submission?: any
  initialStatus?: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const editing = Boolean(submission)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(() => ({
    ...(editing ? formFromSubmission(submission) : emptyForm()),
    ...(initialStatus && { status: initialStatus }),
  }))

  const { data, isLoading } = useQuery({
    queryKey: ['submissions-options'],
    enabled: !editing,
    queryFn: async () => {
      const response = await fetch('/api/submissions?options=true')
      return response.json()
    },
  })

  const options = data?.data?.entries || []
  const setField = (field: keyof typeof form, value: string) => setForm(current => ({ ...current, [field]: value }))

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editing && !form.pipelineEntryId) {
      toast.error('Select a candidate and JD')
      return
    }
    if (form.status === 'REJECTED' && !form.rejectionReason.trim()) {
      toast.error('Rejection reason is required')
      return
    }

    setSaving(true)
    try {
      const response = await fetch(editing ? `/api/submissions/${submission.id}` : '/api/submissions', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(!editing && { pipelineEntryId: form.pipelineEntryId }),
          ...(editing && { status: form.status }),
          clientContact: form.clientContact,
          clientNotes: form.clientNotes,
          profilePdfKey: form.profilePdfKey,
          rejectionReason: form.rejectionReason,
        }),
      })
      const result = await response.json()
      if (!result.success) {
        toast.error(result.error || 'Unable to save submission')
        return
      }

      toast.success(editing ? 'Submission updated' : 'Submitted to Tahaluf')
      qc.invalidateQueries({ queryKey: ['submissions'] })
      qc.invalidateQueries({ queryKey: ['submissions-options'] })
      onClose()
    } catch {
      toast.error('Unable to save submission')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[1px]">
      <div className="max-h-[92vh] w-full max-w-[780px] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">{editing ? 'Edit submission' : 'New submission'}</h2>
            <p className="mt-1 text-sm text-slate-500">Manage Tahaluf contact details, notes, and client response.</p>
          </div>
          <button onClick={onClose} disabled={saving} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="max-h-[calc(92vh-90px)] space-y-5 overflow-y-auto p-6">
          {!editing && (
            <label className="block">
              <FieldLabel>Candidate and JD</FieldLabel>
              <select
                required
                value={form.pipelineEntryId}
                onChange={event => setField('pipelineEntryId', event.target.value)}
                className="h-12 w-full rounded-xl border border-input bg-slate-50 px-4 text-sm outline-none focus:border-brand-400"
              >
                <option value="">Select approved candidate...</option>
                {options.map((entry: any) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.candidate?.fullName} - {entry.jd?.title} ({entry.jd?.client})
                  </option>
                ))}
              </select>
              {isLoading && <div className="mt-2 text-xs text-slate-500">Loading eligible candidates...</div>}
            </label>
          )}

          {editing && (
            <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-slate-50 p-4 text-sm md:grid-cols-3">
              <Info label="Candidate" value={submission.pipelineEntry?.candidate?.fullName} />
              <Info label="Role" value={submission.pipelineEntry?.jd?.title} />
              <Info label="Stage" value={stageLabel(submission.pipelineEntry?.stage || '')} />
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block">
              <FieldLabel>Tahaluf contact</FieldLabel>
              <input
                value={form.clientContact}
                onChange={event => setField('clientContact', event.target.value)}
                placeholder="Name or email"
                className="h-12 w-full rounded-xl border border-input bg-slate-50 px-4 text-sm outline-none focus:border-brand-400"
              />
            </label>

            <label className="block">
              <FieldLabel>Profile PDF key or link</FieldLabel>
              <input
                value={form.profilePdfKey}
                onChange={event => setField('profilePdfKey', event.target.value)}
                placeholder="Optional profile reference"
                className="h-12 w-full rounded-xl border border-input bg-slate-50 px-4 text-sm outline-none focus:border-brand-400"
              />
            </label>
          </div>

          {editing && (
            <label className="block">
              <FieldLabel>Status</FieldLabel>
              <select
                value={form.status}
                onChange={event => setField('status', event.target.value)}
                className="h-12 w-full rounded-xl border border-input bg-slate-50 px-4 text-sm outline-none focus:border-brand-400"
              >
                <option value="SUBMITTED">Submitted</option>
                <option value="UNDER_REVIEW">Under review</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </label>
          )}

          <label className="block">
            <FieldLabel>Client notes</FieldLabel>
            <textarea
              value={form.clientNotes}
              onChange={event => setField('clientNotes', event.target.value)}
              placeholder="Brief note to accompany or summarize the client response"
              rows={4}
              className="w-full resize-none rounded-xl border border-input bg-slate-50 px-4 py-3 text-sm outline-none focus:border-brand-400"
            />
          </label>

          {editing && form.status === 'REJECTED' && (
            <label className="block">
              <FieldLabel>Rejection reason</FieldLabel>
              <textarea
                required
                value={form.rejectionReason}
                onChange={event => setField('rejectionReason', event.target.value)}
                rows={3}
                className="w-full resize-none rounded-xl border border-input bg-slate-50 px-4 py-3 text-sm outline-none focus:border-brand-400"
              />
            </label>
          )}

          <div className="flex justify-end gap-3 border-t border-border pt-5">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-border px-5 py-3 text-sm font-medium hover:bg-accent disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {editing ? 'Save submission' : 'Submit to Tahaluf'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DeleteModal({ submission, onClose }: { submission: any; onClose: () => void }) {
  const qc = useQueryClient()
  const [deleting, setDeleting] = useState(false)

  const remove = async () => {
    setDeleting(true)
    try {
      const response = await fetch(`/api/submissions/${submission.id}`, { method: 'DELETE' })
      const result = await response.json()
      if (!result.success) {
        toast.error(result.error || 'Unable to delete submission')
        return
      }
      toast.success('Submission deleted')
      qc.invalidateQueries({ queryKey: ['submissions'] })
      onClose()
    } catch {
      toast.error('Unable to delete submission')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[1px]">
      <div className="w-full max-w-[460px] rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600">
          <Trash2 size={20} />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-slate-950">Delete submission?</h2>
        <p className="mt-2 text-sm text-slate-500">
          This removes the Tahaluf submission for {submission.pipelineEntry?.candidate?.fullName || 'this candidate'}.
          Active submissions may move the pipeline back to Internal Approved.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} disabled={deleting} className="rounded-xl border border-border px-5 py-3 text-sm font-medium hover:bg-accent disabled:opacity-50">
            Cancel
          </button>
          <button onClick={remove} disabled={deleting} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
            {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-semibold uppercase text-slate-400">{label}</div>
      <div className="truncate font-medium text-slate-700">{value || '-'}</div>
    </div>
  )
}

function Metric({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</div>
          <div className="mt-2 text-3xl font-bold text-slate-950">{value}</div>
        </div>
        <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl', tone)}>{icon}</div>
      </div>
    </div>
  )
}

export default function SubmissionsPage() {
  const qc = useQueryClient()
  const [showNew, setShowNew] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [editingInitialStatus, setEditingInitialStatus] = useState<string | undefined>()
  const [deleting, setDeleting] = useState<any | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [actingId, setActingId] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['submissions', statusFilter, search, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '50',
        ...(statusFilter && { status: statusFilter }),
        ...(search.trim() && { search: search.trim() }),
      })
      const response = await fetch(`/api/submissions?${params}`)
      return response.json()
    },
  })

  const submissions = data?.data || []
  const pagination = data?.pagination || { total: 0, page: 1, totalPages: 1 }
  const metrics = useMemo(() => {
    const counts = data?.counts || []
    const submitted = countFor(counts, 'SUBMITTED')
    const underReview = countFor(counts, 'UNDER_REVIEW')
    const approved = countFor(counts, 'APPROVED')
    const rejected = countFor(counts, 'REJECTED')
    return {
      submitted,
      underReview,
      approved,
      rejected,
      total: submitted + underReview + approved + rejected,
      awaiting: submitted + underReview,
    }
  }, [data?.counts])

  const openEdit = (submission: any, initialStatus?: string) => {
    setEditing(submission)
    setEditingInitialStatus(initialStatus)
  }

  const closeEdit = () => {
    setEditing(null)
    setEditingInitialStatus(undefined)
  }

  const quickAction = async (submission: any, body: Record<string, string>, successMessage: string) => {
    setActingId(`${submission.id}:${JSON.stringify(body)}`)
    try {
      const response = await fetch(`/api/submissions/${submission.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = await response.json()
      if (!result.success) {
        toast.error(result.error || 'Unable to update submission')
        return
      }
      toast.success(successMessage)
      qc.invalidateQueries({ queryKey: ['submissions'] })
    } catch {
      toast.error('Unable to update submission')
    } finally {
      setActingId('')
    }
  }

  return (
    <div className="mx-auto max-w-[1408px] space-y-6 px-2 py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">Submissions to Tahaluf</h1>
          <p className="mt-2 text-base text-slate-500">{metrics.approved} approved - {metrics.awaiting} awaiting response</p>
        </div>
        <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-700">
          <Plus size={16} /> New submission
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Metric label="Total" value={metrics.total} icon={<FileText size={18} />} tone="bg-brand-50 text-brand-600" />
        <Metric label="Awaiting" value={metrics.awaiting} icon={<Clock size={18} />} tone="bg-amber-50 text-amber-600" />
        <Metric label="Approved" value={metrics.approved} icon={<CheckCircle size={18} />} tone="bg-emerald-50 text-emerald-600" />
        <Metric label="Rejected" value={metrics.rejected} icon={<XCircle size={18} />} tone="bg-red-50 text-red-600" />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map(([value, label]) => (
              <button
                key={value}
                onClick={() => {
                  setPage(1)
                  setStatusFilter(value)
                }}
                className={cn(
                  'rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors',
                  statusFilter === value ? 'border-brand-600 bg-brand-600 text-white' : 'border-border text-slate-500 hover:bg-accent',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex h-11 w-full items-center gap-2 rounded-xl border border-border bg-slate-50 px-3 sm:w-80">
            <Search size={16} className="text-slate-400" />
            <input
              value={search}
              onChange={event => {
                setPage(1)
                setSearch(event.target.value)
              }}
              placeholder="Search candidate, JD, client..."
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="border-b border-border bg-slate-50">
                <th className="px-5 py-4 text-left font-semibold text-slate-500">Candidate</th>
                <th className="px-5 py-4 text-left font-semibold text-slate-500">Role</th>
                <th className="px-5 py-4 text-left font-semibold text-slate-500">Status</th>
                <th className="px-5 py-4 text-left font-semibold text-slate-500">Pipeline</th>
                <th className="px-5 py-4 text-left font-semibold text-slate-500">Submitted</th>
                <th className="px-5 py-4 text-left font-semibold text-slate-500">Submitted by</th>
                <th className="px-5 py-4 text-right font-semibold text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && Array.from({ length: 5 }).map((_, index) => (
                <tr key={index} className="animate-pulse border-b border-border">
                  {Array.from({ length: 7 }).map((__, cell) => (
                    <td key={cell} className="px-5 py-4"><div className="h-4 rounded bg-muted" /></td>
                  ))}
                </tr>
              ))}

              {!isLoading && submissions.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <FileText size={44} className="mx-auto mb-4 text-slate-300" />
                    <p className="font-medium text-slate-600">No submissions found</p>
                    <p className="mt-1 text-sm text-slate-500">Submit an approved candidate to Tahaluf to start tracking client feedback.</p>
                    <button onClick={() => setShowNew(true)} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
                      <Plus size={15} /> New submission
                    </button>
                  </td>
                </tr>
              )}

              {submissions.map((submission: any) => {
                const candidate = submission.pipelineEntry?.candidate
                const jd = submission.pipelineEntry?.jd
                const stage = submission.pipelineEntry?.stage
                const isActing = actingId.startsWith(submission.id)
                return (
                  <tr key={submission.id} className="border-b border-border transition-colors last:border-0 hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                          candidate?.isInternal ? 'bg-pink-100 text-pink-700' : 'bg-brand-100 text-brand-700')}>
                          {initials(candidate?.fullName || '??')}
                        </div>
                        <div className="min-w-0">
                          <Link href={`/candidates/${candidate?.id}`} className="font-semibold text-slate-900 hover:text-brand-600">
                            {candidate?.fullName || 'Unknown candidate'}
                          </Link>
                          <div className="truncate text-xs text-slate-500">{candidate?.currentTitle || candidate?.email || 'No title'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-800">{jd?.title || 'Unknown role'}</div>
                      <div className="text-xs text-slate-500">{jd?.client || 'Client'}{submission.clientContact ? ` - To: ${submission.clientContact}` : ''}</div>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={submission.status} />
                      {submission.rejectionReason && <div className="mt-1 max-w-[220px] truncate text-xs text-red-600">{submission.rejectionReason}</div>}
                    </td>
                    <td className="px-5 py-4">
                      <span className={cn('inline-flex rounded-full px-2.5 py-1 text-xs font-bold', stageColor(stage || ''))}>{stageLabel(stage || '-')}</span>
                    </td>
                    <td className="px-5 py-4 text-slate-500">{formatDate(submission.submittedAt)}</td>
                    <td className="px-5 py-4 text-slate-700">{submission.submittedBy?.name || 'System'}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button onClick={() => openEdit(submission)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-accent">
                          <Edit3 size={14} /> Edit
                        </button>
                        {submission.profilePdfKey && (
                          <a href={submission.profilePdfKey} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-accent">
                            <ExternalLink size={14} /> Profile
                          </a>
                        )}
                        {submission.status === 'SUBMITTED' && (
                          <button disabled={isActing} onClick={() => quickAction(submission, { status: 'UNDER_REVIEW' }, 'Marked under review')} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50">
                            {isActing ? <Loader2 size={14} className="animate-spin" /> : <Clock size={14} />} Review
                          </button>
                        )}
                        {['SUBMITTED', 'UNDER_REVIEW'].includes(submission.status) && (
                          <button disabled={isActing} onClick={() => quickAction(submission, { status: 'APPROVED' }, 'Submission approved')} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">
                            {isActing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />} Approve
                          </button>
                        )}
                        {submission.status !== 'REJECTED' && (
                          <button onClick={() => openEdit(submission, 'REJECTED')} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50">
                            <XCircle size={14} /> Reject
                          </button>
                        )}
                        {submission.status === 'APPROVED' && !['ONBOARDING', 'ONBOARDED'].includes(stage) && (
                          <button disabled={isActing} onClick={() => quickAction(submission, { action: 'START_ONBOARDING' }, 'Onboarding started')} className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50">
                            {isActing ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />} Onboard
                          </button>
                        )}
                        <button onClick={() => setDeleting(submission)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-red-50 hover:text-red-600">
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4 text-sm text-slate-500">
          <span>{pagination.total} submissions</span>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage(current => Math.max(1, current - 1))} className="rounded-lg border border-border px-3 py-2 font-medium hover:bg-accent disabled:opacity-50">
              Previous
            </button>
            <span className="px-2">Page {page} of {Math.max(1, pagination.totalPages || 1)}</span>
            <button disabled={page >= (pagination.totalPages || 1)} onClick={() => setPage(current => current + 1)} className="rounded-lg border border-border px-3 py-2 font-medium hover:bg-accent disabled:opacity-50">
              Next
            </button>
          </div>
        </div>
      </div>

      {showNew && <SubmissionModal onClose={() => setShowNew(false)} />}
      {editing && <SubmissionModal submission={editing} initialStatus={editingInitialStatus} onClose={closeEdit} />}
      {deleting && <DeleteModal submission={deleting} onClose={() => setDeleting(null)} />}
    </div>
  )
}
