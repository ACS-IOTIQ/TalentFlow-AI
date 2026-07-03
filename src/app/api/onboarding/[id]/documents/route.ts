import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, ok, err, auditLog, handleError } from '@/lib/api-utils'
import { BUCKETS, uploadFile } from '@/lib/storage'
import { cleanText, safeFileName } from '@/lib/onboarding'
import { v4 as uuid } from 'uuid'

export const dynamic = 'force-dynamic'

function documentsInclude() {
  return {
    uploadedBy: { select: { id: true, name: true } },
    item: { select: { id: true, itemName: true } },
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error, session } = await requireAuth(['SUPER_ADMIN', 'CSO', 'DIR_TECH', 'HR'])
    if (error) return error

    const checklist = await prisma.onboardingChecklist.findUnique({
      where: { id: params.id },
      select: { id: true },
    })
    if (!checklist) return err('Onboarding record not found', 404)

    const formData = await req.formData()
    const documentType = cleanText(formData.get('documentType') as string | null)
    const itemId = cleanText(formData.get('itemId') as string | null)
    const notes = cleanText(formData.get('notes') as string | null)
    const files = formData.getAll('files') as File[]

    if (!documentType) return err('Document type is required', 400)
    if (!files.length) return err('No files provided', 400)

    let item: { id: string; itemName: string } | null = null
    if (itemId) {
      item = await prisma.onboardingItem.findFirst({
        where: { id: itemId, checklistId: params.id },
        select: { id: true, itemName: true },
      })
      if (!item) return err('Checklist item not found for this onboarding record', 404)
    }

    const created = []
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer())
      const key = `onboarding/${params.id}/${uuid()}-${safeFileName(file.name)}`
      await uploadFile(BUCKETS.PROFILES, key, buffer, file.type || 'application/octet-stream')

      const document = await prisma.$transaction(async (tx) => {
        const saved = await tx.onboardingDocument.create({
          data: {
            checklistId: params.id,
            itemId: item?.id,
            documentType,
            fileName: file.name,
            fileKey: key,
            fileType: file.type || 'application/octet-stream',
            fileSizeBytes: buffer.length,
            notes,
            uploadedById: session!.user.id,
          },
          include: documentsInclude(),
        })

        if (item?.id) {
          await tx.onboardingItem.update({
            where: { id: item.id },
            data: {
              completed: true,
              completedById: session!.user.id,
              completedAt: new Date(),
            },
          })
        }

        return saved
      })

      created.push(document)
    }

    await auditLog(session!.user.id, 'UPLOAD_ONBOARDING_DOCUMENT', 'OnboardingChecklist', params.id, undefined, { documentType, itemId, count: created.length }, req)
    return ok(created, 201)
  } catch (e) { return handleError(e) }
}
