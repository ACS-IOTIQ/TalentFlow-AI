import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, ok, err, auditLog, handleError } from '@/lib/api-utils'
import { cleanText, movePipelineStage, ONBOARDING_STATUSES } from '@/lib/onboarding'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const updateItemSchema = z.object({
  id: z.string(),
  completed: z.boolean().optional(),
  dueDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

const updateOnboardingSchema = z.object({
  dateOfJoining: z.string().optional().nullable(),
  employmentType: z.string().optional().nullable(),
  workLocation: z.string().optional().nullable(),
  employeeCode: z.string().optional().nullable(),
  designation: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  reportingManager: z.string().optional().nullable(),
  salaryOrBillingNotes: z.string().optional().nullable(),
  joiningStatus: z.enum(ONBOARDING_STATUSES).optional(),
  hrNotes: z.string().optional().nullable(),
  isComplete: z.boolean().optional(),
  items: z.array(updateItemSchema).optional(),
})

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
            location: true,
            currentTitle: true,
            currentCompany: true,
            isInternal: true,
          },
        },
        jd: { select: { id: true, title: true, client: true, location: true } },
        submissions: { orderBy: { createdAt: 'desc' as const } },
      },
    },
    items: {
      orderBy: [{ category: 'asc' as const }, { sortOrder: 'asc' as const }],
      include: { documents: { select: { id: true } } },
    },
    documents: {
      orderBy: { createdAt: 'desc' as const },
      include: { uploadedBy: { select: { id: true, name: true } } },
    },
  }
}

function dateOrNull(value?: string | null) {
  if (value === undefined) return undefined
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const onboarding = await prisma.onboardingChecklist.findUnique({
      where: { id: params.id },
      include: onboardingInclude(),
    })
    if (!onboarding) return err('Onboarding record not found', 404)
    return ok(onboarding)
  } catch (e) { return handleError(e) }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error, session } = await requireAuth(['SUPER_ADMIN', 'CSO', 'DIR_TECH', 'HR'])
    if (error) return error

    const data = updateOnboardingSchema.parse(await req.json())
    const existing = await prisma.onboardingChecklist.findUnique({
      where: { id: params.id },
      include: {
        pipelineEntry: { select: { id: true, stage: true } },
        items: true,
      },
    })
    if (!existing) return err('Onboarding record not found', 404)

    const updated = await prisma.$transaction(async (tx) => {
      for (const item of data.items || []) {
        const belongsToChecklist = existing.items.some(existingItem => existingItem.id === item.id)
        if (!belongsToChecklist) continue

        await tx.onboardingItem.update({
          where: { id: item.id },
          data: {
            ...(item.completed !== undefined && {
              completed: item.completed,
              completedById: item.completed ? session!.user.id : null,
              completedAt: item.completed ? new Date() : null,
            }),
            ...(item.dueDate !== undefined && { dueDate: dateOrNull(item.dueDate) }),
            ...(item.notes !== undefined && { notes: cleanText(item.notes) }),
          },
        })
      }

      const currentItems = await tx.onboardingItem.findMany({ where: { checklistId: params.id } })
      if (data.isComplete) {
        const pendingRequired = currentItems.filter(item => item.isRequired && !item.completed)
        if (pendingRequired.length) throw new Error('Complete all required onboarding items before marking onboarded')
      }

      const checklist = await tx.onboardingChecklist.update({
        where: { id: params.id },
        data: {
          ...(data.dateOfJoining !== undefined && { dateOfJoining: dateOrNull(data.dateOfJoining) }),
          ...(data.employmentType !== undefined && { employmentType: cleanText(data.employmentType) }),
          ...(data.workLocation !== undefined && { workLocation: cleanText(data.workLocation) }),
          ...(data.employeeCode !== undefined && { employeeCode: cleanText(data.employeeCode) }),
          ...(data.designation !== undefined && { designation: cleanText(data.designation) }),
          ...(data.department !== undefined && { department: cleanText(data.department) }),
          ...(data.reportingManager !== undefined && { reportingManager: cleanText(data.reportingManager) }),
          ...(data.salaryOrBillingNotes !== undefined && { salaryOrBillingNotes: cleanText(data.salaryOrBillingNotes) }),
          ...(data.hrNotes !== undefined && { hrNotes: cleanText(data.hrNotes) }),
          ...(data.joiningStatus && { joiningStatus: data.joiningStatus }),
          ...(data.isComplete !== undefined && {
            isComplete: data.isComplete,
            completedAt: data.isComplete ? new Date() : null,
            joiningStatus: data.isComplete ? 'COMPLETED' : data.joiningStatus || existing.joiningStatus,
          }),
          managedById: session!.user.id,
        },
        include: onboardingInclude(),
      })

      if (data.isComplete) {
        await movePipelineStage(tx, existing.pipelineEntry, 'ONBOARDED', session!.user.id, 'Onboarding completed by HR')
      }

      return checklist
    })

    await auditLog(session!.user.id, 'UPDATE_ONBOARDING', 'OnboardingChecklist', params.id, existing, data, req)
    return ok(updated)
  } catch (e) {
    if (e instanceof Error && e.message === 'Complete all required onboarding items before marking onboarded') {
      return err(e.message, 400)
    }
    return handleError(e)
  }
}
