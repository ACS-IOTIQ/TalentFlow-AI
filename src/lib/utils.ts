import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date, opts?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    ...opts,
  }).format(new Date(date))
}

export function formatDateTime(date: string | Date) {
  return formatDate(date, { hour: '2-digit', minute: '2-digit' })
}

export function formatCurrency(amount: number, currency = 'AED') {
  return new Intl.NumberFormat('en-AE', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}

export function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

export function stageColor(stage: string): string {
  const map: Record<string, string> = {
    NEW: 'bg-gray-100 text-gray-700',
    PROFILE_COMPLETE: 'bg-sky-100 text-sky-700',
    SCREENING: 'bg-blue-100 text-blue-700',
    SCREENED: 'bg-blue-100 text-blue-700',
    SHORTLISTED: 'bg-indigo-100 text-indigo-700',
    SCREENING_CALL: 'bg-violet-100 text-violet-700',
    INTERVIEW_SCHEDULED: 'bg-amber-100 text-amber-700',
    INTERVIEWING: 'bg-amber-100 text-amber-700',
    INTERNAL_APPROVED: 'bg-green-100 text-green-700',
    SUBMITTED_TO_CLIENT: 'bg-teal-100 text-teal-700',
    CLIENT_INTERVIEW: 'bg-cyan-100 text-cyan-700',
    OFFERED: 'bg-lime-100 text-lime-700',
    CLIENT_APPROVED: 'bg-green-100 text-green-700',
    CLIENT_REJECTED: 'bg-red-100 text-red-700',
    ONBOARDING: 'bg-emerald-100 text-emerald-700',
    ONBOARDED: 'bg-emerald-100 text-emerald-700',
    REJECTED: 'bg-red-100 text-red-700',
  }
  return map[stage] || 'bg-gray-100 text-gray-600'
}

export function scoreColor(score: number) {
  if (score >= 80) return 'text-green-700 bg-green-50'
  if (score >= 60) return 'text-amber-700 bg-amber-50'
  return 'text-red-700 bg-red-50'
}

export function stageLabel(stage: string) {
  return stage.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

export const PIPELINE_STAGES = [
  'NEW', 'PROFILE_COMPLETE', 'SCREENING', 'SCREENED', 'SHORTLISTED', 'SCREENING_CALL',
  'INTERVIEW_SCHEDULED', 'INTERVIEWING', 'INTERNAL_APPROVED',
  'SUBMITTED_TO_CLIENT', 'CLIENT_INTERVIEW', 'OFFERED', 'CLIENT_APPROVED', 'ONBOARDING', 'ONBOARDED',
] as const
