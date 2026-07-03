import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, ok, err, auditLog, handleError } from '@/lib/api-utils'
import { BUCKETS, deleteFile } from '@/lib/storage'

export const dynamic = 'force-dynamic'

export async function DELETE(req: NextRequest, { params }: { params: { id: string; documentId: string } }) {
  try {
    const { error, session } = await requireAuth(['SUPER_ADMIN', 'CSO', 'DIR_TECH', 'HR'])
    if (error) return error

    const document = await prisma.onboardingDocument.findFirst({
      where: { id: params.documentId, checklistId: params.id },
    })
    if (!document) return err('Document not found', 404)

    await prisma.onboardingDocument.delete({ where: { id: document.id } })
    await deleteFile(BUCKETS.PROFILES, document.fileKey)

    await auditLog(session!.user.id, 'DELETE_ONBOARDING_DOCUMENT', 'OnboardingDocument', document.id, document, undefined, req)
    return ok({ deleted: true })
  } catch (e) { return handleError(e) }
}
