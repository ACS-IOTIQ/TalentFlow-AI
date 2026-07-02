import { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { prisma } from '@/lib/db'
import { requireAuth, err, handleError } from '@/lib/api-utils'
import { BUCKETS, s3 } from '@/lib/storage'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const document = await prisma.candidateDocument.findFirst({
      where: { candidateId: params.id },
      orderBy: { createdAt: 'desc' },
      select: { fileName: true, fileKey: true },
    })
    if (!document) return err('No uploaded resume found', 404)

    const object = await s3.send(new GetObjectCommand({ Bucket: BUCKETS.RESUMES, Key: document.fileKey }))
    const bytes = await object.Body?.transformToByteArray()
    if (!bytes) return err('Resume file is empty', 404)
    const contentType = object.ContentType || 'application/octet-stream'
    const arrayBuffer = new ArrayBuffer(bytes.byteLength)
    new Uint8Array(arrayBuffer).set(bytes)
    const body = new Blob([arrayBuffer], { type: contentType })

    return new NextResponse(body, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${document.fileName.replace(/"/g, '')}"`,
      },
    })
  } catch (e) { return handleError(e) }
}
