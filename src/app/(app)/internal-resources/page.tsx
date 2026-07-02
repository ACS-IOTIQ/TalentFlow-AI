'use client'
import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArrowLeftRight,
  Bot,
  Edit3,
  Loader2,
  Plus,
  Search,
  Trash2,
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
  const [editingResource, setEditingResource] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
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
        qc.invalidateQueries({ queryKey: ['internal-resources'] })
      } else {
        toast.error(data.error)
      }
    } catch {
      toast.error('Unable to delete resource')
    }
  }

  return (
    <div className="mx-auto max-w-[1408px] space-y-6 px-2 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">Internal resources</h1>
          <p className="mt-2 text-base text-slate-500">ACS employees diverted to the Tahaluf engagement</p>
        </div>
        <button
          onClick={() => { setEditingResource(null); setShowModal(true) }}
          className="mt-2 flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-700"
        >
          <Plus size={16} /> Divert resource
        </button>
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
      </div>

      {filteredResources.length === 0 && !isLoading ? (
        <div className="rounded-2xl border border-border bg-card py-16 text-center text-muted-foreground shadow-sm">
          <ArrowLeftRight size={42} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No internal resources found</p>
          <button onClick={() => setShowModal(true)} className="mt-4 text-sm font-semibold text-brand-600 hover:underline">
            Divert your first resource
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
              <div key={resource.id} className="flex items-center gap-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
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
                    className="rounded-xl border border-border p-2.5 text-slate-500 hover:bg-accent hover:text-slate-900"
                    aria-label="Edit resource"
                  >
                    <Edit3 size={16} />
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
