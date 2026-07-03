import { NextRequest } from 'next/server'
import { CandidateStage } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireAuth, ok, handleError } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

const ACTIVE_JD_STATUSES = ['POSTED', 'POLISHED'] as const
const OPEN_PIPELINE_STAGES: CandidateStage[] = [
  'NEW',
  'SCREENING',
  'SCREENED',
  'SCREENING_CALL',
  'INTERVIEW_SCHEDULED',
  'INTERVIEWING',
  'INTERNAL_APPROVED',
  'SUBMITTED_TO_CLIENT',
  'CLIENT_APPROVED',
  'ONBOARDING',
]
const LATE_STAGE: CandidateStage[] = ['SUBMITTED_TO_CLIENT', 'CLIENT_APPROVED', 'ONBOARDING', 'ONBOARDED']
const STALE_STAGE_DAYS: Record<string, number> = {
  NEW: 3,
  SCREENING: 3,
  SCREENED: 5,
  SCREENING_CALL: 3,
  INTERVIEW_SCHEDULED: 7,
  INTERVIEWING: 7,
  INTERNAL_APPROVED: 5,
  SUBMITTED_TO_CLIENT: 7,
  CLIENT_APPROVED: 5,
  ONBOARDING: 10,
}

function daysAgo(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date
}

function daysFromNow(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date
}

function percent(value: number, total: number) {
  if (!total) return 0
  return Math.round((value / total) * 100)
}

function toNumber(value: unknown) {
  if (value == null) return 0
  return Number(value)
}

