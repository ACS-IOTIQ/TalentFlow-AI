'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Briefcase,
  CalendarDays,
  CheckCircle,
  ClipboardCheck,
  Download,
  FileUp,
  Loader2,
  Search,
  Trash2,
  UploadCloud,
  UserCheck,
} from 'lucide-react'
import { cn, formatDate, initials, stageColor, stageLabel } from '@/lib/utils'

const STATUS_OPTIONS = [
  ['', 'All'],
  ['DOCUMENT_COLLECTION', 'Documents'],
  ['JOINING_SCHEDULED', 'Joining scheduled'],
  ['JOINED', 'Joined'],
  ['ON_HOLD', 'On hold'],
  ['COMPLETED', 'Completed'],
]

const STATUS_LABEL: Record<string, string> = {
  DOCUMENT_COLLECTION: 'Document collection',
  JOINING_SCHEDULED: 'Joining scheduled',
  JOINED: 'Joined',
  ON_HOLD: 'On hold',
  COMPLETED: 'Completed',
}

const STATUS_STYLE: Record<string, string> = {
  DOCUMENT_COLLECTION: 'bg-amber-50 text-amber-700 border-amber-100',
  JOINING_SCHEDULED: 'bg-blue-50 text-blue-700 border-blue-100',
  JOINED: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  ON_HOLD: 'bg-slate-100 text-slate-700 border-slate-200',
  COMPLETED: 'bg-green-50 text-green-700 border-green-100',
}

function emptyForm() {
  return {
    dateOfJoining: '',
    employmentType: '',
    workLocation: '',
    employeeCode: '',
    designation: '',
    department: '',
    reportingManager: '',
    salaryOrBillingNotes: '',
    joiningStatus: 'DOCUMENT_COLLECTION',
    hrNotes: '',
  }
}

function dateInput(value?: string | null) {
  return value ? value.slice(0, 10) : ''
}

function progressFor(onboarding: any) {
  const required = onboarding?.items?.filter((item: any) => item.isRequired) || []
  const completed = required.filter((item: any) => item.completed).length
  return {
    completed,
    total: required.length,
    percent: required.length ? Math.round((completed / required.length) * 100) : 0,
  }
}

