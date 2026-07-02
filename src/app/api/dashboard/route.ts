import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, ok, handleError } from '@/lib/api-utils'

export async function GET(_req: NextRequest) {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const [
      totalJDs,
      activeJDs,
      totalCandidates,
      internalResources,
      pendingScreening,
      submitted,
      approved,
      onboarding,
      recentActivity,
      pipelineStages,
    ] = await Promise.all([
      prisma.jobDescription.count(),
      prisma.jobDescription.count({ where: { status: { in: ['POSTED', 'POLISHED'] } } }),
      prisma.candidate.count({ where: { isInternal: false } }),
      prisma.candidate.count({ where: { isInternal: true } }),
      prisma.pipelineEntry.count({ where: { stage: 'NEW', matchScore: null } }),
      prisma.clientSubmission.count({ where: { status: 'SUBMITTED' } }),
      prisma.clientSubmission.count({ where: { status: 'APPROVED' } }),
      prisma.onboardingChecklist.count({ where: { isComplete: false } }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { user: { select: { name: true, avatarUrl: true } } },
      }),
      prisma.pipelineEntry.groupBy({
        by: ['stage'],
        _count: { stage: true },
      }),
    ])

    return ok({
      kpis: {
        totalJDs,
        activeJDs,
        totalCandidates,
        internalResources,
        pendingScreening,
        submitted,
        approved,
        onboarding,
      },
      pipelineStages: pipelineStages.map(s => ({
        stage: s.stage,
        count: s._count.stage,
      })),
      recentActivity,
    })
  } catch (e) { return handleError(e) }
}