export async function GET(_req: NextRequest) {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const now = new Date()
    const thirtyDaysAgo = daysAgo(30)
    const sevenDaysAhead = daysFromNow(7)
    const staleCutoff = daysAgo(7)

    const [
      totalJDs,
      activeJDs,
      totalOpenings,
      totalCandidates,
      externalCandidates,
      internalResources,
      newCandidates30d,
      activePipeline,
      pendingScreening,
      shortlisted,
      submitted,
      approved,
      rejectedByClient,
      onboarding,
      onboarded,
      completedInterviews,
      scheduledInterviews,
      upcomingInterviews,
      openSubmissions,
      redFlags,
      criticalFlags,
      activePlacements,
      placementRows,
      recentActivity,
      pipelineStages,
      topJDs,
      highScoreCandidates,
      stalledEntries,
      onboardingItems,
      sourceBreakdown,
      jdStatusBreakdown,
      interviewsByStatus,
      submissionStatusBreakdown,
    ] = await Promise.all([
      prisma.jobDescription.count(),
      prisma.jobDescription.count({ where: { status: { in: [...ACTIVE_JD_STATUSES] } } }),
      prisma.jobDescription.aggregate({
        where: { status: { in: [...ACTIVE_JD_STATUSES] } },
        _sum: { openings: true },
      }),
      prisma.candidate.count(),
      prisma.candidate.count({ where: { isInternal: false } }),
      prisma.candidate.count({ where: { isInternal: true } }),
      prisma.candidate.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.pipelineEntry.count({ where: { stage: { in: OPEN_PIPELINE_STAGES } } }),
      prisma.pipelineEntry.count({ where: { stage: 'NEW', matchScore: null } }),
      prisma.pipelineEntry.count({ where: { isShortlisted: true } }),
      prisma.clientSubmission.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }),
      prisma.clientSubmission.count({ where: { status: 'APPROVED' } }),
      prisma.clientSubmission.count({ where: { status: 'REJECTED' } }),
      prisma.onboardingChecklist.count({ where: { isComplete: false } }),
      prisma.pipelineEntry.count({ where: { stage: 'ONBOARDED' } }),
      prisma.interview.count({ where: { status: 'COMPLETED' } }),
      prisma.interview.count({ where: { status: 'SCHEDULED' } }),
      prisma.interview.findMany({
        where: {
          status: 'SCHEDULED',
          scheduledAt: { gte: now, lte: sevenDaysAhead },
        },
        orderBy: { scheduledAt: 'asc' },
        take: 6,
        include: {
          pipelineEntry: {
            select: {
              candidate: { select: { fullName: true, currentTitle: true } },
              jd: { select: { title: true, client: true } },
            },
          },
        },
      }),
      prisma.clientSubmission.findMany({
        where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
        orderBy: { submittedAt: 'asc' },
        take: 6,
        include: {
          pipelineEntry: {
            select: {
              candidate: { select: { fullName: true } },
              jd: { select: { title: true, client: true } },
            },
          },
        },
      }),
      prisma.candidateRedFlag.count(),
      prisma.candidateRedFlag.count({ where: { severity: 'CRITICAL', confirmed: { not: false } } }),
      prisma.placement.count({ where: { isActive: true } }),
      prisma.placement.findMany({
        where: { isActive: true },
        select: { billingRate: true, billingCurrency: true, employeeCosts: { select: { amount: true } } },
      }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: { user: { select: { name: true, avatarUrl: true } } },
      }),
      prisma.pipelineEntry.groupBy({
        by: ['stage'],
        _count: { stage: true },
      }),
      prisma.jobDescription.findMany({
        where: { status: { in: [...ACTIVE_JD_STATUSES] } },
        orderBy: { updatedAt: 'desc' },
        take: 6,
        select: {
          id: true,
          title: true,
          client: true,
          openings: true,
          status: true,
          updatedAt: true,
          pipelineEntries: {
            select: {
              stage: true,
              compositeScore: true,
              isShortlisted: true,
              submissions: { select: { status: true } },
            },
          },
        },
      }),
      prisma.pipelineEntry.findMany({
        where: { compositeScore: { gte: 75 }, stage: { in: OPEN_PIPELINE_STAGES } },
        orderBy: { compositeScore: 'desc' },
        take: 6,
        include: {
          candidate: { select: { fullName: true, currentTitle: true, isInternal: true } },
          jd: { select: { title: true, client: true } },
        },
      }),
      prisma.pipelineEntry.findMany({
        where: {
          stage: { in: OPEN_PIPELINE_STAGES },
          updatedAt: { lt: staleCutoff },
        },
        orderBy: { updatedAt: 'asc' },
        take: 6,
        include: {
          candidate: { select: { fullName: true } },
          jd: { select: { title: true, client: true } },
        },
      }),
      prisma.onboardingItem.groupBy({
        by: ['completed'],
        where: { checklist: { isComplete: false } },
        _count: { completed: true },
      }),
      prisma.candidate.groupBy({
        by: ['source'],
        _count: { source: true },
        orderBy: { _count: { source: 'desc' } },
        take: 6,
      }),
      prisma.jobDescription.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      prisma.interview.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      prisma.clientSubmission.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
    ])

    const pipelineTotal = pipelineStages.reduce((sum, stage) => sum + stage._count.stage, 0)
    const lateStageCount = pipelineStages
      .filter(stage => LATE_STAGE.includes(stage.stage))
      .reduce((sum, stage) => sum + stage._count.stage, 0)
    const totalSubmissions = submitted + approved + rejectedByClient
    const monthlyBilling = placementRows.reduce((sum, row) => sum + toNumber(row.billingRate), 0)
    const monthlyCost = placementRows.reduce(
      (sum, row) => sum + row.employeeCosts.reduce((costSum, cost) => costSum + toNumber(cost.amount), 0),
      0,
    )
    const onboardingCompleted = onboardingItems.find(item => item.completed)?._count.completed ?? 0
    const onboardingPending = onboardingItems.find(item => !item.completed)?._count.completed ?? 0

    return ok({
      generatedAt: now.toISOString(),
      kpis: {
        totalJDs,
        activeJDs,
        openRoles: totalOpenings._sum.openings ?? 0,
        totalCandidates,
        externalCandidates,
        internalResources,
        newCandidates30d,
        activePipeline,
        pendingScreening,
        shortlisted,
        submitted,
        approved,
        rejectedByClient,
        onboarding,
        onboarded,
        completedInterviews,
        scheduledInterviews,
        openSubmissions: openSubmissions.length,
        redFlags,
        criticalFlags,
        activePlacements,
        monthlyBilling,
        monthlyCost,
        monthlyMargin: monthlyBilling - monthlyCost,
      },
      ratios: {
        fulfillment: percent(lateStageCount + onboarded, totalOpenings._sum.openings ?? 0),
        screeningCoverage: percent(activePipeline - pendingScreening, activePipeline),
        shortlistRate: percent(shortlisted, activePipeline),
        clientApprovalRate: percent(approved, totalSubmissions),
        rejectionRate: percent(rejectedByClient, totalSubmissions),
        internalMix: percent(internalResources, totalCandidates),
        onboardingCompletion: percent(onboardingCompleted, onboardingCompleted + onboardingPending),
        marginRate: percent(monthlyBilling - monthlyCost, monthlyBilling),
      },
      pipelineStages: pipelineStages
        .map(stage => ({
          stage: stage.stage,
          count: stage._count.stage,
          share: percent(stage._count.stage, pipelineTotal),
          staleAfterDays: STALE_STAGE_DAYS[stage.stage] ?? 7,
        }))
        .sort((a, b) => OPEN_PIPELINE_STAGES.indexOf(a.stage) - OPEN_PIPELINE_STAGES.indexOf(b.stage)),
      topJDs: topJDs.map(jd => {
        const entries = jd.pipelineEntries
        const submittedForJd = entries.filter(entry =>
          entry.submissions.some(submission => ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'].includes(submission.status)),
        ).length
        const approvedForJd = entries.filter(entry =>
          entry.submissions.some(submission => submission.status === 'APPROVED') || entry.stage === 'CLIENT_APPROVED',
        ).length

        return {
          id: jd.id,
          title: jd.title,
          client: jd.client,
          openings: jd.openings,
          status: jd.status,
          updatedAt: jd.updatedAt,
          pipelineCount: entries.length,
          shortlisted: entries.filter(entry => entry.isShortlisted).length,
          submitted: submittedForJd,
          approved: approvedForJd,
          averageScore: entries.length
            ? Math.round(entries.reduce((sum, entry) => sum + toNumber(entry.compositeScore), 0) / entries.length)
            : 0,
        }
      }),
      highScoreCandidates: highScoreCandidates.map(entry => ({
        id: entry.id,
        candidate: entry.candidate.fullName,
        title: entry.candidate.currentTitle,
        isInternal: entry.candidate.isInternal,
        jd: entry.jd.title,
        client: entry.jd.client,
        stage: entry.stage,
        score: Math.round(toNumber(entry.compositeScore)),
      })),
      stalledEntries: stalledEntries.map(entry => ({
        id: entry.id,
        candidate: entry.candidate.fullName,
        jd: entry.jd.title,
        client: entry.jd.client,
        stage: entry.stage,
        updatedAt: entry.updatedAt,
        ageDays: Math.max(1, Math.floor((now.getTime() - entry.updatedAt.getTime()) / 86400000)),
      })),
      upcomingInterviews: upcomingInterviews.map(interview => ({
        id: interview.id,
        candidate: interview.pipelineEntry.candidate.fullName,
        title: interview.pipelineEntry.candidate.currentTitle,
        jd: interview.pipelineEntry.jd.title,
        client: interview.pipelineEntry.jd.client,
        scheduledAt: interview.scheduledAt,
        roundNumber: interview.roundNumber,
        interviewerName: interview.interviewerName,
        status: interview.status,
      })),
      openSubmissions: openSubmissions.map(submission => ({
        id: submission.id,
        candidate: submission.pipelineEntry.candidate.fullName,
        jd: submission.pipelineEntry.jd.title,
        client: submission.pipelineEntry.jd.client,
        status: submission.status,
        submittedAt: submission.submittedAt,
        ageDays: Math.max(1, Math.floor((now.getTime() - submission.submittedAt.getTime()) / 86400000)),
      })),
      sourceBreakdown: sourceBreakdown.map(source => ({
        source: source.source || 'Unspecified',
        count: source._count.source,
      })),
      jdStatusBreakdown: jdStatusBreakdown.map(status => ({
        status: status.status,
        count: status._count.status,
      })),
      interviewsByStatus: interviewsByStatus.map(status => ({
        status: status.status,
        count: status._count.status,
      })),
      submissionStatusBreakdown: submissionStatusBreakdown.map(status => ({
        status: status.status,
        count: status._count.status,
      })),
      recentActivity,
    })
  } catch (e) { return handleError(e) }
}
