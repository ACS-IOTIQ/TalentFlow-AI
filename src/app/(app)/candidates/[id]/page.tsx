'use client'
import { useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Download,
  Edit3,
  Flag,
  Loader2,
  Mail,
  Phone,
  Save,
  Sparkles,
  Users,
  X,
} from 'lucide-react'
import { cn, formatDate, formatDateTime, initials, scoreColor, stageColor, stageLabel } from '@/lib/utils'

const tabs = ['Overview', 'Resume', 'AI Screening', 'Interviews', 'Submissions', 'Notes', 'Activity']

function hasItems(value: any) {
  return Array.isArray(value) && value.length > 0
}

function humanizeKey(key: string) {
  return key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
}

function renderValue(value: any): string {
  if (value === null || value === undefined || value === '') return ''
  if (Array.isArray(value)) return value.map(renderValue).filter(Boolean).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function firstValue(...values: any[]) {
  for (const value of values) {
    const rendered = renderValue(value)
    if (rendered) return value
  }
  return null
}

function numericScore(value: any): number | null {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? Math.round(number) : null
}

function storedCandidateAnalysis(parsedData: any, entry: any) {
  if (parsedData?.aiCandidateAnalysis && typeof parsedData.aiCandidateAnalysis === 'object') {
    return parsedData.aiCandidateAnalysis
  }
  if (!entry?.screeningNotes) return null
  try {
    const parsed = JSON.parse(entry.screeningNotes)
    return parsed?.schemaVersion === 'candidate-analysis-1.0' ? parsed : null
  } catch {
    return null
  }
}

function parseResumeDate(value: any): Date | null {
  const text = renderValue(value)
  if (!text) return null
  if (/^(present|current|now|till date)$/i.test(text)) return new Date()

  const match = text.match(/\b(19|20)\d{2}(?:[-/.\s](0?[1-9]|1[0-2]|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*)?\b/i)
  if (!match) return null
  const year = Number(match[0].match(/(19|20)\d{2}/)?.[0])
  const monthText = match[2]
  const monthNames: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
  }
  const month = monthText
    ? Number.isNaN(Number(monthText)) ? monthNames[monthText.slice(0, 3).toLowerCase()] ?? 0 : Number(monthText) - 1
    : 0
  return Number.isFinite(year) ? new Date(year, month, 1) : null
}

function inferExperienceYears(experience: any[]) {
  let totalMonths = 0
  for (const item of experience) {
    if (!item || typeof item !== 'object') continue
    const start = parseResumeDate(firstValue(item.from, item.startDate, item.start, item.periodFrom))
    const end = parseResumeDate(firstValue(item.to, item.endDate, item.end, item.periodTo)) || new Date()
    if (!start || end < start) continue
    totalMonths += (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1
  }
  return totalMonths ? Math.round((totalMonths / 12) * 10) / 10 : null
}

function primaryText(item: any, index: number) {
  if (typeof item === 'string') return item
  if (!item || typeof item !== 'object') return `Item ${index + 1}`
  return item.title || item.name || item.degree || item.institution || item.company || item.label || `Item ${index + 1}`
}

function estimateDisplayConfidence(parsedData: any) {
  const standardFields = parsedData.standardFields || {}
  const standardKeys = ['fullName', 'email', 'phone', 'location', 'currentTitle', 'currentCompany', 'totalExperienceYears']
  const populatedStandard = standardKeys.filter(key => renderValue(standardFields[key])).length
  const detailKeys = ['summary', 'experience', 'education', 'projects', 'certifications']
  const populatedDetails = detailKeys.filter(key => renderValue(parsedData[key])).length
  const skillCount = Array.isArray(parsedData.skills) ? parsedData.skills.length : 0
  if (!populatedStandard && !populatedDetails && !skillCount) return null
  const score = (populatedStandard / standardKeys.length) * 0.55 + (Math.min(skillCount, 8) / 8) * 0.25 + (populatedDetails / detailKeys.length) * 0.2
  return Math.max(35, Math.min(95, Math.round(score * 100)))
}

function DetailRows({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <div className="divide-y divide-border">
      {rows.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[220px_1fr] gap-4 py-2.5 text-sm">
          <div className="text-slate-500">{label}</div>
          <div className="font-medium text-slate-800">{value || '-'}</div>
        </div>
      ))}
    </div>
  )
}

