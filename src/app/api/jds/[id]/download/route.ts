import { NextRequest, NextResponse } from 'next/server'
import PDFDocument from 'pdfkit'
import { prisma } from '@/lib/db'
import { requireAuth, err, handleError } from '@/lib/api-utils'

function cleanFileName(value: string) {
  return value.replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'job-description'
}

function writeMarkdownLine(doc: any, line: string) {
  const trimmed = line.trim()
  if (!trimmed) {
    doc.moveDown(0.5)
    return
  }

  if (trimmed.startsWith('## ')) {
    doc.moveDown(0.7).font('Helvetica-Bold').fontSize(14).fillColor('#111827').text(trimmed.replace(/^##\s+/, ''))
    return
  }

  if (trimmed.startsWith('### ')) {
    doc.moveDown(0.5).font('Helvetica-Bold').fontSize(12).fillColor('#111827').text(trimmed.replace(/^###\s+/, ''))
    return
  }

  if (/^[-*]\s+/.test(trimmed)) {
    doc.font('Helvetica').fontSize(10).fillColor('#374151').text(`- ${trimmed.replace(/^[-*]\s+/, '')}`, { indent: 12 })
    return
  }

  doc.font('Helvetica').fontSize(10).fillColor('#374151').text(trimmed, { lineGap: 3 })
}

async function buildPdfBuffer(jd: any) {
  const doc = new PDFDocument({ margin: 48, size: 'A4' })
  const chunks: Buffer[] = []

  doc.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)))

  doc.font('Helvetica-Bold').fontSize(20).fillColor('#111827').text(jd.title)
  doc.moveDown(0.4)
  doc.font('Helvetica').fontSize(10).fillColor('#6b7280').text([
    jd.client,
    jd.location,
    jd.employmentType,
    `${jd.openings} opening${jd.openings === 1 ? '' : 's'}`,
  ].filter(Boolean).join(' | '))

  const experience = jd.experienceMin != null || jd.experienceMax != null
    ? `${jd.experienceMin ?? 'N/A'}-${jd.experienceMax ?? 'N/A'} years`
    : null
  const salary = jd.salaryMin != null || jd.salaryMax != null
    ? `AED ${jd.salaryMin ?? 'N/A'}-${jd.salaryMax ?? 'N/A'} / month`
    : null
  const skills = Array.isArray(jd.requiredSkills) ? jd.requiredSkills.join(', ') : ''

  doc.moveDown(1)
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827').text('Role Details')
  doc.font('Helvetica').fontSize(10).fillColor('#374151')
  ;[
    ['Experience', experience],
    ['Salary', salary],
    ['Required skills', skills],
    ['Status', jd.status],
  ].filter(([, value]) => Boolean(value)).forEach(([label, value]) => {
    doc.text(`${label}: ${value}`)
  })

  doc.moveDown(1)
  const content = String(jd.finalContent || jd.polishedContent || jd.rawContent || '')
  content.split(/\r?\n/).forEach(line => writeMarkdownLine(doc, line))
  doc.end()

  await new Promise<void>(resolve => doc.on('end', resolve))
  return Buffer.concat(chunks)
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const jd = await prisma.jobDescription.findUnique({ where: { id: params.id } })
    if (!jd) return err('JD not found', 404)

    const pdf = await buildPdfBuffer(jd)
    return new NextResponse(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${cleanFileName(jd.title)}.pdf"`,
      },
    })
  } catch (e) { return handleError(e) }
}
