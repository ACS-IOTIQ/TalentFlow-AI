import { NextRequest, NextResponse } from 'next/server'
import archiver from 'archiver'
import PDFDocument from 'pdfkit'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAuth, err, auditLog, handleError } from '@/lib/api-utils'
import { BUCKETS, s3 } from '@/lib/storage'

const exportSchema = z.object({
  ids: z.array(z.string()).min(1),
})

function safeName(value: string) {
  return value.replace(/[^a-z0-9._-]+/gi, '_').replace(/^_+|_+$/g, '') || 'candidate'
}

function htmlCell(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildSummaryWorkbook(submissions: any[]) {
  const rows = submissions.map((submission) => {
    const candidate = submission.pipelineEntry?.candidate || {}
    const jd = submission.pipelineEntry?.jd || {}
    const skills = (candidate.skills || []).map((skill: any) => skill.skillName).join(', ')
    return [
      candidate.fullName,
      candidate.email,
      candidate.phone,
      candidate.currentTitle,
      candidate.currentCompany,
      candidate.location,
      candidate.totalExperienceYears,
      skills,
      candidate.isInternal ? 'Internal' : 'External',
      jd.title,
      jd.client,
      submission.status,
      submission.clientContact,
      submission.clientNotes,
      submission.submittedBy?.name,
      submission.submittedAt ? new Date(submission.submittedAt).toLocaleDateString('en-GB') : '',
    ]
  })
  const headers = [
    'Candidate', 'Email', 'Phone', 'Title', 'Company', 'Location', 'Experience',
    'Skills', 'Source', 'Role', 'Client', 'Submission Status', 'Client Contact',
    'Client Notes', 'Submitted By', 'Submitted At',
  ]

  return Buffer.from(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 11pt; }
    th { background: #1f4e78; color: #fff; font-weight: 700; }
    th, td { border: 1px solid #cbd5e1; padding: 8px; vertical-align: top; }
    tr:nth-child(even) td { background: #f8fafc; }
  </style>
</head>
<body>
  <table>
    <thead><tr>${headers.map(header => `<th>${htmlCell(header)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${htmlCell(cell)}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>
</body>
</html>`, 'utf8')
}

async function buildCandidatePdf(submission: any) {
  const candidate = submission.pipelineEntry?.candidate || {}
  const jd = submission.pipelineEntry?.jd || {}
  const doc = new PDFDocument({ margin: 48, size: 'A4' })
  const chunks: Buffer[] = []
  doc.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)))

  doc.font('Helvetica-Bold').fontSize(20).fillColor('#111827').text(candidate.fullName || 'Candidate Profile')
  doc.moveDown(0.3)
  doc.font('Helvetica').fontSize(10).fillColor('#64748b').text([
    candidate.currentTitle,
    candidate.currentCompany,
    candidate.location,
    candidate.isInternal ? 'Internal resource' : 'External candidate',
  ].filter(Boolean).join(' | '))

  doc.moveDown(1)
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#111827').text('Submission')
  doc.font('Helvetica').fontSize(10).fillColor('#374151')
  ;[
    ['Role', jd.title],
    ['Client', jd.client],
    ['Status', submission.status],
    ['Client contact', submission.clientContact],
    ['Client notes', submission.clientNotes],
  ].forEach(([label, value]) => value && doc.text(`${label}: ${value}`))

  doc.moveDown(1)
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#111827').text('Candidate Details')
  doc.font('Helvetica').fontSize(10).fillColor('#374151')
  ;[
    ['Email', candidate.email],
    ['Phone', candidate.phone],
    ['LinkedIn', candidate.linkedinUrl],
    ['Experience', candidate.totalExperienceYears ? `${candidate.totalExperienceYears} years` : null],
    ['Notice period', candidate.noticePeriodDays ? `${candidate.noticePeriodDays} days` : null],
    ['Expected salary', candidate.expectedSalary],
  ].forEach(([label, value]) => value && doc.text(`${label}: ${value}`))

  const skills = (candidate.skills || []).map((skill: any) => skill.skillName).filter(Boolean)
  if (skills.length) {
    doc.moveDown(1)
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#111827').text('Skills')
    doc.font('Helvetica').fontSize(10).fillColor('#374151').text(skills.join(', '))
  }

  const parsedData = candidate.parsedData && typeof candidate.parsedData === 'object' ? candidate.parsedData : {}
  if (parsedData.summary) {
    doc.moveDown(1)
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#111827').text('Summary')
    doc.font('Helvetica').fontSize(10).fillColor('#374151').text(String(parsedData.summary), { lineGap: 3 })
  }

  doc.end()
  await new Promise<void>(resolve => doc.on('end', resolve))
  return Buffer.concat(chunks)
}

async function getResumeBuffer(document: { fileKey: string }) {
  const object = await s3.send(new GetObjectCommand({ Bucket: BUCKETS.RESUMES, Key: document.fileKey }))
  const bytes = await object.Body?.transformToByteArray()
  return bytes ? Buffer.from(bytes) : null
}

async function buildZip(submissions: any[]) {
  const archive = archiver('zip', { zlib: { level: 9 } })
  const chunks: Buffer[] = []
  archive.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)))
  const done = new Promise<void>((resolve, reject) => {
    archive.on('end', resolve)
    archive.on('error', reject)
  })

  archive.append(buildSummaryWorkbook(submissions), { name: 'candidate-summary.xls' })

  for (const submission of submissions) {
    const candidate = submission.pipelineEntry?.candidate
    if (!candidate) continue
    const folder = safeName(`${candidate.fullName}-${submission.pipelineEntry?.jd?.title || 'role'}`)
    archive.append(await buildCandidatePdf(submission), { name: `${folder}/candidate-profile.pdf` })
    const resume = candidate.documents?.[0]
    if (resume) {
      const resumeBuffer = await getResumeBuffer(resume)
      if (resumeBuffer) archive.append(resumeBuffer, { name: `${folder}/resume-${safeName(resume.fileName)}` })
    }
  }

  await archive.finalize()
  await done
  return Buffer.concat(chunks)
}

export async function POST(req: NextRequest) {
  try {
    const { error, session } = await requireAuth(['SUPER_ADMIN', 'CSO', 'DIR_TECH', 'HR'])
    if (error) return error

    const { ids } = exportSchema.parse(await req.json())
    const submissions = await prisma.clientSubmission.findMany({
      where: { id: { in: ids } },
      orderBy: { submittedAt: 'desc' },
      include: {
        submittedBy: { select: { name: true } },
        pipelineEntry: {
          include: {
            jd: { select: { title: true, client: true } },
            candidate: {
              include: {
                skills: true,
                documents: { orderBy: { createdAt: 'desc' }, take: 1 },
              },
            },
          },
        },
      },
    })
    if (!submissions.length) return err('No matching submissions found', 404)

    const zip = await buildZip(submissions)
    await auditLog(session!.user.id, 'EXPORT_SUBMISSIONS', 'ClientSubmission', undefined, undefined, { ids, count: submissions.length }, req)
    return new NextResponse(zip, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="client-submissions-${new Date().toISOString().slice(0, 10)}.zip"`,
      },
    })
  } catch (e) { return handleError(e) }
}