function ScoreLine({ label, value }: { label: string; value: number | null }) {
  const score = value ?? 0
  return (
    <div className="grid grid-cols-[150px_1fr_36px] items-center gap-4 text-sm">
      <span className="text-slate-700">{label}</span>
      <div className="h-1.5 overflow-hidden rounded-full bg-emerald-100">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${score}%` }} />
      </div>
      <span className="text-right text-slate-700">{value ?? '-'}</span>
    </div>
  )
}

function ObjectDetails({ item }: { item: any }) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null
  const rows = Object.entries(item).filter(([, value]) => renderValue(value)).slice(0, 8)
  if (!rows.length) return null

  return (
    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
      {rows.map(([key, value]) => (
        <div key={key} className="text-xs">
          <span className="text-slate-500">{humanizeKey(key)}: </span>
          <span className="text-slate-700">{renderValue(value)}</span>
        </div>
      ))}
    </div>
  )
}

function ArraySection({ title, items }: { title: string; items: any }) {
  if (!hasItems(items)) return null

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="mb-3 font-semibold">{title}</h3>
      <div className="space-y-2">
        {items.map((item: any, index: number) => (
          <div key={index} className="rounded-xl border border-border bg-slate-50/60 p-3">
            <div className="text-sm font-semibold text-slate-900">{primaryText(item, index)}</div>
            {typeof item === 'string' ? null : <ObjectDetails item={item} />}
          </div>
        ))}
      </div>
    </div>
  )
}

function formValue(value: any) {
  return value === null || value === undefined ? '' : String(value)
}

function numberOrNull(value: string) {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function EditCandidateModal({
  candidate,
  defaults,
  onClose,
  onSaved,
}: {
  candidate: any
  defaults: {
    location: any
    currentTitle: any
    currentCompany: any
    totalExperienceYears: any
    noticePeriodDays: any
    expectedSalary: any
    linkedinUrl: any
  }
  onClose: () => void
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    fullName: formValue(candidate.fullName),
    email: formValue(candidate.email),
    phone: formValue(candidate.phone),
    location: formValue(defaults.location),
    currentTitle: formValue(defaults.currentTitle),
    currentCompany: formValue(defaults.currentCompany),
    totalExperienceYears: formValue(defaults.totalExperienceYears),
    noticePeriodDays: formValue(defaults.noticePeriodDays),
    expectedSalary: formValue(defaults.expectedSalary),
    linkedinUrl: formValue(defaults.linkedinUrl),
  })

  const setField = (field: keyof typeof form, value: string) => {
    setForm(current => ({ ...current, [field]: value }))
  }

  const handleSave = async () => {
    if (!form.fullName.trim()) {
      toast.error('Full name is required')
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`/api/candidates/${candidate.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: form.fullName,
          email: form.email,
          phone: form.phone,
          location: form.location,
          currentTitle: form.currentTitle,
          currentCompany: form.currentCompany,
          totalExperienceYears: numberOrNull(form.totalExperienceYears),
          noticePeriodDays: numberOrNull(form.noticePeriodDays),
          expectedSalary: numberOrNull(form.expectedSalary),
          linkedinUrl: form.linkedinUrl,
        }),
      })
      const data = await response.json()
      if (!data.success) {
        toast.error(data.error || 'Unable to update candidate')
        return
      }

      toast.success('Candidate details updated')
      onSaved()
      onClose()
    } catch {
      toast.error('Unable to update candidate')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[1px]">
      <div className="max-h-[92vh] w-full max-w-[760px] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold">Edit candidate details</h2>
            <p className="mt-1 text-sm text-slate-500">Update extracted fields after resume parsing.</p>
          </div>
          <button onClick={onClose} disabled={saving} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[calc(92vh-150px)] overflow-auto p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <EditField label="Full name" value={form.fullName} onChange={value => setField('fullName', value)} />
            <EditField label="Email" value={form.email} onChange={value => setField('email', value)} />
            <EditField label="Phone" value={form.phone} onChange={value => setField('phone', value)} />
            <EditField label="Location" value={form.location} onChange={value => setField('location', value)} />
            <EditField label="Current title" value={form.currentTitle} onChange={value => setField('currentTitle', value)} />
            <EditField label="Current company" value={form.currentCompany} onChange={value => setField('currentCompany', value)} />
            <EditField label="Experience years" value={form.totalExperienceYears} onChange={value => setField('totalExperienceYears', value)} type="number" />
            <EditField label="Notice period days" value={form.noticePeriodDays} onChange={value => setField('noticePeriodDays', value)} type="number" />
            <EditField label="Expected CTC" value={form.expectedSalary} onChange={value => setField('expectedSalary', value)} type="number" />
            <EditField label="LinkedIn URL" value={form.linkedinUrl} onChange={value => setField('linkedinUrl', value)} />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-border px-6 py-5">
          <button onClick={onClose} disabled={saving} className="rounded-xl border border-border px-5 py-3 text-sm font-medium hover:bg-accent disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save details
          </button>
        </div>
      </div>
    </div>
  )
}

