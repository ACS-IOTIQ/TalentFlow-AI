import { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, getPagination, handleError } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

function onboardingInclude() {
  return {
    managedBy: { select: { id: true, name: true, avatarUrl: true } },
    pipelineEntry: {
      include: {
        candidate: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            currentTitle: true,
            currentCompany: true,
            isInternal: true,
          },
        },
        jd: { select: { id: true, title: true, client: true } },
        submissions: {
          where: { status: 'APPROVED' as const },
          orderBy: { approvedAt: 'desc' as const },
          take: 1,
        },
      },
    },
    items: { orderBy: [{ category: 'asc' as const }, { sortOrder: 'asc' as const }] },
    documents: {
      orderBy: { createdAt: 'desc' as const },
      include: { uploadedBy: { select: { id: true, name: true } } },
    },
  }
}

export async function GET(req: NextRequest) {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const { page, pageSize, skip } = getPagination(req.nextUrl)
    const search = req.nextUrl.searchParams.get('search')?.trim()
    const status = req.nextUrl.searchParams.get('status')?.trim()

    const where = {
      ...(status && { joiningStatus: status }),
      ...(search && {
        OR: [
          { employeeCode: { contains: search, mode: 'insensitive' as const } },
          { designation: { contains: search, mode: 'insensitive' as const } },
          { department: { contains: search, mode: 'insensitive' as const } },
          {
            pipelineEntry: {
              candidate: {
                OR: [
                  { fullName: { contains: search, mode: 'insensitive' as const } },
                  { email: { contains: search, mode: 'insensitive' as const } },
                  { phone: { contains: search, mode: 'insensitive' as const } },
                ],
              },
            },
          },
          {
            pipelineEntry: {
              jd: {
                OR: [
                  { title: { contains: search, mode: 'insensitive' as const } },
                  { client: { contains: search, mode: 'insensitive' as const } },
                ],
              },
            },
          },
        ],
      }),
    }

    const [onboardings, total, counts] = await Promise.all([
      prisma.onboardingChecklist.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { updatedAt: 'desc' },
        include: onboardingInclude(),
      }),
      prisma.onboardingChecklist.count({ where }),
      prisma.onboardingChecklist.groupBy({
        by: ['joiningStatus'],
        _count: { joiningStatus: true },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: onboardings,
      counts,
      pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    })
  } catch (e) { return handleError(e) }
}
