ALTER TABLE "onboarding_checklists"
  ADD COLUMN "date_of_joining" TIMESTAMP(3),
  ADD COLUMN "employment_type" TEXT,
  ADD COLUMN "work_location" TEXT,
  ADD COLUMN "employee_code" TEXT,
  ADD COLUMN "designation" TEXT,
  ADD COLUMN "department" TEXT,
  ADD COLUMN "reporting_manager" TEXT,
  ADD COLUMN "salary_or_billing_notes" TEXT,
  ADD COLUMN "joining_status" TEXT NOT NULL DEFAULT 'DOCUMENT_COLLECTION',
  ADD COLUMN "hr_notes" TEXT,
  ADD COLUMN "completed_at" TIMESTAMP(3);

CREATE TABLE "onboarding_documents" (
  "id" TEXT NOT NULL,
  "checklist_id" TEXT NOT NULL,
  "item_id" TEXT,
  "document_type" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "file_key" TEXT NOT NULL,
  "file_type" TEXT,
  "file_size_bytes" INTEGER,
  "notes" TEXT,
  "uploaded_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "onboarding_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "onboarding_documents_checklist_id_document_type_idx"
  ON "onboarding_documents"("checklist_id", "document_type");

ALTER TABLE "onboarding_documents"
  ADD CONSTRAINT "onboarding_documents_checklist_id_fkey"
  FOREIGN KEY ("checklist_id") REFERENCES "onboarding_checklists"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "onboarding_documents"
  ADD CONSTRAINT "onboarding_documents_item_id_fkey"
  FOREIGN KEY ("item_id") REFERENCES "onboarding_items"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "onboarding_documents"
  ADD CONSTRAINT "onboarding_documents_uploaded_by_id_fkey"
  FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
