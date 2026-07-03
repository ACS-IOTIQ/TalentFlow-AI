export const ONBOARDING_STATUSES = [
  'DOCUMENT_COLLECTION',
  'JOINING_SCHEDULED',
  'JOINED',
  'ON_HOLD',
  'COMPLETED',
] as const

export const ONBOARDING_DOCUMENT_SECTIONS = [
  {
    category: 'Documents',
    items: [
      { itemName: 'Signed offer letter', isRequired: true },
      { itemName: 'Experience letters', isRequired: true },
      { itemName: 'Education certificates', isRequired: true },
      { itemName: 'ID/passport copy', isRequired: true },
      { itemName: 'Visa/work authorization', isRequired: true },
      { itemName: 'Address proof', isRequired: true },
      { itemName: 'Bank details', isRequired: true },
      { itemName: 'Signed contract', isRequired: true },
      { itemName: 'Photo', isRequired: false },
      { itemName: 'Other documents', isRequired: false },
    ],
  },
] as const

export function cleanText(value?: string | null) {
  return value?.trim() || null
}

export function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export async function createDefaultOnboardingItems(tx: any, checklistId: string) {
  const count = await tx.onboardingItem.count({ where: { checklistId } })
  if (count) return

  await tx.onboardingItem.createMany({
    data: ONBOARDING_DOCUMENT_SECTIONS.flatMap(section =>
      section.items.map((item, index) => ({
        checklistId,
        itemName: item.itemName,
        category: section.category,
        isRequired: item.isRequired,
        sortOrder: index + 1,
      })),
    ),
  })
}

export async function ensureOnboardingChecklist(
  tx: any,
  pipelineEntryId: string,
  managedById?: string | null,
  startDate?: Date | null,
) {
  const checklist = await tx.onboardingChecklist.upsert({
    where: { pipelineEntryId },
    update: {
      ...(managedById && { managedById }),
      ...(startDate && { startDate }),
      isComplete: false,
    },
    create: {
      pipelineEntryId,
      managedById: managedById || undefined,
      startDate: startDate || undefined,
      isComplete: false,
    },
  })

  await createDefaultOnboardingItems(tx, checklist.id)
  return checklist
}

export async function movePipelineStage(
  tx: any,
  pipelineEntry: { id: string; stage: string },
  toStage: string,
  userId: string,
  notes: string,
) {
  if (pipelineEntry.stage === toStage) return

  await tx.pipelineEntry.update({
    where: { id: pipelineEntry.id },
    data: { stage: toStage },
  })
  await tx.pipelineHistory.create({
    data: {
      pipelineEntryId: pipelineEntry.id,
      fromStage: pipelineEntry.stage,
      toStage,
      changedById: userId,
      notes,
    },
  })
}