function approvedDate(onboarding: any) {
  const approved = onboarding?.pipelineEntry?.submissions?.find((submission: any) => submission.status === 'APPROVED')
  return approved?.approvedAt || approved?.updatedAt || approved?.createdAt
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">{children}</span>
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold text-slate-800">{value || '-'}</div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('inline-flex rounded-full border px-2.5 py-1 text-xs font-bold', STATUS_STYLE[status] || STATUS_STYLE.DOCUMENT_COLLECTION)}>
      {STATUS_LABEL[status] || status}
    </span>
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

export default function OnboardingPage() {
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadingItemId, setUploadingItemId] = useState('')
  const [deletingDocumentId, setDeletingDocumentId] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [items, setItems] = useState<any[]>([])

  const { data, isLoading } = useQuery({
    queryKey: ['onboarding', search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: '1',
        pageSize: '100',
        ...(search.trim() && { search: search.trim() }),
        ...(statusFilter && { status: statusFilter }),
      })
      const response = await fetch(`/api/onboarding?${params}`)
      return response.json()
    },
  })

  const onboardings = useMemo(() => data?.data || [], [data?.data])
  const selected = useMemo(
    () => onboardings.find((item: any) => item.id === selectedId) || onboardings[0],
    [onboardings, selectedId],
  )

  useEffect(() => {
    if (!selected) {
      setSelectedId('')
      return
    }
    if (!selectedId || !onboardings.some((item: any) => item.id === selectedId)) {
      setSelectedId(selected.id)
    }
  }, [onboardings, selected, selectedId])

  useEffect(() => {
    if (!selected) return
    setForm({
      dateOfJoining: dateInput(selected.dateOfJoining),
      employmentType: selected.employmentType || '',
      workLocation: selected.workLocation || '',
      employeeCode: selected.employeeCode || '',
      designation: selected.designation || '',
      department: selected.department || '',
      reportingManager: selected.reportingManager || '',
      salaryOrBillingNotes: selected.salaryOrBillingNotes || '',
      joiningStatus: selected.joiningStatus || 'DOCUMENT_COLLECTION',
      hrNotes: selected.hrNotes || '',
    })
    setItems((selected.items || []).map((item: any) => ({ ...item, dueDate: dateInput(item.dueDate), notes: item.notes || '' })))
  }, [selected])

  const metrics = useMemo(() => {
    const completed = onboardings.filter((item: any) => item.isComplete).length
    const scheduled = onboardings.filter((item: any) => item.joiningStatus === 'JOINING_SCHEDULED').length
    const pendingDocs = onboardings.filter((item: any) => {
      const progress = progressFor(item)
      return !item.isComplete && progress.completed < progress.total
    }).length
    return { total: onboardings.length, completed, scheduled, pendingDocs }
  }, [onboardings])

  const selectedProgress = progressFor(selected)
  const documentsByItem = useMemo(() => {
    const map: Record<string, any[]> = {}
    for (const document of selected?.documents || []) {
      if (!document.itemId) continue
      map[document.itemId] = [...(map[document.itemId] || []), document]
    }
    return map
  }, [selected?.documents])

  const setField = (field: keyof typeof form, value: string) => setForm(current => ({ ...current, [field]: value }))
  const setItemField = (id: string, field: string, value: any) => {
    setItems(current => current.map(item => item.id === id ? { ...item, [field]: value } : item))
  }

  const refresh = () => qc.invalidateQueries({ queryKey: ['onboarding'] })

  const save = async (complete = false) => {
    if (!selected) return
    setSaving(true)
    try {
      const response = await fetch(`/api/onboarding/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          ...(complete && { isComplete: true }),
          items: items.map(item => ({
            id: item.id,
            completed: Boolean(item.completed),
            dueDate: item.dueDate || null,
            notes: item.notes || null,
          })),
        }),
      })
      const result = await response.json()
      if (!result.success) {
        toast.error(result.error || 'Unable to save onboarding')
        return
      }
      toast.success(complete ? 'Onboarding completed' : 'Onboarding saved')
      await refresh()
    } catch {
      toast.error('Unable to save onboarding')
    } finally {
      setSaving(false)
    }
  }

  const upload = async (item: any, fileList: FileList | null) => {
    if (!selected || !fileList?.length) return
    setUploadingItemId(item.id)
    try {
      const body = new FormData()
      body.append('documentType', item.itemName)
      body.append('itemId', item.id)
      for (const file of Array.from(fileList)) body.append('files', file)

      const response = await fetch(`/api/onboarding/${selected.id}/documents`, { method: 'POST', body })
      const result = await response.json()
      if (!result.success) {
        toast.error(result.error || 'Unable to upload document')
        return
      }
      toast.success('Document uploaded')
      await refresh()
    } catch {
      toast.error('Unable to upload document')
    } finally {
      setUploadingItemId('')
    }
  }

  const removeDocument = async (document: any) => {
    if (!selected) return
    setDeletingDocumentId(document.id)
    try {
      const response = await fetch(`/api/onboarding/${selected.id}/documents/${document.id}`, { method: 'DELETE' })
      const result = await response.json()
      if (!result.success) {
        toast.error(result.error || 'Unable to delete document')
        return
      }
      toast.success('Document deleted')
      await refresh()
    } catch {
      toast.error('Unable to delete document')
    } finally {
      setDeletingDocumentId('')
    }
  }

  return (
    <div className="mx-auto max-w-[1480px] space-y-6 px-2 py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">Onboarding</h1>
          <p className="mt-2 text-base text-slate-500">HR-managed joining details and employee documents after client acceptance.</p>
        </div>
        {selected && (
          <button
            onClick={() => save(true)}
            disabled={saving || selected.isComplete}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <UserCheck size={16} />}
            Mark onboarded
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Metric label="Total" value={metrics.total} icon={<ClipboardCheck size={18} />} tone="bg-brand-50 text-brand-600" />
        <Metric label="Pending docs" value={metrics.pendingDocs} icon={<FileUp size={18} />} tone="bg-amber-50 text-amber-600" />
        <Metric label="Scheduled" value={metrics.scheduled} icon={<CalendarDays size={18} />} tone="bg-blue-50 text-blue-600" />
        <Metric label="Completed" value={metrics.completed} icon={<CheckCircle size={18} />} tone="bg-emerald-50 text-emerald-600" />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map(([value, label]) => (
              <button
                key={value}
                onClick={() => setStatusFilter(value)}
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
              onChange={event => setSearch(event.target.value)}
              placeholder="Search employee, role, code..."
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </div>
        </div>
      </div>

      {!isLoading && !onboardings.length && (
        <div className="rounded-2xl border border-border bg-card py-20 text-center shadow-sm">
          <ClipboardCheck size={44} className="mx-auto mb-4 text-slate-300" />
          <p className="font-medium text-slate-600">No onboarding records found</p>
          <p className="mt-1 text-sm text-slate-500">Approved client submissions will appear here automatically.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_1fr]">
        <div className="space-y-3">
          {isLoading && Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-2xl bg-muted" />
          ))}
          {onboardings.map((onboarding: any) => {
            const candidate = onboarding.pipelineEntry?.candidate
            const jd = onboarding.pipelineEntry?.jd
            const progress = progressFor(onboarding)
            return (
              <button
                key={onboarding.id}
                onClick={() => setSelectedId(onboarding.id)}
                className={cn(
                  'w-full rounded-2xl border bg-card p-4 text-left shadow-sm transition-colors hover:bg-slate-50',
                  selected?.id === onboarding.id ? 'border-brand-300 ring-2 ring-brand-100' : 'border-border',
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                    candidate?.isInternal ? 'bg-pink-100 text-pink-700' : 'bg-brand-100 text-brand-700')}>
                    {initials(candidate?.fullName || '??')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-slate-950">{candidate?.fullName || 'Unknown candidate'}</div>
                    <div className="mt-0.5 truncate text-sm text-slate-500">{jd?.title || 'Role'} - {jd?.client || 'Client'}</div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <StatusBadge status={onboarding.joiningStatus} />
                      <span className={cn('rounded-full px-2.5 py-1 text-xs font-bold', stageColor(onboarding.pipelineEntry?.stage || ''))}>
                        {stageLabel(onboarding.pipelineEntry?.stage || '-')}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-500">
                  <div>DOJ: <span className="font-semibold text-slate-700">{onboarding.dateOfJoining ? formatDate(onboarding.dateOfJoining) : '-'}</span></div>
                  <div>Docs: <span className="font-semibold text-slate-700">{progress.completed}/{progress.total}</span></div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-brand-600" style={{ width: `${progress.percent}%` }} />
                </div>
              </button>
            )
          })}
        </div>

        {selected && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-4">
                  <div className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold',
                    selected.pipelineEntry?.candidate?.isInternal ? 'bg-pink-100 text-pink-700' : 'bg-brand-100 text-brand-700')}>
                    {initials(selected.pipelineEntry?.candidate?.fullName || '??')}
                  </div>
                  <div className="min-w-0">
                    <Link href={`/candidates/${selected.pipelineEntry?.candidate?.id}`} className="text-xl font-bold text-slate-950 hover:text-brand-600">
                      {selected.pipelineEntry?.candidate?.fullName || 'Unknown candidate'}
                    </Link>
                    <div className="mt-1 text-sm text-slate-500">{selected.pipelineEntry?.jd?.title} - {selected.pipelineEntry?.jd?.client}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge status={form.joiningStatus} />
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                    {selectedProgress.percent}% docs complete
                  </span>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
                <Info label="Approved" value={approvedDate(selected) ? formatDate(approvedDate(selected)) : '-'} />
                <Info label="Email" value={selected.pipelineEntry?.candidate?.email} />
                <Info label="Phone" value={selected.pipelineEntry?.candidate?.phone} />
                <Info label="HR owner" value={selected.managedBy?.name} />
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">Employment details</h2>
                  <p className="mt-1 text-sm text-slate-500">Stored here only for HR onboarding management.</p>
                </div>
                <button
                  onClick={() => save(false)}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl border border-brand-200 px-4 py-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                  Save
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <label>
                  <FieldLabel>Date of joining</FieldLabel>
                  <input type="date" value={form.dateOfJoining} onChange={event => setField('dateOfJoining', event.target.value)} className="h-11 w-full rounded-xl border border-input bg-slate-50 px-3 text-sm outline-none focus:border-brand-400" />
                </label>
                <label>
                  <FieldLabel>Joining status</FieldLabel>
                  <select value={form.joiningStatus} onChange={event => setField('joiningStatus', event.target.value)} className="h-11 w-full rounded-xl border border-input bg-slate-50 px-3 text-sm outline-none focus:border-brand-400">
                    {STATUS_OPTIONS.filter(([value]) => value).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label>
                  <FieldLabel>Employee code</FieldLabel>
                  <input value={form.employeeCode} onChange={event => setField('employeeCode', event.target.value)} placeholder="Internal reference" className="h-11 w-full rounded-xl border border-input bg-slate-50 px-3 text-sm outline-none focus:border-brand-400" />
                </label>
                <label>
                  <FieldLabel>Employment type</FieldLabel>
                  <input value={form.employmentType} onChange={event => setField('employmentType', event.target.value)} placeholder="Full-time, contract..." className="h-11 w-full rounded-xl border border-input bg-slate-50 px-3 text-sm outline-none focus:border-brand-400" />
                </label>
                <label>
                  <FieldLabel>Designation</FieldLabel>
                  <input value={form.designation} onChange={event => setField('designation', event.target.value)} className="h-11 w-full rounded-xl border border-input bg-slate-50 px-3 text-sm outline-none focus:border-brand-400" />
                </label>
                <label>
                  <FieldLabel>Department</FieldLabel>
                  <input value={form.department} onChange={event => setField('department', event.target.value)} className="h-11 w-full rounded-xl border border-input bg-slate-50 px-3 text-sm outline-none focus:border-brand-400" />
                </label>
                <label>
                  <FieldLabel>Work location</FieldLabel>
                  <input value={form.workLocation} onChange={event => setField('workLocation', event.target.value)} className="h-11 w-full rounded-xl border border-input bg-slate-50 px-3 text-sm outline-none focus:border-brand-400" />
                </label>
                <label>
                  <FieldLabel>Reporting manager</FieldLabel>
                  <input value={form.reportingManager} onChange={event => setField('reportingManager', event.target.value)} className="h-11 w-full rounded-xl border border-input bg-slate-50 px-3 text-sm outline-none focus:border-brand-400" />
                </label>
                <label className="md:col-span-3">
                  <FieldLabel>Salary or billing notes</FieldLabel>
                  <textarea value={form.salaryOrBillingNotes} onChange={event => setField('salaryOrBillingNotes', event.target.value)} rows={3} className="w-full resize-none rounded-xl border border-input bg-slate-50 px-3 py-3 text-sm outline-none focus:border-brand-400" />
                </label>
                <label className="md:col-span-3">
                  <FieldLabel>HR notes</FieldLabel>
                  <textarea value={form.hrNotes} onChange={event => setField('hrNotes', event.target.value)} rows={3} className="w-full resize-none rounded-xl border border-input bg-slate-50 px-3 py-3 text-sm outline-none focus:border-brand-400" />
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">Required documents</h2>
                  <p className="mt-1 text-sm text-slate-500">{selectedProgress.completed} of {selectedProgress.total} required items complete.</p>
                </div>
                <Briefcase size={20} className="text-slate-400" />
              </div>

              <div className="space-y-3">
                {items.map(item => {
                  const itemDocuments = documentsByItem[item.id] || []
                  return (
                    <div key={item.id} className="rounded-xl border border-border p-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="flex min-w-0 flex-1 items-center gap-3">
                          <input
                            type="checkbox"
                            checked={Boolean(item.completed)}
                            onChange={event => setItemField(item.id, 'completed', event.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-brand-600"
                          />
                          <span className="truncate text-sm font-semibold text-slate-800">{item.itemName}</span>
                          {item.isRequired && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600">Required</span>}
                        </label>
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-accent">
                          {uploadingItemId === item.id ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                          Upload
                          <input
                            type="file"
                            multiple
                            className="hidden"
                            onChange={event => {
                              upload(item, event.currentTarget.files)
                              event.currentTarget.value = ''
                            }}
                          />
                        </label>
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[180px_1fr]">
                        <input type="date" value={item.dueDate || ''} onChange={event => setItemField(item.id, 'dueDate', event.target.value)} className="h-10 rounded-lg border border-input bg-slate-50 px-3 text-sm outline-none focus:border-brand-400" />
                        <input value={item.notes || ''} onChange={event => setItemField(item.id, 'notes', event.target.value)} placeholder="Notes" className="h-10 rounded-lg border border-input bg-slate-50 px-3 text-sm outline-none focus:border-brand-400" />
                      </div>
                      {itemDocuments.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {itemDocuments.map(document => (
                            <span key={document.id} className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                              {document.fileName}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">Uploaded documents</h2>
                  <p className="mt-1 text-sm text-slate-500">{selected.documents?.length || 0} files stored for this employee candidate.</p>
                </div>
                <Download size={20} className="text-slate-400" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-slate-50">
                      <th className="px-5 py-3 text-left font-semibold text-slate-500">Document</th>
                      <th className="px-5 py-3 text-left font-semibold text-slate-500">Type</th>
                      <th className="px-5 py-3 text-left font-semibold text-slate-500">Uploaded</th>
                      <th className="px-5 py-3 text-right font-semibold text-slate-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.documents?.length ? selected.documents.map((document: any) => (
                      <tr key={document.id} className="border-b border-border last:border-0">
                        <td className="px-5 py-4 font-medium text-slate-800">{document.fileName}</td>
                        <td className="px-5 py-4 text-slate-500">{document.documentType}</td>
                        <td className="px-5 py-4 text-slate-500">{formatDate(document.createdAt)} by {document.uploadedBy?.name || 'HR'}</td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <a href={`/api/onboarding/${selected.id}/documents/${document.id}/download`} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-accent">
                              <Download size={14} /> Download
                            </a>
                            <button onClick={() => removeDocument(document)} disabled={deletingDocumentId === document.id} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
                              {deletingDocumentId === document.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-slate-500">No onboarding documents uploaded yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
