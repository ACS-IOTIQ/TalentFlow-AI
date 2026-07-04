import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, ok, err, paginatedOk, getPagination, auditLog, handleError } from '@/lib/api-utils'
import { z } from 'zod'

const createJDSchema = z.object({
  title: z.string().min(2),
  client: z.string().default('Tahaluf'),
  rawContent: z.string().optional(),
  rawFileName: z.string().optional(),
  polishedContent: z.string().optional(),
  finalContent: z.string().optional(),
  status: z.enum(['RAW', 'POLISHING', 'POLISHED', 'POSTED', 'CLOSED']).optional(),
  location: z.string().optional(),
  employmentType: z.string().optional(),
  experienceMin: z.number().optional(),
  experienceMax: z.number().optional(),
  salaryMin: z.number().optional(),
  salaryMax: z.number().optional(),
  openings: z.number().default(1),
  requiredSkills: z.array(z.string()).default([]),
})

export async function GET(req: NextRequest) {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const { page, pageSize, skip } = getPagination(req.nextUrl)
    const search = req.nextUrl.searchParams.get('search') || ''
    const status = req.nextUrl.searchParams.get('status')

    const where = {
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' as const } },
          { client: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(status && { status: status as any }),
    }

    const [jds, total] = await Promise.all([
      prisma.jobDescription.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { select: { name: true, avatarUrl: true } },
          _count: { select: { pipelineEntries: true, postingSources: true } },
        },
      }),
      prisma.jobDescription.count({ where }),
    ])

    return paginatedOk(jds, total, page, pageSize)
  } catch (e) { return handleError(e) }
}

export async function POST(req: NextRequest) {
  try {
    const { error, session } = await requireAuth(['SUPER_ADMIN', 'CSO', 'DIR_TECH', 'HR'])
    if (error) return error

    const body = await req.json()
    const data = createJDSchema.parse(body)

    const jd = await prisma.jobDescription.create({
      data: {
        ...data,
        createdById: session!.user.id,
        requiredSkills: data.requiredSkills,
      },
      include: { createdBy: { select: { name: true } } },
    })

    await auditLog(session!.user.id, 'CREATE_JD', 'JobDescription', jd.id, undefined, { title: jd.title }, req)
    return ok(jd, 201)
  } catch (e) { return handleError(e) }
}
