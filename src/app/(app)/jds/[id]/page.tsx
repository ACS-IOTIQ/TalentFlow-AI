'use client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import {
  ArrowLeft, Wand2, Globe, Loader2, Pencil, Trash2, X,
  AlertTriangle, CheckCircle2, Save, Download,
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface JD {
  id: string
  title: string
  client: string
  status: string
  openings: number
  location?: string
  employmentType?: string
  experienceMin?: number
  experienceMax?: number
  salaryMin?: number
  salaryMax?: number
  requiredSkills: string[]
  rawContent?: string
  polishedContent?: string
  finalContent?: string
  createdAt: string
  updatedAt: string
  createdBy?: { name: string; avatarUrl?: string }
  polishedBy?: { name: string }
  postingSources?: any[]
  interviewRounds?: any[]
  screeningConfig?: any
  _count?: { pipelineEntries: number }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  RAW: 'bg-gray-100 text-gray-700',
  POLISHING: 'bg-yellow-100 text-yellow-700',
  POLISHED: 'bg-green-100 text-green-700',
  POSTED: 'bg-blue-100 text-blue-700',
  CLOSED: 'bg-red-100 text-red-700',
}

const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Remote', 'Hybrid']
const AI_ENABLED = process.env.NEXT_PUBLIC_AI_FEATURES_ENABLED !== 'false'

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

