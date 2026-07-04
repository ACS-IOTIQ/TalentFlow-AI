'use client'
import { useCallback, useState } from 'react'
import Link from 'next/link'
import { useDropzone } from 'react-dropzone'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ChevronLeft,
  ChevronRight,
  Flag,
  Link2,
  Loader2,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
  UploadCloud,
  X,
} from 'lucide-react'
import { cn, formatDate, initials, scoreColor, stageColor, stageLabel } from '@/lib/utils'

function UploadModal({ onClose, jds }: { onClose: () => void; jds: any[] }) {
  const [jdId, setJdId] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadStatus, setUploadStatus] = useState('Preparing upload...')
  const qc = useQueryClient()

  const onDrop = useCallback((files: File[]) => {
    if (files.length) setSelectedFiles(files)
  }, [])

  const handleUpload = useCallback(async () => {
    if (!selectedFiles.length) {
      toast.error('Select at least one resume file')
      return
    }

    setUploading(true)
    setProgress(20)
    setUploadStatus('Uploading resume files...')

    const fd = new FormData()
    selectedFiles.forEach(file => fd.append('files', file))
    if (jdId) fd.append('jdId', jdId)

    try {
      setProgress(50)
      setUploadStatus('Extracting text and building candidate profiles...')
      const response = await fetch('/api/candidates', { method: 'POST', body: fd })
      setProgress(85)
      setUploadStatus('Saving candidate records...')
      const data = await response.json()

      if (data.success) {
        const result = data.data
        const parts = [
          `${result.created} created`,
          result.updated ? `${result.updated} updated` : null,
          result.aiParsed ? `${result.aiParsed} AI parsed` : null,
          result.manualParsed ? `${result.manualParsed} manually parsed` : null,
          result.fallbackCreated ? `${result.fallbackCreated} fallback` : null,
          result.skipped ? `${result.skipped} skipped` : null,
          result.errors ? `${result.errors} errors` : null,
        ].filter(Boolean)
        toast.success(`Resume upload complete: ${parts.join(', ')}`)
        if (result.extractionErrors?.length) {
          toast.warning(`Extraction fallback: ${result.extractionErrors[0].fileName} - ${result.extractionErrors[0].error}`)
        }
        qc.invalidateQueries({ queryKey: ['candidates'] })
        onClose()
      } else {
        toast.error(data.error)
      }
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
      setProgress(0)
      setUploadStatus('Preparing upload...')
    }
  }, [selectedFiles, jdId, qc, onClose])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/zip': ['.zip'],
    },
    noClick: false,
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[1px]">
      <div className="w-full max-w-[720px] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-7 py-6">
          <h2 className="text-xl font-semibold">Upload resumes</h2>
          <button
            onClick={onClose}
            disabled={uploading}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 p-7">
          <div
            {...getRootProps()}
            className={cn(
              'cursor-pointer rounded-2xl border-2 border-dashed bg-slate-50/70 px-8 py-12 text-center transition-colors',
              isDragActive ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-brand-300',
            )}
          >
            <input {...getInputProps()} />
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              <UploadCloud size={24} />
            </div>
            <p className="mb-1 text-base font-semibold">
              {isDragActive ? 'Drop resumes here' : 'Drag & drop resumes here'}
            </p>
            <p className="text-sm text-muted-foreground">PDF or DOCX or a ZIP batch - profile fields parsed automatically</p>
            {selectedFiles.length > 0 && (
              <p className="mt-3 text-sm text-brand-600">{selectedFiles.length} file(s) selected</p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-600">Link to JD (optional)</label>
            <select
              value={jdId}
              onChange={event => setJdId(event.target.value)}
              disabled={uploading}
              className="w-full rounded-xl border border-input bg-slate-50 px-4 py-3 text-sm outline-none focus:border-brand-400"
            >
              <option value="">Select JD...</option>
              {jds.map((jd: any) => (
                <option key={jd.id} value={jd.id}>{jd.title} - {jd.client}</option>
              ))}
            </select>
          </div>

          {uploading && (
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 size={14} className="animate-spin" /> {uploadStatus}
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-brand-500 transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-border px-7 py-5">
          <button
            onClick={onClose}
            disabled={uploading}
            className="rounded-xl border border-border px-5 py-3 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={uploading || selectedFiles.length === 0}
            className="flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-700 disabled:opacity-50"
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
            Upload & parse
          </button>
        </div>
      </div>
    </div>
  )
}

function LinkJdModal({ candidate, jds, onClose }: { candidate: any; jds: any[]; onClose: () => void }) {
  const [jdId, setJdId] = useState('')
  const [saving, setSaving] = useState(false)
  const qc = useQueryClient()

  const handleLink = async () => {
    if (!jdId) {
      toast.error('Select a JD to link')
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`/api/candidates/${candidate.id}/link-jd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jdId }),
      })
      const data = await response.json()
      if (!data.success) {
        toast.error(data.error || 'Unable to link JD')
        return
      }

      toast.success('Candidate linked to JD')
      qc.invalidateQueries({ queryKey: ['candidates'] })
      onClose()
    } catch {
      toast.error('Unable to link JD')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[1px]">
      <div className="w-full max-w-[520px] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold">Link JD</h2>
            <p className="mt-1 text-sm text-slate-500">{candidate.fullName}</p>
          </div>
          <button onClick={onClose} disabled={saving} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-4 p-6">
          <select
            value={jdId}
            onChange={event => setJdId(event.target.value)}
            disabled={saving}
            className="h-12 w-full rounded-xl border border-input bg-slate-50 px-4 text-sm outline-none focus:border-brand-400"
          >
            <option value="">Select JD...</option>
            {jds.map((jd: any) => (
              <option key={jd.id} value={jd.id}>{jd.title} - {jd.client}</option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-3 border-t border-border px-6 py-5">
          <button onClick={onClose} disabled={saving} className="rounded-xl border border-border px-5 py-3 text-sm font-medium hover:bg-accent disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={handleLink}
            disabled={saving || !jdId}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
            Link JD
          </button>
        </div>
      </div>
    </div>
  )
}

function ManualCandidateModal({ onClose, jds }: { onClose: () => void; jds: any[] }) {
  const qc = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    location: '',
    currentTitle: '',
    currentCompany: '',
    totalExperienceYears: '',
    noticePeriodDays: '',
    expectedSalary: '',
    linkedinUrl: '',
    source: 'Manual',
    jdId: '',
    skills: '',
    summary: '',
  })

  const setField = (field: keyof typeof form, value: string) => setForm(current => ({ ...current, [field]: value }))
  const numberOrNull = (value: string) => value.trim() ? Number(value) : null

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      const response = await fetch('/api/candidates/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          jdId: form.jdId || null,
          totalExperienceYears: numberOrNull(form.totalExperienceYears),
          noticePeriodDays: numberOrNull(form.noticePeriodDays),
          expectedSalary: numberOrNull(form.expectedSalary),
          skills: form.skills.split(',').map(skill => skill.trim()).filter(Boolean),
        }),
      })
      const data = await response.json()
      if (!data.success) {
        toast.error(data.error || 'Unable to create candidate')
        return
      }
      toast.success('Candidate created')
      qc.invalidateQueries({ queryKey: ['candidates'] })
      onClose()
    } catch {
      toast.error('Unable to create candidate')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[1px]">
      <div className="max-h-[92vh] w-full max-w-[820px] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold">Manual candidate</h2>
            <p className="mt-1 text-sm text-slate-500">Create a HR-verified profile without resume parsing.</p>
          </div>
          <button onClick={onClose} disabled={saving} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={save} className="max-h-[calc(92vh-88px)] space-y-5 overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ManualField required label="Full name" value={form.fullName} onChange={value => setField('fullName', value)} />
            <ManualField label="Email" value={form.email} onChange={value => setField('email', value)} type="email" />
            <ManualField label="Phone" value={form.phone} onChange={value => setField('phone', value)} />
            <ManualField label="Location" value={form.location} onChange={value => setField('location', value)} />
            <ManualField label="Current title" value={form.currentTitle} onChange={value => setField('currentTitle', value)} />
            <ManualField label="Current company" value={form.currentCompany} onChange={value => setField('currentCompany', value)} />
            <ManualField label="Experience years" value={form.totalExperienceYears} onChange={value => setField('totalExperienceYears', value)} type="number" />
            <ManualField label="Notice period days" value={form.noticePeriodDays} onChange={value => setField('noticePeriodDays', value)} type="number" />
            <ManualField label="Expected salary" value={form.expectedSalary} onChange={value => setField('expectedSalary', value)} type="number" />
            <ManualField label="LinkedIn URL" value={form.linkedinUrl} onChange={value => setField('linkedinUrl', value)} />
          </div>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-600">Link to JD</span>
            <select value={form.jdId} onChange={event => setField('jdId', event.target.value)} className="h-12 w-full rounded-xl border border-input bg-slate-50 px-4 text-sm outline-none focus:border-brand-400">
              <option value="">No JD yet</option>
              {jds.map((jd: any) => <option key={jd.id} value={jd.id}>{jd.title} - {jd.client}</option>)}
            </select>
          </label>
          <ManualField label="Skills" value={form.skills} onChange={value => setField('skills', value)} placeholder="Java, React, SQL" />
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-600">Profile summary</span>
            <textarea value={form.summary} onChange={event => setField('summary', event.target.value)} rows={4} className="w-full resize-none rounded-xl border border-input bg-slate-50 px-4 py-3 text-sm outline-none focus:border-brand-400" />
          </label>
          <div className="flex justify-end gap-3 border-t border-border pt-5">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-border px-5 py-3 text-sm font-medium hover:bg-accent disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save candidate
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ManualField({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  required?: boolean
  placeholder?: string
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-600">{label}</span>
      <input required={required} type={type} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="h-12 w-full rounded-xl border border-input bg-slate-50 px-4 text-sm outline-none focus:border-brand-400" />
    </label>
  )
}

export default function CandidatesPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const [internal, setInternal] = useState<boolean | null>(null)
  const [linkCandidate, setLinkCandidate] = useState<any | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['candidates', page, search, internal],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '20',
        ...(search && { search }),
        ...(internal !== null && { internal: String(internal) }),
      })
      const response = await fetch(`/api/candidates?${params}`)
      return response.json()
    },
  })

  const { data: jdsData } = useQuery({
    queryKey: ['jds-select'],
    queryFn: async () => {
      const response = await fetch('/api/jds?pageSize=100')
      return response.json()
    },
  })

  const candidates = data?.data || []
  const pagination = data?.pagination || {}
  const jds = jdsData?.data || []

  const handleDelete = async (candidate: any) => {
    if (!window.confirm(`Delete ${candidate.fullName}? This removes linked workflow records and uploaded resumes.`)) return

    setDeletingId(candidate.id)
    try {
      const response = await fetch(`/api/candidates/${candidate.id}`, { method: 'DELETE' })
      const data = await response.json()
      if (!data.success) {
        toast.error(data.error || 'Unable to delete candidate')
        return
      }

      toast.success('Candidate deleted')
      qc.invalidateQueries({ queryKey: ['candidates'] })
    } catch {
      toast.error('Unable to delete candidate')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-[1408px] space-y-5 px-2 py-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">Candidates</h1>
          <p className="mt-2 text-base text-slate-500">
            {pagination.total ?? 0} candidates - external sourcing & internal diversion
          </p>
        </div>
        <div className="mt-2 flex flex-wrap gap-3">
          <button
            onClick={() => setShowManual(true)}
            className="flex items-center gap-2 rounded-xl border border-border px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-accent"
          >
            <Plus size={16} /> Manual candidate
          </button>
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-700"
          >
            <Upload size={16} /> Upload resumes
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex h-12 w-full max-w-[472px] items-center gap-3 rounded-xl border border-border bg-card px-4">
          <Search size={18} className="text-slate-400" />
          <input
            value={search}
            onChange={event => { setSearch(event.target.value); setPage(1) }}
            placeholder="Search candidates..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
        </div>
        <select
          value={internal === null ? '' : String(internal)}
          onChange={event => setInternal(event.target.value === '' ? null : event.target.value === 'true')}
          className="h-12 rounded-xl border border-border bg-card px-4 text-sm outline-none"
        >
          <option value="">All types</option>
          <option value="false">External</option>
          <option value="true">Internal</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-slate-50">
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-400">Candidate</th>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-400">Role / Company</th>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-400">Stage</th>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-400">Score</th>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-400">Flags</th>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-400">Added</th>
              <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wide text-slate-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 8 }).map((_, index) => (
              <tr key={index} className="h-[78px] border-b border-border animate-pulse">
                <td className="px-6"><div className="h-4 w-40 rounded bg-muted" /></td>
                <td className="px-6"><div className="h-4 w-36 rounded bg-muted" /></td>
                <td className="px-6"><div className="h-5 w-24 rounded bg-muted" /></td>
                <td className="px-6"><div className="h-5 w-10 rounded bg-muted" /></td>
                <td className="px-6"><div className="h-4 w-12 rounded bg-muted" /></td>
                <td className="px-6"><div className="h-4 w-20 rounded bg-muted" /></td>
                <td className="px-6"><div className="ml-auto h-9 w-36 rounded bg-muted" /></td>
              </tr>
            ))}
            {!isLoading && candidates.length === 0 && (
              <tr>
                <td colSpan={7} className="py-14 text-center text-muted-foreground">No candidates found</td>
              </tr>
            )}
            {candidates.map((candidate: any) => {
              const entry = candidate.pipelineEntries?.[0]
              const score = entry?.compositeScore ? Math.round(Number(entry.compositeScore)) : null
              return (
                <tr key={candidate.id} className="h-[78px] border-b border-border last:border-0 hover:bg-slate-50/60">
                  <td className="px-6 py-4">
                    <Link href={`/candidates/${candidate.id}`} className="flex items-center gap-4">
                      <div className={cn(
                        'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                        candidate.isInternal ? 'bg-teal-50 text-teal-700' : 'bg-red-50 text-red-600',
                      )}>
                        {initials(candidate.fullName)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 font-semibold text-slate-950">
                          <span className="truncate">{candidate.fullName}</span>
                          {candidate.isInternal && (
                            <span className="rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-violet-700">Internal</span>
                          )}
                        </div>
                        <div className="truncate text-sm text-slate-400">{candidate.email || candidate.source}</div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-950">{candidate.currentTitle || '-'}</div>
                    <div className="text-sm text-slate-400">{candidate.currentCompany || '-'}</div>
                  </td>
                  <td className="px-6 py-4">
                    {entry ? (
                      <span className={cn('rounded-md px-2.5 py-1 text-xs font-bold uppercase', stageColor(entry.stage))}>
                        {stageLabel(entry.stage)}
                      </span>
                    ) : <span className="text-sm text-slate-400">No JD</span>}
                  </td>
                  <td className="px-6 py-4">
                    {score !== null ? (
                      <span className={cn('rounded-md px-3 py-1 text-xs font-bold', scoreColor(score))}>{score}</span>
                    ) : <span className="text-slate-400">-</span>}
                  </td>
                  <td className="px-6 py-4">
                    {candidate._count.redFlags > 0 ? (
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600">
                        <Flag size={14} /> {candidate._count.redFlags} {candidate._count.redFlags === 1 ? 'flag' : 'flags'}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-400">{formatDate(candidate.createdAt)}</td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setLinkCandidate(candidate)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-slate-600 hover:bg-accent"
                      >
                        <Link2 size={14} /> Link JD
                      </button>
                      <button
                        onClick={() => handleDelete(candidate)}
                        disabled={deletingId === candidate.id}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        {deletingId === candidate.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-6 py-4">
            <span className="text-sm text-muted-foreground">Page {pagination.page} of {pagination.totalPages} - {pagination.total} results</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(value => Math.max(1, value - 1))}
                disabled={pagination.page <= 1}
                className="rounded-lg border border-border p-2 hover:bg-accent disabled:opacity-40"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                onClick={() => setPage(value => Math.min(pagination.totalPages, value + 1))}
                disabled={pagination.page >= pagination.totalPages}
                className="rounded-lg border border-border p-2 hover:bg-accent disabled:opacity-40"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} jds={jds} />}
      {showManual && <ManualCandidateModal onClose={() => setShowManual(false)} jds={jds} />}
      {linkCandidate && <LinkJdModal candidate={linkCandidate} jds={jds} onClose={() => setLinkCandidate(null)} />}
    </div>
  )
}
