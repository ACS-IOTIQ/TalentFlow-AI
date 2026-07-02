'use client'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Send, Plus, CheckCircle, XCircle, Clock, X, Loader2, ExternalLink } from 'lucide-react'
import { cn, formatDate, initials } from '@/lib/utils'

function NewSubmissionModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ pipelineEntryId: '', clientContact: '', clientNotes: '' })
  const [saving, setSaving] = useState(false)

  const { data } = useQuery({
    queryKey: ['candidates-submittable'],
    queryFn: async () => {
      const r = await fetch('/api/candidates?pageSize=100')
      return r.json()
    },
  })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const r = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const d = await r.json()
      if (d.success) {
        toast.success('Submitted to Tahaluf')
        qc.invalidateQueries({ queryKey: ['submissions'] })
        onClose()
      } else toast.error(d.error)
    } finally { setSaving(false) }
  }

  const candidates = data?.data || []

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-semibold">Submit to Tahaluf</h2>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Candidate + JD *</label>
            <select required value={form.pipelineEntryId} onChange={e => setForm(f => ({ ...f, pipelineEntryId: e.target.value }))}
              className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background">
              <option value="">Select candidate...</option>
              {candidates.flatMap((c: any) =>
                c.pipelineEntries?.filter((pe: any) => ['INTERNAL_APPROVED', 'SCREENING_CALL', 'INTERVIEWING'].includes(pe.stage))
                  .map((pe: any) => (
                    <option key={pe.id} value={pe.id}>
                      {c.fullName} — {pe.jd?.title || 'Unknown JD'}
                    </option>
                  ))
              )}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Tahaluf contact</label>
            <input value={form.clientContact} onChange={e => setForm(f => ({ ...f, clientContact: e.target.value }))}
              placeholder="Name or email of Tahaluf reviewer"
              className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Cover notes</label>
            <textarea value={form.clientNotes} onChange={e => setForm(f => ({ ...f, clientNotes: e.target.value }))}
              rows={3} placeholder="Brief note to accompany the profile..."
              className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background resize-none" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-accent">Cancel</button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-60">
              {saving && <Loader2 size={14} className="animate-spin" />} <Send size={14} /> Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function UpdateStatusModal({ submission, onClose }: { submission: any; onClose: () => void }) {
  const qc = useQueryClient()
  const [status, setStatus] = useState(submission.status)
  const [clientNotes, setClientNotes] = useState(submission.clientNotes || '')
  const [rejectionReason, setRejectionReason] = useState(submission.rejectionReason || '')
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const r = await fetch(`/api/submissions/${submission.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, clientNotes, rejectionReason }),
      })
      const d = await r.json()
      if (d.success) {
        toast.success('Status updated')
        qc.invalidateQueries({ queryKey: ['submissions'] })
        onClose()
      } else toast.error(d.error)
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-semibold">Update Tahaluf feedback</h2>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background">
              <option value="SUBMITTED">Submitted</option>
              <option value="UNDER_REVIEW">Under review</option>
              <option value="APPROVED">Approved ✓</option>
              <option value="REJECTED">Rejected ✗</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Tahaluf notes</label>
            <textarea value={clientNotes} onChange={e => setClientNotes(e.target.value)}
              rows={3} className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background resize-none" />
          </div>
          {status === 'REJECTED' && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Rejection reason</label>
              <textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)}
                rows={2} className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background resize-none" />
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-accent">Cancel</button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-60">
              {saving && <Loader2 size={14} className="animate-spin" />} Update
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const STATUS_STYLE: Record<string, { color: string; icon: React.ElementType }> = {
  SUBMITTED: { color: 'bg-blue-100 text-blue-700', icon: Send },
  UNDER_REVIEW: { color: 'bg-amber-100 text-amber-700', icon: Clock },
  APPROVED: { color: 'bg-green-100 text-green-700', icon: CheckCircle },
  REJECTED: { color: 'bg-red-100 text-red-700', icon: XCircle },
}

export default function SubmissionsPage() {
  const [showNew, setShowNew] = useState(false)
  const [updating, setUpdating] = useState<any>(null)
  const [statusFilter, setStatusFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['submissions', statusFilter],
    queryFn: async () => {
      const p = new URLSearchParams({ pageSize: '50', ...(statusFilter && { status: statusFilter }) })
      const r = await fetch(`/api/submissions?${p}`)
      return r.json()
    },
  })

  const submissions = data?.data || []
  const total = data?.pagination?.total || 0

  const counts = {
    all: total,
    approved: submissions.filter((s: any) => s.status === 'APPROVED').length,
    pending: submissions.filter((s: any) => s.status === 'SUBMITTED').length,
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Submissions to Tahaluf</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{counts.approved} approved · {counts.pending} awaiting response</p>
        </div>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 font-medium">
          <Plus size={15} /> New submission
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2">
        {[['', 'All'], ['SUBMITTED', 'Submitted'], ['UNDER_REVIEW', 'Under review'], ['APPROVED', 'Approved'], ['REJECTED', 'Rejected']].map(([val, label]) => (
          <button key={val} onClick={() => setStatusFilter(val)}
            className={cn('px-3 py-1.5 text-sm rounded-lg border transition-colors',
              statusFilter === val ? 'bg-brand-600 text-white border-brand-600' : 'border-border hover:bg-accent text-muted-foreground')}>
            {label}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Candidate</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Submitted</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Submitted by</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-border animate-pulse">
                {Array.from({ length: 5 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded" /></td>)}
                <td />
              </tr>
            ))}
            {!isLoading && submissions.length === 0 && (
              <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No submissions found</td></tr>
            )}
            {submissions.map((s: any) => {
              const style = STATUS_STYLE[s.status] || STATUS_STYLE.SUBMITTED
              const Icon = style.icon
              return (
                <tr key={s.id} className="border-b border-border hover:bg-muted/20 last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold',
                        s.pipelineEntry?.candidate?.isInternal ? 'bg-pink-100 text-pink-700' : 'bg-brand-100 text-brand-700')}>
                        {initials(s.pipelineEntry?.candidate?.fullName || '??')}
                      </div>
                      <div>
                        <div className="font-medium">{s.pipelineEntry?.candidate?.fullName}</div>
                        {s.clientContact && <div className="text-xs text-muted-foreground">To: {s.clientContact}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{s.pipelineEntry?.jd?.title}</div>
                    <div className="text-xs text-muted-foreground">{s.pipelineEntry?.jd?.client}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium w-fit', style.color)}>
                      <Icon size={13} /> {s.status.replace('_', ' ')}
                    </span>
                    {s.rejectionReason && (
                      <div className="text-xs text-red-600 mt-1 max-w-xs truncate">{s.rejectionReason}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(s.submittedAt)}</td>
                  <td className="px-4 py-3 text-sm">{s.submittedBy?.name}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => setUpdating(s)}
                      className="text-xs px-2.5 py-1.5 border border-border rounded-lg hover:bg-accent">
                      Update
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showNew && <NewSubmissionModal onClose={() => setShowNew(false)} />}
      {updating && <UpdateStatusModal submission={updating} onClose={() => setUpdating(null)} />}
    </div>
  )
}
