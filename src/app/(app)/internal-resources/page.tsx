'use client'
import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArrowLeftRight,
  Bot,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Trophy,
  X,
} from 'lucide-react'
import { cn, initials } from '@/lib/utils'

type ResourceForm = {
  id?: string
  employeeIdRef: string
  fullName: string
  email: string
  phone: string
  location: string
  currentTitle: string
  skills: string
  jdId: string
  billingRate: string
  acsMonthlyCost: string
  allocationPercent: string
  availability: string
  diversionType: 'FULL' | 'PARTIAL' | 'TEMPORARY'
  diversionNotes: string
  aiAssessment?: any
}

const emptyForm: ResourceForm = {
  employeeIdRef: '',
  fullName: '',
  email: '',
  phone: '',
  location: '',
  currentTitle: '',
  skills: '',
  jdId: '',
  billingRate: '',
  acsMonthlyCost: '',
  allocationPercent: '100',
  availability: '',
  diversionType: 'FULL',
  diversionNotes: '',
}

const diversionBadge: Record<string, string> = {
  FULL: 'bg-blue-100 text-blue-700',
  PARTIAL: 'bg-amber-100 text-amber-700',
  TEMPORARY: 'bg-purple-100 text-purple-700',
}

function money(value: unknown) {
  const number = Number(value || 0)
  return `AED ${number.toLocaleString()}`
}

function getDiversion(resource: any) {
  return resource.parsedData?.diversion || {}
}

function toPayload(form: ResourceForm) {
  return {
    employeeIdRef: form.employeeIdRef,
    fullName: form.fullName,
    email: form.email,
    phone: form.phone,
    location: form.location,
    currentTitle: form.currentTitle,
    skills: form.skills,
    jdId: form.jdId,
    billingRate: Number(form.billingRate || 0),
    acsMonthlyCost: Number(form.acsMonthlyCost || 0),
    allocationPercent: Number(form.allocationPercent || 100),
    availability: form.availability,
    diversionType: form.diversionType,
    diversionNotes: form.diversionNotes,
    aiAssessment: form.aiAssessment,
  }
}

function formFromResource(resource: any): ResourceForm {
  const diversion = getDiversion(resource)
  return {
    id: resource.id,
    employeeIdRef: resource.employeeIdRef || '',
    fullName: resource.fullName || '',
    email: resource.email || '',
    phone: resource.phone || '',
    location: resource.location || '',
    currentTitle: resource.currentTitle || '',
    skills: diversion.skills || resource.skills?.map((skill: any) => skill.skillName).join(', ') || '',
    jdId: resource.pipelineEntries?.[0]?.jd?.id || '',
    billingRate: String(diversion.billingRate || ''),
    acsMonthlyCost: String(resource.acsMonthlyCost || diversion.acsMonthlyCost || ''),
    allocationPercent: String(diversion.allocationPercent || 100),
    availability: diversion.availability || '',
    diversionType: resource.diversionType || 'FULL',
    diversionNotes: resource.diversionNotes || '',
    aiAssessment: diversion.aiAssessment || undefined,
  }
}

