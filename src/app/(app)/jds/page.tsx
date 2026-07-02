'use client'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import {
  Plus, Wand2, FileText, Search, X, Loader2, ExternalLink,
  Pencil, Trash2, AlertTriangle, CheckCircle2, ChevronDown,
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import Link from 'next/link'

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
  createdAt: string
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

// ─── Shared: Confirm Dialog ───────────────────────────────────────────────────

function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Confirm',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: {
  title: string
  description: string
  confirmLabel?: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
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
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm text-white rounded-lg disabled:opacity-60',
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-yellow-600 hover:bg-yellow-700',
            )}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Shared: Skills Tag Input ─────────────────────────────────────────────────

function SkillsInput({ skills, onChange }: { skills: string[]; onChange: (s: string[]) => void }) {
  const [input, setInput] = useState('')

  const add = () => {
    const trimmed = input.trim()
    if (trimmed && !skills.includes(trimmed)) onChange([...skills, trimmed])
    setInput('')
  }

  const remove = (skill: string) => onChange(skills.filter(s => s !== skill))

  return (
    <div className="border border-input rounded-lg p-2 bg-background min-h-[42px] flex flex-wrap gap-1.5">
      {skills.map(s => (
        <span key={s} className="flex items-center gap-1 px-2 py-0.5 bg-brand-100 text-brand-700 text-xs rounded-full">
          {s}
          <button type="button" onClick={() => remove(s)} className="hover:text-brand-900">
            <X size={10} />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() }
          if (e.key === 'Backspace' && !input && skills.length) remove(skills[skills.length - 1])
        }}
        onBlur={add}
        placeholder={skills.length ? '' : 'Type skill, press Enter…'}
        className="bg-transparent text-xs outline-none flex-1 min-w-[120px] py-0.5"
      />
    </div>
  )
}

// ─── Create JD Modal ──────────────────────────────────────────────────────────

function NewJDModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    title: '', client: 'Tahaluf', location: '', openings: 1,
    employmentType: '', experienceMin: '', experienceMax: '',
    salaryMin: '', salaryMax: '', requiredSkills: [] as string[], rawContent: '',
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
        location: form.location || undefined,
        openings: Number(form.openings),
        requiredSkills: form.requiredSkills,
        rawContent: form.rawContent || undefined,
        employmentType: form.employmentType || undefined,
      }
      if (form.experienceMin) body.experienceMin = Number(form.experienceMin)
      if (form.experienceMax) body.experienceMax = Number(form.experienceMax)
      if (form.salaryMin) body.salaryMin = Number(form.salaryMin)
      if (form.salaryMax) body.salaryMax = Number(form.salaryMax)

      const r = await fetch('/api/jds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await r.json()
      if (data.success) {
        toast.success('Job description created successfully')
        qc.invalidateQueries({ queryKey: ['jds'] })
        onClose()
      } else {
        toast.error(data.error || 'Failed to create JD')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="font-semibold">New job description</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Fill in the details below to create a new JD</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-accent rounded-lg"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-4">
          {/* Row 1: Title + Client */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Role title *</label>
              <input required value={form.title} onChange={e => set('title', e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background"
                placeholder="e.g. Senior Data Engineer" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Client</label>
              <input value={form.client} onChange={e => set('client', e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background" />
            </div>
          </div>

          {/* Row 2: Location + Openings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Location</label>
              <input value={form.location} onChange={e => set('location', e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background"
                placeholder="Dubai, UAE" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Openings</label>
              <input type="number" min={1} value={form.openings} onChange={e => set('openings', e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background" />
            </div>
          </div>

          {/* Row 3: Employment type + Experience */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Employment type</label>
              <select value={form.employmentType} onChange={e => set('employmentType', e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background">
                <option value="">Select…</option>
                {EMPLOYMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Min exp (yrs)</label>
              <input type="number" min={0} value={form.experienceMin} onChange={e => set('experienceMin', e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background" placeholder="0" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Max exp (yrs)</label>
              <input type="number" min={0} value={form.experienceMax} onChange={e => set('experienceMax', e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background" placeholder="10" />
            </div>
          </div>

          {/* Row 4: Salary */}
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

          {/* Skills */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Required skills</label>
            <SkillsInput skills={form.requiredSkills} onChange={s => set('requiredSkills', s)} />
            <p className="text-xs text-muted-foreground mt-1">Type a skill and press Enter or comma to add</p>
          </div>

          {/* Raw content */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Raw JD content</label>
            <textarea value={form.rawContent} onChange={e => set('rawContent', e.target.value)}
              rows={5}
              className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background resize-none"
              placeholder="Paste the raw JD here. AI will polish it afterwards." />
          </div>
        </form>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border flex-shrink-0">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-accent">
            Cancel
          </button>
          <button
            onClick={(e) => { const form = document.querySelector('form'); form?.requestSubmit() }}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-60">
            {saving && <Loader2 size={14} className="animate-spin" />}
            Create JD
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Edit JD Modal ────────────────────────────────────────────────────────────

function EditJDModal({ jd, onClose }: { jd: JD; onClose: () => void }) {
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
    requiredSkills: jd.requiredSkills || [],
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
      const data = await r.json()
      if (data.success) {
        toast.success('Job description updated')
        qc.invalidateQueries({ queryKey: ['jds'] })
        qc.invalidateQueries({ queryKey: ['jd', jd.id] })
        onClose()
      } else {
        toast.error(data.error || 'Failed to update JD')
      }
    } finally {
      setSaving(false)
    }
  }

  const STATUSES = ['RAW', 'POLISHED', 'POSTED', 'CLOSED']

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="font-semibold">Edit job description</h2>
            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-sm">{jd.title}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-accent rounded-lg"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-4">
          {/* Row 1 */}
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

          {/* Row 2 */}
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

          {/* Row 3 */}
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
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Row 4: Experience */}
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

          {/* Row 5: Salary */}
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

          {/* Skills */}
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
          <button
            onClick={(e) => { const form = document.querySelector('form'); form?.requestSubmit() }}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-60">
            {saving && <Loader2 size={14} className="animate-spin" />}
            <CheckCircle2 size={14} />
            Save changes
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function JDsPage() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role as string | undefined
  const canEdit = role && ['SUPER_ADMIN', 'CSO', 'DIR_TECH'].includes(role)
  const canClose = role && ['SUPER_ADMIN', 'CSO'].includes(role)
  const canHardDelete = role === 'SUPER_ADMIN'

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [editingJD, setEditingJD] = useState<JD | null>(null)

  // Confirm dialog state
  const [confirm, setConfirm] = useState<{
    type: 'polish' | 'close' | 'delete'
    jd: JD
  } | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['jds', search, statusFilter],
    queryFn: async () => {
      const p = new URLSearchParams({ pageSize: '100' })
      if (search) p.set('search', search)
      if (statusFilter) p.set('status', statusFilter)
      const r = await fetch(`/api/jds?${p}`)
      return r.json()
    },
  })

  const jds: JD[] = data?.data || []

  // ── Actions ────────────────────────────────────────────────────────────────

  const handlePolish = async (jd: JD) => {
    setActionLoading(true)
    try {
      const r = await fetch(`/api/jds/${jd.id}/polish`, { method: 'POST' })
      const d = await r.json()
      if (d.success) {
        toast.success('JD polished by AI successfully')
        qc.invalidateQueries({ queryKey: ['jds'] })
      } else {
        toast.error(d.error || 'Polish failed')
      }
    } finally {
      setActionLoading(false)
      setConfirm(null)
    }
  }

  const handleClose = async (jd: JD) => {
    setActionLoading(true)
    try {
      const r = await fetch(`/api/jds/${jd.id}`, { method: 'DELETE' })
      const d = await r.json()
      if (d.success) {
        toast.success('Job description closed')
        qc.invalidateQueries({ queryKey: ['jds'] })
      } else {
        toast.error(d.error || 'Failed to close JD')
      }
    } finally {
      setActionLoading(false)
      setConfirm(null)
    }
  }

  const handleDelete = async (jd: JD) => {
    setActionLoading(true)
    try {
      const r = await fetch(`/api/jds/${jd.id}?permanent=true`, { method: 'DELETE' })
      const d = await r.json()
      if (d.success) {
        toast.success('Job description permanently deleted')
        qc.invalidateQueries({ queryKey: ['jds'] })
      } else {
        toast.error(d.error || 'Failed to delete JD')
      }
    } finally {
      setActionLoading(false)
      setConfirm(null)
    }
  }

  const runConfirmedAction = () => {
    if (!confirm) return
    if (confirm.type === 'polish') handlePolish(confirm.jd)
    else if (confirm.type === 'close') handleClose(confirm.jd)
    else if (confirm.type === 'delete') handleDelete(confirm.jd)
  }

  // ── Confirm dialog config ──────────────────────────────────────────────────

  const confirmConfig = confirm ? {
    polish: {
      title: 'Polish with AI?',
      description: `Claude AI will rewrite "${confirm.jd.title}" into a structured, professional JD. The original raw content will be preserved.`,
      confirmLabel: 'Yes, polish it',
      danger: false,
    },
    close: {
      title: 'Close this JD?',
      description: `"${confirm.jd.title}" will be marked as CLOSED. Existing candidates in the pipeline won't be affected. You can reopen it later by editing the status.`,
      confirmLabel: 'Close JD',
      danger: false,
    },
    delete: {
      title: 'Permanently delete this JD?',
      description: `"${confirm.jd.title}" will be permanently removed from the database. This action cannot be undone.`,
      confirmLabel: 'Delete permanently',
      danger: true,
    },
  }[confirm.type] : null

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Job descriptions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{jds.length} total</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 font-medium"
          >
            <Plus size={15} /> New JD
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-sm px-3 py-2 border border-border rounded-lg bg-background">
          <Search size={15} className="text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by title or client…"
            className="bg-transparent text-sm outline-none flex-1"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-muted-foreground hover:text-foreground">
              <X size={13} />
            </button>
          )}
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg text-sm bg-background"
        >
          <option value="">All statuses</option>
          <option value="RAW">Raw</option>
          <option value="POLISHING">Polishing</option>
          <option value="POLISHED">Polished</option>
          <option value="POSTED">Posted</option>
          <option value="CLOSED">Closed</option>
        </select>
      </div>

      {/* JD Cards */}
      <div className="grid gap-4">
        {isLoading && Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />
        ))}

        {jds.map((jd) => (
          <div key={jd.id} className="bg-card border border-border rounded-xl p-5 flex items-start justify-between gap-4 hover:border-brand-300 transition-colors">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[jd.status] || STATUS_COLORS.RAW)}>
                  {jd.status}
                </span>
                <span className="text-xs text-muted-foreground">{jd.client}</span>
                {jd.employmentType && (
                  <span className="text-xs text-muted-foreground">· {jd.employmentType}</span>
                )}
              </div>
              <h3 className="font-semibold">{jd.title}</h3>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 mt-1.5 text-xs text-muted-foreground">
                <span>{jd.openings} opening{jd.openings !== 1 ? 's' : ''}</span>
                {jd.location && <span>{jd.location}</span>}
                {jd.experienceMin != null && jd.experienceMax != null && (
                  <span>{jd.experienceMin}–{jd.experienceMax} yrs</span>
                )}
                {jd.salaryMin != null && jd.salaryMax != null && (
                  <span>AED {jd.salaryMin.toLocaleString()}–{jd.salaryMax.toLocaleString()}/mo</span>
                )}
                <span>{jd._count?.pipelineEntries ?? 0} applicants</span>
                <span>Created {formatDate(jd.createdAt)}</span>
              </div>
              {Array.isArray(jd.requiredSkills) && jd.requiredSkills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {jd.requiredSkills.slice(0, 6).map((s) => (
                    <span key={s} className="px-2 py-0.5 bg-brand-50 text-brand-700 text-xs rounded-full">{s}</span>
                  ))}
                  {jd.requiredSkills.length > 6 && (
                    <span className="px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded-full">
                      +{jd.requiredSkills.length - 6}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {jd.status === 'RAW' && canEdit && (
                <button
                  onClick={() => setConfirm({ type: 'polish', jd })}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-accent"
                >
                  <Wand2 size={13} /> Polish AI
                </button>
              )}

              <Link
                href={`/jds/${jd.id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-accent"
              >
                <ExternalLink size={13} /> View
              </Link>

              {canEdit && (
                <button
                  onClick={() => setEditingJD(jd)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-accent"
                  title="Edit JD"
                >
                  <Pencil size={13} />
                </button>
              )}

              {canClose && jd.status !== 'CLOSED' && (
                <button
                  onClick={() => setConfirm({ type: 'close', jd })}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-yellow-50 hover:border-yellow-300 hover:text-yellow-700"
                  title="Close JD"
                >
                  <X size={13} />
                </button>
              )}

              {canHardDelete && (
                <button
                  onClick={() => setConfirm({ type: 'delete', jd })}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-red-50 hover:border-red-300 hover:text-red-600"
                  title="Permanently delete"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>
        ))}

        {!isLoading && jds.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <FileText size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No job descriptions found</p>
            <p className="text-sm mt-1">
              {search || statusFilter ? 'Try adjusting your filters.' : 'Create your first JD to get started.'}
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      {showNew && <NewJDModal onClose={() => setShowNew(false)} />}
      {editingJD && <EditJDModal jd={editingJD} onClose={() => setEditingJD(null)} />}

      {confirm && confirmConfig && (
        <ConfirmDialog
          title={confirmConfig.title}
          description={confirmConfig.description}
          confirmLabel={confirmConfig.confirmLabel}
          danger={confirmConfig.danger}
          loading={actionLoading}
          onConfirm={runConfirmedAction}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
