import { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { prisma } from '@/lib/db'
import { requireAuth, err, handleError } from '@/lib/api-utils'
import { BUCKETS, s3 } from '@/lib/storage'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string; documentId: string } }) {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const document = await prisma.onboardingDocument.findFirst({
      where: { id: params.documentId, checklistId: params.id },
      select: { fileName: true, fileKey: true },
    })
    if (!document) return err('Document not found', 404)

    const object = await s3.send(new GetObjectCommand({ Bucket: BUCKETS.PROFILES, Key: document.fileKey }))
    const bytes = await object.Body?.transformToByteArray()
    if (!bytes) return err('Document file is empty', 404)

    const arrayBuffer = new ArrayBuffer(bytes.byteLength)
    new Uint8Array(arrayBuffer).set(bytes)
    const contentType = object.ContentType || 'application/octet-stream'
    const body = new Blob([arrayBuffer], { type: contentType })

    return new NextResponse(body, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${document.fileName.replace(/"/g, '')}"`,
      },
    })
  } catch (e) { return handleError(e) }
}