function ConfirmDialog({
  title, description, confirmLabel = 'Confirm', danger = false, loading = false,
  onConfirm, onCancel,
}: {
  title: string; description: string; confirmLabel?: string
  danger?: boolean; loading?: boolean; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-2xl">
        <div className="p-6">
          <div className={cn('w-10 h-10 rounded-full flex items-center justify-center mb-4',
            danger ? 'bg-red-100' : 'bg-yellow-100')}>
            <AlertTriangle size={20} className={danger ? 'text-red-600' : 'text-yellow-600'} />
          </div>
          <h3 className="font-semibold text-base mb-1">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex justify-end gap-3 px-6 pb-6">
          <button onClick={onCancel} disabled={loading}
            className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-accent disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className={cn('flex items-center gap-2 px-4 py-2 text-sm text-white rounded-lg disabled:opacity-60',
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-yellow-600 hover:bg-yellow-700')}>
            {loading && <Loader2 size={14} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Skills Tag Input ─────────────────────────────────────────────────────────

function SkillsInput({ skills, onChange }: { skills: string[]; onChange: (s: string[]) => void }) {
  const [input, setInput] = useState('')
  const add = () => {
    const t = input.trim()
    if (t && !skills.includes(t)) onChange([...skills, t])
    setInput('')
  }
  const remove = (s: string) => onChange(skills.filter(x => x !== s))
  return (
    <div className="border border-input rounded-lg p-2 bg-background min-h-[42px] flex flex-wrap gap-1.5">
      {skills.map(s => (
        <span key={s} className="flex items-center gap-1 px-2 py-0.5 bg-brand-100 text-brand-700 text-xs rounded-full">
          {s}
          <button type="button" onClick={() => remove(s)} className="hover:text-brand-900"><X size={10} /></button>
        </span>
      ))}
      <input value={input} onChange={e => setInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() }
          if (e.key === 'Backspace' && !input && skills.length) remove(skills[skills.length - 1])
        }}
        onBlur={add}
        placeholder={skills.length ? '' : 'Type skill, press Enter…'}
        className="bg-transparent text-xs outline-none flex-1 min-w-[120px] py-0.5" />
    </div>
  )
}

// ─── Edit Metadata Modal ──────────────────────────────────────────────────────

function EditMetadataModal({ jd, onClose }: { jd: JD; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    title: jd.title,
    client: jd.client,
    location: jd.location || '',
    openings: jd.openings,
    employmentType: jd.employmentType || '',
    experienceMin: jd.experienceMin?.toString() || '',
    experienceMax: jd.experienceMax?.toString() || '',
    salaryMin: jd.salaryMin?.toString() || '',
    salaryMax: jd.salaryMax?.toString() || '',
    requiredSkills: [...(jd.requiredSkills || [])],
    status: jd.status,
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const body: any = {
        title: form.title,
        client: form.client,
        location: form.location || null,
        openings: Number(form.openings),
        requiredSkills: form.requiredSkills,
        employmentType: form.employmentType || null,
        status: form.status,
        experienceMin: form.experienceMin ? Number(form.experienceMin) : null,
        experienceMax: form.experienceMax ? Number(form.experienceMax) : null,
        salaryMin: form.salaryMin ? Number(form.salaryMin) : null,
        salaryMax: form.salaryMax ? Number(form.salaryMax) : null,
      }
      const r = await fetch(`/api/jds/${jd.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await r.json()
      if (d.success) {
        toast.success('Job description updated')
        qc.invalidateQueries({ queryKey: ['jd', jd.id] })
        qc.invalidateQueries({ queryKey: ['jds'] })
        onClose()
      } else {
        toast.error(d.error || 'Failed to update')
      }
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="font-semibold">Edit job description</h2>
            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">{jd.title}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-accent rounded-lg"><X size={16} /></button>
        </div>

        <form id="edit-jd-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Role title *</label>
              <input required value={form.title} onChange={e => set('title', e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Client</label>
              <input value={form.client} onChange={e => set('client', e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Location</label>
              <input value={form.location} onChange={e => set('location', e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background" placeholder="Dubai, UAE" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Openings</label>
              <input type="number" min={1} value={form.openings} onChange={e => set('openings', e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Employment type</label>
              <select value={form.employmentType} onChange={e => set('employmentType', e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background">
                <option value="">Select…</option>
                {EMPLOYMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background">
                {['RAW', 'POLISHED', 'POSTED', 'CLOSED'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Min experience (yrs)</label>
              <input type="number" min={0} value={form.experienceMin} onChange={e => set('experienceMin', e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background" placeholder="e.g. 3" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Max experience (yrs)</label>
              <input type="number" min={0} value={form.experienceMax} onChange={e => set('experienceMax', e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background" placeholder="e.g. 8" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Min salary (AED/mo)</label>
              <input type="number" min={0} value={form.salaryMin} onChange={e => set('salaryMin', e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background" placeholder="Optional" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Max salary (AED/mo)</label>
              <input type="number" min={0} value={form.salaryMax} onChange={e => set('salaryMax', e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background" placeholder="Optional" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Required skills</label>
            <SkillsInput skills={form.requiredSkills} onChange={s => set('requiredSkills', s)} />
          </div>
        </form>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border flex-shrink-0">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-accent">
            Cancel
          </button>
          <button type="submit" form="edit-jd-form" disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-60">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Save changes
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function JDDetailPage({ params }: { params: { id: string } }) {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role as string | undefined
  const canEdit = role && ['SUPER_ADMIN', 'CSO', 'DIR_TECH'].includes(role)
  const canClose = role && ['SUPER_ADMIN', 'CSO'].includes(role)
  const canHardDelete = role === 'SUPER_ADMIN'

  const router = useRouter()
  const qc = useQueryClient()

  const [editingContent, setEditingContent] = useState('')
  const [savingContent, setSavingContent] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)

  const [confirm, setConfirm] = useState<'polish' | 'close' | 'delete' | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['jd', params.id],
    queryFn: async () => {
      const r = await fetch(`/api/jds/${params.id}`)
      return r.json()
    },
  })

  const jd: JD | undefined = data?.data

  // ── Content editing ────────────────────────────────────────────────────────

  const saveContent = async () => {
    if (!editingContent.trim()) return
    setSavingContent(true)
    try {
      const r = await fetch(`/api/jds/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ finalContent: editingContent }),
      })
      const d = await r.json()
      if (d.success) {
        toast.success('Content saved')
        qc.invalidateQueries({ queryKey: ['jd', params.id] })
        setEditingContent('')
      } else {
        toast.error(d.error || 'Failed to save')
      }
    } finally { setSavingContent(false) }
  }

  // ── Polish ─────────────────────────────────────────────────────────────────

  const handlePolish = async () => {
    setActionLoading(true)
    try {
      const r = await fetch(`/api/jds/${params.id}/polish`, { method: 'POST' })
      const d = await r.json()
      if (d.success) {
        toast.success('JD polished by AI successfully')
        qc.invalidateQueries({ queryKey: ['jd', params.id] })
      } else {
        toast.error(d.error || 'Polish failed')
      }
    } finally { setActionLoading(false); setConfirm(null) }
  }

  // ── Close ──────────────────────────────────────────────────────────────────

  const handleClose = async () => {
    setActionLoading(true)
    try {
      const r = await fetch(`/api/jds/${params.id}`, { method: 'DELETE' })
      const d = await r.json()
      if (d.success) {
        toast.success('Job description closed')
        qc.invalidateQueries({ queryKey: ['jd', params.id] })
        qc.invalidateQueries({ queryKey: ['jds'] })
      } else {
        toast.error(d.error || 'Failed to close')
      }
    } finally { setActionLoading(false); setConfirm(null) }
  }

  // ── Hard Delete ────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    setActionLoading(true)
    try {
      const r = await fetch(`/api/jds/${params.id}?permanent=true`, { method: 'DELETE' })
      const d = await r.json()
      if (d.success) {
        toast.success('Job description permanently deleted')
        router.push('/jds')
      } else {
        toast.error(d.error || 'Failed to delete')
      }
    } finally { setActionLoading(false); setConfirm(null) }
  }

  const runConfirm = () => {
    if (confirm === 'polish') handlePolish()
    else if (confirm === 'close') handleClose()
    else if (confirm === 'delete') handleDelete()
  }

  // ── Confirm config ─────────────────────────────────────────────────────────

  const confirmConfig = jd && confirm ? {
    polish: {
      title: 'Polish with AI?',
      description: `Claude AI will rewrite "${jd.title}" into a structured, professional JD. The original raw content will be preserved.`,
      confirmLabel: 'Yes, polish it',
      danger: false,
    },
    close: {
      title: 'Close this JD?',
      description: `"${jd.title}" will be marked as CLOSED. Existing candidates in the pipeline won't be affected.`,
      confirmLabel: 'Close JD',
      danger: false,
    },
    delete: {
      title: 'Permanently delete this JD?',
      description: `"${jd.title}" will be permanently removed from the database. This cannot be undone and will redirect you back to the list.`,
      confirmLabel: 'Delete permanently',
      danger: true,
    },
  }[confirm] : null

  // ── Loading / not found ────────────────────────────────────────────────────

  if (isLoading) return (
    <div className="space-y-5 animate-pulse">
      <div className="h-8 bg-muted rounded w-40" />
      <div className="h-14 bg-muted rounded-xl" />
      <div className="h-96 bg-muted rounded-xl" />
    </div>
  )

  if (!jd) return (
    <div className="text-center py-16 text-muted-foreground">
      <p className="font-medium">JD not found</p>
      <Link href="/jds" className="text-sm text-brand-600 hover:underline mt-2 inline-block">Back to list</Link>
    </div>
  )

  const displayContent = editingContent || jd.finalContent || jd.polishedContent || jd.rawContent || ''

  return (
    <div className="mx-auto max-w-[1600px] space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <Link href="/jds" className="p-1.5 hover:bg-accent rounded-lg mt-0.5">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold truncate">{jd.title}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[jd.status] || 'bg-gray-100 text-gray-700')}>
              {jd.status}
            </span>
            <span className="text-sm text-muted-foreground">{jd.client}</span>
            {jd.location && <span className="text-sm text-muted-foreground">· {jd.location}</span>}
            <span className="text-sm text-muted-foreground">· {jd.openings} opening{jd.openings !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Header action buttons */}
        <div className="flex flex-wrap items-center gap-2 xl:flex-shrink-0 xl:justify-end">
          {AI_ENABLED && jd.status === 'RAW' && canEdit && (
            <button
              onClick={() => setConfirm('polish')}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-lg hover:bg-accent"
            >
              <Wand2 size={14} /> Polish with AI
            </button>
          )}

          {canEdit && (
            <button
              onClick={() => setShowEditModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-lg hover:bg-accent"
            >
              <Pencil size={14} /> Edit
            </button>
          )}

          {displayContent && (
            <a
              href={`/api/jds/${jd.id}/download`}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-lg hover:bg-accent"
            >
              <Download size={14} /> PDF
            </a>
          )}

          {canClose && jd.status !== 'CLOSED' && (
            <button
              onClick={() => setConfirm('close')}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-yellow-300 text-yellow-700 rounded-lg hover:bg-yellow-50"
            >
              <X size={14} /> Close JD
            </button>
          )}

          {canHardDelete && (
            <button
              onClick={() => setConfirm('delete')}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
            >
              <Trash2 size={14} /> Delete
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Content editor */}
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <h2 className="font-medium text-sm">JD content</h2>
              <div className="flex items-center gap-2">
                {editingContent ? (
                  <>
                    <button
                      onClick={() => setEditingContent('')}
                      className="text-xs px-2.5 py-1.5 border border-border rounded hover:bg-accent"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveContent}
                      disabled={savingContent}
                      className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-brand-600 text-white rounded hover:bg-brand-700 disabled:opacity-60"
                    >
                      {savingContent ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                      Save
                    </button>
                  </>
                ) : (
                  canEdit && (
                    <button
                      onClick={() => setEditingContent(displayContent)}
                      className="text-xs px-2.5 py-1.5 border border-border rounded hover:bg-accent"
                    >
                      <Pencil size={12} className="inline mr-1" />Edit content
                    </button>
                  )
                )}
              </div>
            </div>

            {editingContent ? (
              <textarea
                value={editingContent}
                onChange={e => setEditingContent(e.target.value)}
                className="w-full p-5 text-sm bg-background font-mono resize-none focus:outline-none min-h-[400px]"
                rows={24}
              />
            ) : (
              <div className="p-5">
                {displayContent ? (
                  <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">{displayContent}</pre>
                ) : (
                  <p className="text-muted-foreground text-sm text-center py-8">
                    No content yet.{canEdit ? ' Click "Edit content" to add some, or use "Polish with AI" to generate it.' : ''}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Posting sources */}
          {(jd.postingSources?.length ?? 0) > 0 && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="font-medium mb-3 text-sm">Posting sources</h2>
              <div className="space-y-2">
                {jd.postingSources!.map((src: any) => (
                  <div key={src.id} className="flex items-center gap-3 text-sm">
                    <Globe size={14} className="text-muted-foreground flex-shrink-0" />
                    <span className="font-medium">{src.source}</span>
                    {src.url && (
                      <a href={src.url} target="_blank" rel="noopener noreferrer"
                        className="text-brand-600 hover:underline text-xs truncate flex-1">
                        {src.url}
                      </a>
                    )}
                    {src.postedAt && (
                      <span className="ml-auto text-xs text-muted-foreground flex-shrink-0">{formatDate(src.postedAt)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Sidebar */}
        <div className="space-y-5">
          {/* Details */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-medium mb-3 text-sm">Details</h2>
            <div className="space-y-2.5 text-sm">
              {[
                ['Employment type', jd.employmentType || '—'],
                ['Experience', jd.experienceMin != null && jd.experienceMax != null
                  ? `${jd.experienceMin}–${jd.experienceMax} yrs` : '—'],
                ['Salary range', jd.salaryMin != null && jd.salaryMax != null
                  ? `AED ${Number(jd.salaryMin).toLocaleString()} – ${Number(jd.salaryMax).toLocaleString()}/mo` : '—'],
                ['Applicants', jd._count?.pipelineEntries ?? 0],
                ['Created by', jd.createdBy?.name || '—'],
                ['Polished by', jd.polishedBy?.name || '—'],
                ['Created', formatDate(jd.createdAt)],
                ['Updated', formatDate(jd.updatedAt)],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex justify-between gap-2">
                  <span className="text-muted-foreground flex-shrink-0">{label}</span>
                  <span className="font-medium text-right">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Required skills */}
          {Array.isArray(jd.requiredSkills) && jd.requiredSkills.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="font-medium mb-3 text-sm">Required skills</h2>
              <div className="flex flex-wrap gap-2">
                {jd.requiredSkills.map((s: string) => (
                  <span key={s} className="px-2.5 py-1 bg-brand-50 text-brand-700 text-xs rounded-lg">{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Interview rounds */}
          {(jd.interviewRounds?.length ?? 0) > 0 && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="font-medium mb-3 text-sm">Interview rounds</h2>
              <div className="space-y-2">
                {jd.interviewRounds!.map((r: any) => (
                  <div key={r.id} className="flex items-center gap-2 text-sm">
                    <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {r.roundNumber}
                    </span>
                    <span className="font-medium flex-1">{r.roundName}</span>
                    <span className="text-muted-foreground text-xs">{r.durationMinutes}m</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Screening config indicator */}
          {jd.screeningConfig && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="font-medium mb-2 text-sm">Screening config</h2>
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="flex justify-between">
                  <span>Skill weight</span><span className="font-medium">{jd.screeningConfig.skillWeight}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Min score</span><span className="font-medium">{jd.screeningConfig.minMatchScore}%</span>
                </div>
              </div>
              <Link href="/screening" className="text-xs text-brand-600 hover:underline mt-2 inline-block">
                Configure screening →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showEditModal && <EditMetadataModal jd={jd} onClose={() => setShowEditModal(false)} />}

      {confirm && confirmConfig && (
        <ConfirmDialog
          title={confirmConfig.title}
          description={confirmConfig.description}
          confirmLabel={confirmConfig.confirmLabel}
          danger={confirmConfig.danger}
          loading={actionLoading}
          onConfirm={runConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
