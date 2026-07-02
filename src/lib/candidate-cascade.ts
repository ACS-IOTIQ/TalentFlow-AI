import { prisma } from '@/lib/db'
import { deleteFile, BUCKETS } from '@/lib/storage'

export async function deleteCandidatesCascade(candidateIds: string[]) {
  if (!candidateIds.length) return { deletedIds: [] as string[], records: [] as any[] }

  const existing = await prisma.candidate.findMany({
    where: { id: { in: candidateIds } },
    include: {
      documents: { select: { fileKey: true } },
      pipelineEntries: { select: { id: true } },
    },
  })
  if (!existing.length) return { deletedIds: [], records: [] }

  const foundIds = existing.map(candidate => candidate.id)
  const pipelineEntryIds = existing.flatMap(candidate => candidate.pipelineEntries.map(entry => entry.id))

  await prisma.$transaction(async (tx) => {
    if (pipelineEntryIds.length) {
      const checklists = await tx.onboardingChecklist.findMany({
        where: { pipelineEntryId: { in: pipelineEntryIds } },
        select: { id: true },
      })
      await tx.onboardingItem.deleteMany({ where: { checklistId: { in: checklists.map(item => item.id) } } })
      await tx.onboardingChecklist.deleteMany({ where: { pipelineEntryId: { in: pipelineEntryIds } } })
      await tx.clientSubmission.deleteMany({ where: { pipelineEntryId: { in: pipelineEntryIds } } })
      const interviews = await tx.interview.findMany({ where: { pipelineEntryId: { in: pipelineEntryIds } }, select: { id: true } })
      await tx.interviewFeedback.deleteMany({ where: { interviewId: { in: interviews.map(item => item.id) } } })
      await tx.interview.deleteMany({ where: { pipelineEntryId: { in: pipelineEntryIds } } })
      await tx.screeningCallNote.deleteMany({ where: { pipelineEntryId: { in: pipelineEntryIds } } })
      await tx.pipelineHistory.deleteMany({ where: { pipelineEntryId: { in: pipelineEntryIds } } })
      await tx.pipelineEntry.deleteMany({ where: { id: { in: pipelineEntryIds } } })
    }

    await tx.candidateRedFlag.deleteMany({ where: { candidateId: { in: foundIds } } })
    await tx.candidateSkill.deleteMany({ where: { candidateId: { in: foundIds } } })
    await tx.candidateDocument.deleteMany({ where: { candidateId: { in: foundIds } } })
    await tx.candidate.deleteMany({ where: { id: { in: foundIds } } })
  })

  const fileKeys = existing.flatMap(candidate => candidate.documents.map(document => document.fileKey))
  await Promise.allSettled(fileKeys.map(key => deleteFile(BUCKETS.RESUMES, key)))

  return { deletedIds: foundIds, records: existing }
}