function DivertModal({ resource, onClose }: { resource?: any; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<ResourceForm>(resource ? formFromResource(resource) : emptyForm)
  const [saving, setSaving] = useState(false)
  const [assessing, setAssessing] = useState(false)

  const { data: jdsData } = useQuery({
    queryKey: ['jds-active'],
    queryFn: async () => {
      const response = await fetch('/api/jds?status=POSTED&pageSize=50')
      return response.json()
    },
  })

  const margin = Number(form.billingRate || 0) - Number(form.acsMonthlyCost || 0)

  const update = (patch: Partial<ResourceForm>) => setForm(current => ({ ...current, ...patch }))

  const assess = async () => {
    if (!form.jdId) {
      toast.error('Select a target JD before AI assessment')
      return
    }

    setAssessing(true)
    try {
      const response = await fetch('/api/internal-resources?action=assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toPayload(form)),
      })
      const data = await response.json()
      if (data.success) {
        update({
          diversionType: data.data.recommendedDiversionType,
          allocationPercent: String(data.data.recommendedAllocationPercent),
          diversionNotes: data.data.suggestedNotes || data.data.summary || form.diversionNotes,
          aiAssessment: data.data,
        })
        toast.success(`AI fit assessment: ${data.data.fitScore}/100`)
      } else {
        toast.error(data.error)
      }
    } catch {
      toast.error('AI assessment failed')
    } finally {
      setAssessing(false)
    }
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      const response = await fetch(resource ? `/api/internal-resources/${resource.id}` : '/api/internal-resources', {
        method: resource ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toPayload(form)),
      })
      const data = await response.json()
      if (data.success) {
        toast.success(resource ? 'Resource updated' : 'Resource diverted successfully')
        qc.invalidateQueries({ queryKey: ['internal-resources'] })
        onClose()
      } else {
        toast.error(data.error)
      }
    } catch {
      toast.error('Unable to save resource')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[1px]">
      <div className="w-full max-w-[720px] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between border-b border-border px-7 py-6">
          <div>
            <h2 className="text-xl font-semibold">{resource ? 'Edit internal resource' : 'Divert internal resource'}</h2>
            <p className="mt-1 text-sm text-slate-500">Add an ACS employee to the Tahaluf pipeline</p>
          </div>
          <button onClick={onClose} disabled={saving} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit}>
          <div className="max-h-[65vh] space-y-5 overflow-y-auto p-7">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Employee ID *" value={form.employeeIdRef} onChange={value => update({ employeeIdRef: value })} placeholder="EMP017" required />
              <Field label="Full name *" value={form.fullName} onChange={value => update({ fullName: value })} required />
              <Field label="Work email" type="email" value={form.email} onChange={value => update({ email: value })} placeholder="emp@acstechnologies.com" />
              <Field label="Phone" value={form.phone} onChange={value => update({ phone: value })} placeholder="+971 ..." />
              <Field label="Current title" value={form.currentTitle} onChange={value => update({ currentTitle: value })} placeholder="Cloud Architect" />
              <Field label="Location" value={form.location} onChange={value => update({ location: value })} placeholder="Dubai, UAE" />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-600">Skills</label>
              <input
                value={form.skills}
                onChange={event => update({ skills: event.target.value })}
                placeholder="AWS, Kubernetes, Terraform"
                className="w-full rounded-xl border border-input bg-slate-50 px-4 py-3 text-sm outline-none focus:border-brand-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-600">Target JD *</label>
              <select
                required
                value={form.jdId}
                onChange={event => update({ jdId: event.target.value })}
                className="w-full rounded-xl border border-input bg-slate-50 px-4 py-3 text-sm outline-none focus:border-brand-400"
              >
                <option value="">Select JD...</option>
                {jdsData?.data?.map((jd: any) => (
                  <option key={jd.id} value={jd.id}>{jd.title} - {jd.client}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <Field label="Billing (AED/mo) *" type="number" value={form.billingRate} onChange={value => update({ billingRate: value })} placeholder="30000" required />
              <Field label="ACS cost (AED/mo) *" type="number" value={form.acsMonthlyCost} onChange={value => update({ acsMonthlyCost: value })} placeholder="22000" required />
              <Field label="Allocation %" type="number" value={form.allocationPercent} onChange={value => update({ allocationPercent: value })} placeholder="100" required />
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-600">Diversion type</label>
                <select
                  value={form.diversionType}
                  onChange={event => update({ diversionType: event.target.value as ResourceForm['diversionType'] })}
                  className="w-full rounded-xl border border-input bg-slate-50 px-4 py-3 text-sm outline-none focus:border-brand-400"
                >
                  <option value="FULL">Full</option>
                  <option value="PARTIAL">Partial</option>
                  <option value="TEMPORARY">Temporary</option>
                </select>
              </div>
            </div>

            <Field label="Availability" value={form.availability} onChange={value => update({ availability: value })} placeholder="Immediate after notice" />

            {form.billingRate && form.acsMonthlyCost && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
                <span className="text-slate-500">Estimated monthly margin: </span>
                <span className="font-bold text-emerald-700">{money(margin)}</span>
              </div>
            )}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-sm font-semibold text-slate-600">Notes</label>
                <button
                  type="button"
                  onClick={assess}
                  disabled={assessing}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50"
                >
                  {assessing ? <Loader2 size={13} className="animate-spin" /> : <Bot size={13} />}
                  AI assess
                </button>
              </div>
              <textarea
                value={form.diversionNotes}
                onChange={event => update({ diversionNotes: event.target.value })}
                rows={4}
                className="w-full resize-none rounded-xl border border-input bg-slate-50 px-4 py-3 text-sm outline-none focus:border-brand-400"
                placeholder="Context for the diversion..."
              />
            </div>

            {form.aiAssessment && (
              <div className="rounded-xl border border-brand-100 bg-brand-50 p-4 text-sm">
                <div className="mb-2 font-semibold text-brand-800">AI fit score: {form.aiAssessment.fitScore}/100</div>
                <div className="text-slate-600">{form.aiAssessment.summary}</div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 border-t border-border px-7 py-5">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-border px-5 py-3 text-sm font-medium hover:bg-accent disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-700 disabled:opacity-50">
              {saving && <Loader2 size={16} className="animate-spin" />}
              {resource ? 'Save changes' : 'Divert resource'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function fitBadgeClass(fitScore: number) {
  if (fitScore >= 75) return 'bg-emerald-100 text-emerald-700'
  if (fitScore >= 50) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

function AnalyzeModal({ onClose, onDivert }: { onClose: () => void; onDivert: (seed: any) => void }) {
  const [jdId, setJdId] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [forceReanalyze, setForceReanalyze] = useState(false)
  const [result, setResult] = useState<{ jd: any; results: any[]; analyzed: number; skippedCached: number; errors: number } | null>(null)

  const { data: jdsData } = useQuery({
    queryKey: ['jds-active'],
    queryFn: async () => {
      const response = await fetch('/api/jds?status=POSTED&pageSize=50')
      return response.json()
    },
  })

  const analyze = async () => {
    if (!jdId) {
      toast.error('Select a JD to analyze against')
      return
    }

    setAnalyzing(true)
    setResult(null)
    try {
      const response = await fetch('/api/internal-resources?action=analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jdId, force: forceReanalyze }),
      })
      const data = await response.json()
      if (data.success) {
        setResult(data.data)
        if (!data.data.results.length) toast.error('No internal resources available to analyze')
      } else {
        toast.error(data.error)
      }
    } catch {
      toast.error('AI analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  const divertCandidate = (candidate: any) => {
    onDivert({
      id: candidate.candidateId,
      employeeIdRef: candidate.employeeIdRef,
      fullName: candidate.fullName,
      email: candidate.email,
      currentTitle: candidate.currentTitle,
      acsMonthlyCost: candidate.acsMonthlyCost,
      diversionType: candidate.recommendedDiversionType,
      diversionNotes: candidate.suggestedNotes || candidate.summary,
      pipelineEntries: [{ jd: { id: jdId } }],
      parsedData: {
        diversion: {
          skills: candidate.skills,
          billingRate: candidate.billingRate,
          allocationPercent: candidate.recommendedAllocationPercent,
          aiAssessment: candidate,
        },
      },
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[1px]">
      <div className="flex max-h-[85vh] w-full max-w-[820px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between border-b border-border px-7 py-6">
          <div>
            <h2 className="text-xl font-semibold">Analyze internal resources</h2>
            <p className="mt-1 text-sm text-slate-500">Rank ACS employees by AI fit for a target JD</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto p-7">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="mb-2 block text-sm font-semibold text-slate-600">Target JD *</label>
              <select
                value={jdId}
                onChange={event => { setJdId(event.target.value); setResult(null) }}
                className="w-full rounded-xl border border-input bg-slate-50 px-4 py-3 text-sm outline-none focus:border-brand-400"
              >
                <option value="">Select JD...</option>
                {jdsData?.data?.map((jd: any) => (
                  <option key={jd.id} value={jd.id}>{jd.title} - {jd.client}</option>
                ))}
              </select>
            </div>
            <button
              onClick={analyze}
              disabled={analyzing || !jdId}
              className="flex h-[46px] items-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-700 disabled:opacity-50"
            >
              {analyzing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              Analyze
            </button>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={forceReanalyze}
              onChange={event => setForceReanalyze(event.target.checked)}
              className="rounded"
            />
            Force full re-analyze (ignore cached assessments for this JD)
          </label>

          {analyzing && (
            <div className="rounded-xl border border-border bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              Screening every internal resource against this JD...
            </div>
          )}

          {!analyzing && result && result.results.length > 0 && (
            <div className="space-y-3">
              <div className="text-sm text-slate-500">
                {result.analyzed} resource{result.analyzed === 1 ? '' : 's'} analyzed against <span className="font-semibold text-slate-700">{result.jd.title}</span>
                {result.skippedCached > 0 && `, ${result.skippedCached} from cache`}
                {result.errors > 0 && ` - ${result.errors} could not be scored`}
              </div>
              {result.results.map((candidate: any, index: number) => (
                <div key={candidate.candidateId} className="rounded-2xl border border-border p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {index === 0 && <Trophy size={15} className="text-amber-500" />}
                        <span className="font-bold text-slate-950">{candidate.fullName}</span>
                        <span className={cn('rounded-md px-2 py-1 text-[10px] font-bold uppercase', fitBadgeClass(candidate.fitScore))}>
                          Fit {candidate.fitScore}/100
                        </span>
                        <span className="rounded-md bg-violet-100 px-2 py-1 text-[10px] font-bold uppercase text-violet-700">
                          {candidate.recommendedDiversionType} - {candidate.recommendedAllocationPercent}%
                        </span>
                        {candidate.fromCache && (
                          <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase text-slate-500">
                            Cached
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-600">
                        {candidate.currentTitle || 'ACS Resource'} - EMP {candidate.employeeIdRef || '-'}
                      </div>
                      <p className="mt-2 text-sm text-slate-500">{candidate.summary}</p>
                      {candidate.strengths?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {candidate.strengths.slice(0, 4).map((strength: string, i: number) => (
                            <span key={i} className="rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-700">{strength}</span>
                          ))}
                        </div>
                      )}
                      {candidate.risks?.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {candidate.risks.slice(0, 3).map((risk: string, i: number) => (
                            <span key={i} className="rounded-md bg-red-50 px-2 py-1 text-xs text-red-600">{risk}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => divertCandidate(candidate)}
                      className="shrink-0 rounded-xl border border-brand-200 px-4 py-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-50"
                    >
                      Divert to this JD
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-border px-7 py-5">
          <button onClick={onClose} className="rounded-xl border border-border px-5 py-3 text-sm font-medium hover:bg-accent">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  required?: boolean
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-600">{label}</label>
      <input
        required={required}
        type={type}
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-input bg-slate-50 px-4 py-3 text-sm outline-none focus:border-brand-400"
      />
    </div>
  )
}

export default function InternalResourcesPage() {
  const [showModal, setShowModal] = useState(false)
  const [showAnalyzeModal, setShowAnalyzeModal] = useState(false)
  const [editingResource, setEditingResource] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['internal-resources'],
    queryFn: async () => {
      const response = await fetch('/api/internal-resources')
      return response.json()
    },
  })

  const resources = data?.data || []
  const filteredResources = useMemo(() => {
    return resources.filter((resource: any) => {
      const matchesSearch = !search || [resource.fullName, resource.email, resource.currentTitle, resource.employeeIdRef]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(search.toLowerCase()))
      const matchesType = !typeFilter || resource.diversionType === typeFilter
      return matchesSearch && matchesType
    })
  }, [resources, search, typeFilter])

  const remove = async (resource: any) => {
    if (!confirm(`Delete internal resource ${resource.fullName}?`)) return

    try {
      const response = await fetch(`/api/internal-resources/${resource.id}`, { method: 'DELETE' })
      const data = await response.json()
      if (data.success) {
        toast.success('Internal resource deleted')
        setSelectedIds(current => {
          const next = new Set(current)
          next.delete(resource.id)
          return next
        })
        qc.invalidateQueries({ queryKey: ['internal-resources'] })
      } else {
        toast.error(data.error)
      }
    } catch {
      toast.error('Unable to delete resource')
    }
  }

  const toggleSelected = (id: string) => {
    setSelectedIds(current => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allVisibleSelected = filteredResources.length > 0 && filteredResources.every((resource: any) => selectedIds.has(resource.id))

  const toggleSelectAllVisible = () => {
    setSelectedIds(current => {
      if (allVisibleSelected) {
        const next = new Set(current)
        filteredResources.forEach((resource: any) => next.delete(resource.id))
        return next
      }
      const next = new Set(current)
      filteredResources.forEach((resource: any) => next.add(resource.id))
      return next
    })
  }

  const removeSelected = async () => {
    const ids = Array.from(selectedIds)
    if (!ids.length) return
    if (!confirm(`Delete ${ids.length} selected internal resource${ids.length === 1 ? '' : 's'}?`)) return

    setBulkDeleting(true)
    try {
      const response = await fetch('/api/internal-resources', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      const data = await response.json()
      if (data.success) {
        toast.success(`${data.data.deleted} internal resource${data.data.deleted === 1 ? '' : 's'} deleted`)
        setSelectedIds(new Set())
        qc.invalidateQueries({ queryKey: ['internal-resources'] })
      } else {
        toast.error(data.error)
      }
    } catch {
      toast.error('Unable to delete selected resources')
    } finally {
      setBulkDeleting(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1408px] space-y-6 px-2 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">Internal resources</h1>
          <p className="mt-2 text-base text-slate-500">ACS employees diverted to the Tahaluf engagement</p>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <button
            onClick={() => setShowAnalyzeModal(true)}
            className="flex items-center gap-2 rounded-xl border border-brand-200 px-5 py-3 text-sm font-semibold text-brand-700 hover:bg-brand-50"
          >
            <Sparkles size={16} /> Analyze internal resources
          </button>
          <button
            onClick={() => { setEditingResource(null); setShowModal(true) }}
            className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-700"
          >
            <Plus size={16} /> Add
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-12 w-full max-w-[472px] items-center gap-3 rounded-xl border border-border bg-card px-4">
          <Search size={18} className="text-slate-400" />
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search internal resources..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
        </div>
        <select
          value={typeFilter}
          onChange={event => setTypeFilter(event.target.value)}
          className="h-12 rounded-xl border border-border bg-card px-4 text-sm outline-none"
        >
          <option value="">All diversion types</option>
          <option value="FULL">Full</option>
          <option value="PARTIAL">Partial</option>
          <option value="TEMPORARY">Temporary</option>
        </select>
        {filteredResources.length > 0 && (
          <label className="flex h-12 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleSelectAllVisible}
              className="rounded"
            />
            Select all
          </label>
        )}
        {selectedIds.size > 0 && (
          <div className="flex h-12 items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 text-sm text-red-700">
            <span className="font-semibold">{selectedIds.size} selected</span>
            <button
              onClick={removeSelected}
              disabled={bulkDeleting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {bulkDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              Delete selected
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="text-xs font-semibold text-red-700 hover:underline">
              Clear
            </button>
          </div>
        )}
      </div>

      {filteredResources.length === 0 && !isLoading ? (
        <div className="rounded-2xl border border-border bg-card py-16 text-center text-muted-foreground shadow-sm">
          <ArrowLeftRight size={42} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No internal resources found</p>
          <button onClick={() => setShowModal(true)} className="mt-4 text-sm font-semibold text-brand-600 hover:underline">
            Add your first resource
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {isLoading && Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-2xl bg-muted" />
          ))}
          {filteredResources.map((resource: any) => {
            const diversion = getDiversion(resource)
            const billingRate = Number(diversion.billingRate || 0)
            const acsMonthlyCost = Number(resource.acsMonthlyCost || diversion.acsMonthlyCost || 0)
            const margin = Number(diversion.monthlyMargin ?? billingRate - acsMonthlyCost)
            const jd = resource.pipelineEntries?.[0]?.jd

            return (
              <div key={resource.id} className={cn(
                'flex items-center gap-5 rounded-2xl border bg-card p-6 shadow-sm',
                selectedIds.has(resource.id) ? 'border-brand-300 ring-1 ring-brand-200' : 'border-border',
              )}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(resource.id)}
                  onChange={() => toggleSelected(resource.id)}
                  className="h-4 w-4 shrink-0 rounded"
                  aria-label={`Select ${resource.fullName}`}
                />
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-teal-50 text-lg font-bold text-teal-700">
                  {initials(resource.fullName)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="text-lg font-bold text-slate-950">{resource.fullName}</span>
                    <span className="rounded-md bg-violet-100 px-2 py-1 text-[10px] font-bold uppercase text-violet-700">Internal</span>
                    {resource.diversionType && (
                      <span className={cn('rounded-md px-2 py-1 text-[10px] font-bold uppercase', diversionBadge[resource.diversionType] || 'bg-slate-100 text-slate-600')}>
                        {resource.diversionType}
                      </span>
                    )}
                    {diversion.aiAssessment?.fitScore && (
                      <span className="rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase text-emerald-700">
                        AI {diversion.aiAssessment.fitScore}/100
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-medium text-slate-600">
                    {resource.currentTitle || 'ACS Resource'} {jd ? `-> ${jd.title}` : ''} - EMP {resource.employeeIdRef || '-'}
                  </div>
                  <div className="mt-1 truncate text-sm text-slate-400">
                    {resource.diversionNotes || diversion.aiAssessment?.summary || 'No diversion notes added yet.'}
                  </div>
                </div>

                <div className="hidden items-center gap-8 border-l border-border pl-8 text-right lg:flex">
                  <Metric label="ACS cost" value={money(acsMonthlyCost)} />
                  <Metric label="Billing" value={billingRate ? money(billingRate) : '-'} />
                  <Metric label="Margin / mo" value={money(margin)} positive />
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => { setEditingResource(resource); setShowModal(true) }}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-slate-600 hover:bg-accent"
                  >
                    <ArrowLeftRight size={14} /> Divert resource
                  </button>
                  <button
                    onClick={() => remove(resource)}
                    className="rounded-xl border border-border p-2.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                    aria-label="Delete resource"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <DivertModal
          resource={editingResource}
          onClose={() => {
            setShowModal(false)
            setEditingResource(null)
          }}
        />
      )}

      {showAnalyzeModal && (
        <AnalyzeModal
          onClose={() => setShowAnalyzeModal(false)}
          onDivert={(seed) => {
            setShowAnalyzeModal(false)
            setEditingResource(seed)
            setShowModal(true)
          }}
        />
      )}
    </div>
  )
}

function Metric({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div>
      <div className="text-xs text-slate-400">{label}</div>
      <div className={cn('font-mono text-base font-bold tracking-wide', positive ? 'text-emerald-600' : 'text-slate-800')}>{value}</div>
    </div>
  )
}