function EditField({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'number'
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={event => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-input bg-slate-50 px-3 text-sm outline-none focus:border-brand-400"
      />
    </label>
  )
}

export default function CandidateDetailPage({ params }: { params: { id: string } }) {
  const [activeTab, setActiveTab] = useState('Overview')
  const [downloadingResume, setDownloadingResume] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [screening, setScreening] = useState(false)
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['candidate', params.id],
    queryFn: async () => {
      const response = await fetch(`/api/candidates/${params.id}`)
      return response.json()
    },
  })

  const candidate = data?.data

  if (isLoading) return (
    <div className="mx-auto max-w-[1360px] space-y-5 px-2 py-5 animate-pulse">
      <div className="h-8 w-48 rounded bg-muted" />
      <div className="h-56 rounded-2xl bg-muted" />
      <div className="grid grid-cols-2 gap-5">
        <div className="h-72 rounded-2xl bg-muted" />
        <div className="h-72 rounded-2xl bg-muted" />
      </div>
    </div>
  )

  if (!candidate) return <div className="py-16 text-center text-muted-foreground">Candidate not found</div>

  const entry = candidate.pipelineEntries?.[0]
  const jd = entry?.jd
  const parsedData = candidate.parsedData || {}
  const candidateAnalysis = storedCandidateAnalysis(parsedData, entry)
  const standardFields = parsedData.standardFields || {}
  const latestExperience = Array.isArray(parsedData.experience) && parsedData.experience[0] && typeof parsedData.experience[0] === 'object'
    ? parsedData.experience[0]
    : {}
  const displayLocation = firstValue(candidate.location, standardFields.location, latestExperience.location)
  const displayCurrentTitle = firstValue(candidate.currentTitle, standardFields.currentTitle, latestExperience.title, latestExperience.role, latestExperience.designation, latestExperience.position)
  const displayCurrentCompany = firstValue(candidate.currentCompany, standardFields.currentCompany, latestExperience.company, latestExperience.employer, latestExperience.organization, latestExperience.client)
  const displayExperienceYears = firstValue(candidate.totalExperienceYears, standardFields.totalExperienceYears, inferExperienceYears(Array.isArray(parsedData.experience) ? parsedData.experience : []))
  const displayNoticePeriodDays = firstValue(candidate.noticePeriodDays, standardFields.noticePeriodDays)
  const displayExpectedSalary = firstValue(candidate.expectedSalary, standardFields.expectedSalary)
  const displayLinkedinUrl = firstValue(candidate.linkedinUrl, standardFields.linkedinUrl)
  const displayAvailability = firstValue(parsedData.availabilityNotes, displayNoticePeriodDays != null ? `${displayNoticePeriodDays} days notice` : null)
  const extractionMeta = parsedData.extractionMeta || {}
  const rawConfidence = typeof extractionMeta.confidence === 'number' ? extractionMeta.confidence : null
  const displayConfidence = rawConfidence && rawConfidence > 0
    ? Math.round(rawConfidence * 100)
    : estimateDisplayConfidence(parsedData)
  const missingFields = Array.isArray(extractionMeta.missingFields) ? extractionMeta.missingFields : []
  const redFlags = candidate.redFlags || []
  const skillScore = numericScore(entry?.matchScore) ?? numericScore(candidateAnalysis?.skillScore)
  const availabilityScore = numericScore(entry?.availabilityScore) ?? numericScore(candidateAnalysis?.availabilityScore)
  const locationScore = numericScore(entry?.locationScore) ?? numericScore(candidateAnalysis?.locationScore)
  const score = numericScore(entry?.compositeScore) ?? numericScore(candidateAnalysis?.overallScore)
  const rawInferredFields = parsedData.rawInferredFields && typeof parsedData.rawInferredFields === 'object'
    ? parsedData.rawInferredFields
    : {}
  const extraFieldEntries = Object.entries(rawInferredFields).filter(([, value]) => renderValue(value))
  const timeline = [
    candidate.documents?.[0] && ['Resume uploaded', candidate.documents[0].createdAt],
    extractionMeta.extractedAt && ['Resume parsed', extractionMeta.extractedAt],
    entry && ['Linked to JD', entry.createdAt],
    score !== null && ['Screening score generated', entry.updatedAt],
    ...(entry?.history || []).slice(0, 5).map((item: any) => [`Stage changed to ${stageLabel(item.toStage)}`, item.createdAt]),
  ].filter(Boolean) as Array<[string, string]>

  const handleDownloadResume = async () => {
    setDownloadingResume(true)
    try {
      window.open(`/api/candidates/${params.id}/resume-download`, '_blank', 'noopener,noreferrer')
    } catch {
      window.alert('Unable to download resume')
    } finally {
      window.setTimeout(() => setDownloadingResume(false), 500)
    }
  }

  const handleAnalyzeCandidate = async () => {
    setAnalyzing(true)
    try {
      const response = await fetch(`/api/candidates/${params.id}/analyze`, { method: 'POST' })
      const data = await response.json()
      if (!data.success) {
        toast.error(data.error || 'Unable to analyze candidate')
        return
      }
      toast.success('AI screening pack generated')
      qc.invalidateQueries({ queryKey: ['candidate', params.id] })
    } catch {
      toast.error('Unable to analyze candidate')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleRunScreening = async () => {
    if (!jd?.id) {
      toast.error('Link this candidate to a JD before running AI screening')
      return
    }

    setScreening(true)
    try {
      const response = await fetch('/api/screening?action=run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jdId: jd.id, candidateId: candidate.id, force: true }),
      })
      const data = await response.json()
      if (!data.success) {
        toast.error(data.error || 'Unable to run AI screening')
        return
      }
      if (data.data.screened > 0) {
        toast.success('AI screening complete')
        qc.invalidateQueries({ queryKey: ['candidate', params.id] })
      } else {
        toast.error(data.data.message || 'No resume text available to screen against this JD')
      }
    } catch {
      toast.error('Unable to run AI screening')
    } finally {
      setScreening(false)
    }
  }

  const overviewRows: Array<[string, React.ReactNode]> = [
    ['Full name', candidate.fullName],
    ['Email', candidate.email],
    ['Phone', candidate.phone],
    ['Location', displayLocation],
    ['Candidate type', candidate.isInternal ? 'Internal' : 'External'],
    ['Source', candidate.source || 'Resume upload'],
    ['Added date', formatDate(candidate.createdAt)],
    ['Current stage', entry ? <span className={cn('rounded-md px-2 py-1 text-xs font-bold uppercase', stageColor(entry.stage))}>{stageLabel(entry.stage)}</span> : 'No JD'],
  ]

  const roleRows: Array<[string, React.ReactNode]> = [
    ['Applied role', jd?.title || displayCurrentTitle],
    ['Job description', jd?.title],
    ['Company', displayCurrentCompany || jd?.client],
    ['Experience', displayExperienceYears ? `${displayExperienceYears} years` : null],
    ['Expected CTC', displayExpectedSalary ? `AED ${Number(displayExpectedSalary).toLocaleString()}` : parsedData.salaryNotes],
    ['Notice period', displayNoticePeriodDays != null ? `${displayNoticePeriodDays} days` : null],
    ['Availability', displayAvailability],
    ['Recruiter owner', entry?.history?.[0]?.changedBy?.name],
  ]
  const editDefaults = {
    location: displayLocation,
    currentTitle: displayCurrentTitle,
    currentCompany: displayCurrentCompany,
    totalExperienceYears: displayExperienceYears,
    noticePeriodDays: displayNoticePeriodDays,
    expectedSalary: displayExpectedSalary,
    linkedinUrl: displayLinkedinUrl,
  }

  return (
    <div className="mx-auto max-w-[1360px] space-y-5 px-2 py-5">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/candidates" className="flex items-center gap-2 hover:text-brand-600">
          <ArrowLeft size={16} /> Candidates
        </Link>
        <span>/</span>
        <span className="font-medium text-slate-700">{candidate.fullName}</span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-5 px-6 py-6">
          <div className="flex items-center gap-6">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-red-50 text-3xl font-bold text-red-600">
              {initials(candidate.fullName)}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-950">{candidate.fullName}</h1>
              <p className="mt-1 text-base font-medium text-slate-600">{displayCurrentTitle || 'Candidate'}</p>
              <p className="text-base text-slate-500">{displayCurrentCompany || jd?.client || 'Resume upload'}</p>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-slate-500">
                {candidate.email && <span className="inline-flex items-center gap-1.5"><Mail size={14} /> {candidate.email}</span>}
                {candidate.phone && <span className="inline-flex items-center gap-1.5"><Phone size={14} /> {candidate.phone}</span>}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                {entry && <span className={cn('rounded-md px-2.5 py-1 text-xs font-bold uppercase', stageColor(entry.stage))}>{stageLabel(entry.stage)}</span>}
                {score !== null && <span className={cn('rounded-md px-3 py-1 text-xs font-bold', scoreColor(score))}>{score}</span>}
                {redFlags.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-600">
                    <Flag size={15} /> {redFlags.length} {redFlags.length === 1 ? 'flag' : 'flags'}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleAnalyzeCandidate}
              disabled={analyzing}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-600/20 hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {analyzing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              Analyze candidate
            </button>
            <button
              onClick={() => setShowEdit(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-3 text-sm font-semibold hover:bg-accent"
            >
              <Edit3 size={16} /> Edit details
            </button>
            <button className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-3 text-sm font-semibold hover:bg-accent">
              Move stage <ChevronDown size={16} />
            </button>
            <Link href="/interviews" className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-3 text-sm font-semibold hover:bg-accent">
              <CalendarDays size={16} /> Schedule interview
            </Link>
            <button
              onClick={handleDownloadResume}
              disabled={downloadingResume || !candidate.documents?.length}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-3 text-sm font-semibold hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              {downloadingResume ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              Download resume
            </button>
            <Link href="/submissions" className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-700">
              <Users size={16} /> Submit to client
            </Link>
          </div>
        </div>

        <div className="flex gap-8 border-t border-border px-6">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'border-b-2 px-1 py-4 text-sm font-medium transition-colors',
                activeTab === tab ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-900',
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'Overview' && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1fr]">
          <div className="space-y-5">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">Candidate information</h2>
              <DetailRows rows={overviewRows} />
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">Role details</h2>
              <DetailRows rows={roleRows} />
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Score summary</h2>
                {jd && (
                  <button
                    onClick={handleRunScreening}
                    disabled={screening}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50"
                  >
                    {screening ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                    {score !== null ? 'Re-run AI screening' : 'Run AI screening'}
                  </button>
                )}
              </div>
              {!jd ? (
                <p className="text-sm text-slate-500">Link this candidate to a JD to run AI screening.</p>
              ) : (
                <div className="grid gap-6 md:grid-cols-[150px_1fr]">
                  <div className="flex items-center justify-center border-r border-border">
                    <div>
                      <span className="text-5xl font-bold text-emerald-600">{score ?? '-'}</span>
                      <span className="ml-2 text-2xl text-slate-400">/100</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <ScoreLine label="Skills match" value={skillScore} />
                    <ScoreLine label="Availability fit" value={availabilityScore} />
                    <ScoreLine label="Location match" value={locationScore} />
                    <ScoreLine label="Overall score" value={score} />
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">Flags</h2>
              {redFlags.length > 0 ? (
                <div className="space-y-2">
                  {redFlags.map((flag: any) => (
                    <div key={flag.id} className="flex items-start gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                      <Flag size={16} className="mt-0.5 shrink-0" />
                      <span>{flag.description}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No flags identified</p>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">Quick timeline</h2>
              <div className="space-y-3">
                {timeline.length > 0 ? timeline.map(([label, date]) => (
                  <div key={`${label}-${date}`} className="flex items-center gap-3 text-sm">
                    <CheckCircle2 size={17} className="text-emerald-500" />
                    <span className="font-medium text-slate-600">{label}</span>
                    <span className="ml-auto text-slate-400">{formatDateTime(date)}</span>
                  </div>
                )) : (
                  <p className="text-sm text-slate-500">No activity yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Resume' && (
        <div className="space-y-5">
          {candidate.documents?.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">Uploaded Resume</h2>
                  <p className="mt-1 text-sm text-slate-500">{candidate.documents[0].fileName}</p>
                </div>
                <button
                  onClick={handleDownloadResume}
                  disabled={downloadingResume}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {downloadingResume ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                  Download
                </button>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">AI Extracted Profile</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {extractionMeta.status === 'FAILED'
                    ? `Extraction failed${extractionMeta.error ? `: ${extractionMeta.error}` : ''}`
                    : `Confidence: ${displayConfidence !== null ? `${displayConfidence}%` : 'Not available'}`}
                </p>
              </div>
              {extractionMeta.provider && (
                <span className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold uppercase text-slate-500">
                  {extractionMeta.provider} - {extractionMeta.model}
                </span>
              )}
            </div>

            {missingFields.length > 0 && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Missing fields: {missingFields.map((field: string) => humanizeKey(field)).join(', ')}
              </div>
            )}

            {parsedData.summary && (
              <p className="mt-4 text-sm leading-6 text-slate-600">{parsedData.summary}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <ArraySection title="Experience" items={parsedData.experience} />
            <ArraySection title="Education" items={parsedData.education} />
            <ArraySection title="Certifications" items={parsedData.certifications} />
            <ArraySection title="Projects" items={parsedData.projects} />
            <ArraySection title="Languages" items={parsedData.languages} />
            <ArraySection title="Achievements" items={parsedData.achievements} />
            <ArraySection title="Links" items={parsedData.links} />
            <ArraySection title="Gaps" items={parsedData.gaps} />
          </div>

          {(parsedData.availabilityNotes || parsedData.salaryNotes || parsedData.workAuthorization || parsedData.visaStatus || extraFieldEntries.length > 0) && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">Other extracted details</h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {[
                  ['Availability', parsedData.availabilityNotes],
                  ['Salary notes', parsedData.salaryNotes],
                  ['Work authorization', parsedData.workAuthorization],
                  ['Visa status', parsedData.visaStatus],
                  ...extraFieldEntries.map(([key, value]) => [humanizeKey(key), renderValue(value)]),
                ].filter(([, value]) => renderValue(value)).map(([label, value]) => (
                  <div key={String(label)} className="rounded-xl border border-border p-3">
                    <div className="text-xs text-slate-500">{label}</div>
                    <div className="mt-1 text-sm font-medium text-slate-800">{renderValue(value)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {candidate.rawResumeText && (
            <details className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <summary className="cursor-pointer font-semibold">Raw Resume Text</summary>
              <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-600">
                {candidate.rawResumeText}
              </pre>
            </details>
          )}
        </div>
      )}

      {activeTab === 'AI Screening' && (
        <div className="space-y-5">
          {candidateAnalysis ? (
            <>
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold">Score summary</h2>
                      <p className="mt-1 text-sm text-slate-500">Generated by AI for HR screening.</p>
                    </div>
                    <span className={cn('rounded-xl px-3 py-1 text-sm font-bold', scoreColor(score || 0))}>{score ?? '-'}/100</span>
                  </div>
                  <div className="mt-5 space-y-3">
                    <ScoreLine label="Skills match" value={skillScore} />
                    <ScoreLine label="Availability fit" value={availabilityScore} />
                    <ScoreLine label="Location match" value={locationScore} />
                    <ScoreLine label="Overall score" value={score} />
                  </div>
                  {candidateAnalysis.recommendedNextStep && (
                    <div className="mt-5 rounded-xl bg-violet-50 p-4 text-sm text-violet-800">
                      <span className="font-semibold">Next step:</span> {candidateAnalysis.recommendedNextStep}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <h2 className="text-lg font-semibold">AI Screening Notes</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {candidateAnalysis.screeningNotes || candidateAnalysis.summary || 'No notes generated yet.'}
                  </p>
                  {candidateAnalysis.summary && candidateAnalysis.summary !== candidateAnalysis.screeningNotes && (
                    <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">{candidateAnalysis.summary}</p>
                  )}
                  <div className="mt-4 text-xs text-slate-400">
                    Generated by {candidateAnalysis.provider || 'AI'}{candidateAnalysis.model ? ` / ${candidateAnalysis.model}` : ''}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <h2 className="mb-4 text-lg font-semibold">Quick HR screening questions</h2>
                  {Array.isArray(candidateAnalysis.screeningQuestions) && candidateAnalysis.screeningQuestions.length > 0 ? (
                    <ol className="space-y-3">
                      {candidateAnalysis.screeningQuestions.map((question: string, index: number) => (
                        <li key={`${question}-${index}`} className="flex gap-3 rounded-xl border border-border bg-slate-50/70 p-3 text-sm text-slate-700">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">{index + 1}</span>
                          <span>{question}</span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-sm text-slate-500">No questions generated yet.</p>
                  )}
                </div>

                <div className="space-y-5">
                  <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                    <h2 className="mb-4 text-lg font-semibold">Flags</h2>
                    {redFlags.length > 0 ? (
                      <div className="space-y-2">
                        {redFlags.map((flag: any) => (
                          <div key={flag.id} className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
                            <div className="flex items-center gap-2 font-semibold">
                              <Flag size={15} /> {humanizeKey(flag.flagType || 'Flag')} · {flag.severity}
                            </div>
                            <p className="mt-1 leading-6">{flag.description}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">No flags identified by AI.</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                      <h2 className="mb-3 text-base font-semibold">Strengths</h2>
                      {Array.isArray(candidateAnalysis.strengths) && candidateAnalysis.strengths.length > 0 ? (
                        <ul className="space-y-2 text-sm text-slate-600">
                          {candidateAnalysis.strengths.map((item: string) => <li key={item}>• {item}</li>)}
                        </ul>
                      ) : <p className="text-sm text-slate-500">No strengths generated.</p>}
                    </div>
                    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                      <h2 className="mb-3 text-base font-semibold">Risks / Missing info</h2>
                      {[...(candidateAnalysis.risks || []), ...(candidateAnalysis.missingFields || []).map((field: string) => `Confirm ${humanizeKey(field)}`)].length > 0 ? (
                        <ul className="space-y-2 text-sm text-slate-600">
                          {[...(candidateAnalysis.risks || []), ...(candidateAnalysis.missingFields || []).map((field: string) => `Confirm ${humanizeKey(field)}`)].slice(0, 8).map((item: string) => <li key={item}>• {item}</li>)}
                        </ul>
                      ) : <p className="text-sm text-slate-500">No risks generated.</p>}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/50 p-10 text-center shadow-sm">
              <Sparkles className="mx-auto text-violet-600" size={30} />
              <h2 className="mt-3 text-lg font-semibold">Generate AI screening pack</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
                Analyze the candidate to create score summary, flags, AI screening notes, and 5-10 HR-friendly screening questions.
              </p>
              <button
                onClick={handleAnalyzeCandidate}
                disabled={analyzing}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
              >
                {analyzing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                Analyze candidate
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab !== 'Overview' && activeTab !== 'Resume' && activeTab !== 'AI Screening' && (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-slate-500 shadow-sm">
          {activeTab} details are tracked in the workflow modules.
        </div>
      )}

      {showEdit && (
        <EditCandidateModal
          candidate={candidate}
          defaults={editDefaults}
          onClose={() => setShowEdit(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['candidate', params.id] })}
        />
      )}
    </div>
  )
}
