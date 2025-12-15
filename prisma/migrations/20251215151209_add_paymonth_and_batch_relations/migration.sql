/*
  Warnings:

  - Added the required column `payMonth` to the `payslip_uploads` table without a default value. This is not possible if the table is not empty.
  - Added the required column `payMonth` to the `payslips` table without a default value. This is not possible if the table is not empty.
  - Added the required column `uploadId` to the `payslips` table without a default value. This is not possible if the table is not empty.

*/

-- Step 1: Add new columns with temporary defaults for existing data
ALTER TABLE "payslip_uploads" ADD COLUMN "completedAt" TIMESTAMP(3);
ALTER TABLE "payslip_uploads" ADD COLUMN "emailStatus" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "payslip_uploads" ADD COLUMN "payMonth" TEXT;
ALTER TABLE "payslip_uploads" ADD COLUMN "processedFiles" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "payslip_uploads" ADD COLUMN "sentAt" TIMESTAMP(3);

-- Step 2: Set default payMonth for existing uploads (use current year-month)
UPDATE "payslip_uploads" SET "payMonth" = TO_CHAR(CURRENT_DATE, 'YYYY-MM') WHERE "payMonth" IS NULL;

-- Step 3: Make payMonth required
ALTER TABLE "payslip_uploads" ALTER COLUMN "payMonth" SET NOT NULL;

-- Step 4: Add columns to payslips table
ALTER TABLE "payslips" ADD COLUMN "emailError" TEXT;
ALTER TABLE "payslips" ADD COLUMN "payMonth" TEXT;
ALTER TABLE "payslips" ADD COLUMN "uploadId" INTEGER;

-- Step 5: Set default values for existing payslips
-- Set payMonth to current year-month for existing records
UPDATE "payslips" SET "payMonth" = TO_CHAR(CURRENT_DATE, 'YYYY-MM') WHERE "payMonth" IS NULL;

-- Set uploadId to the first upload record (or create a dummy one if needed)
DO $$
DECLARE
  default_upload_id INTEGER;
BEGIN
  -- Get the first upload ID or create a default one
  SELECT id INTO default_upload_id FROM "payslip_uploads" ORDER BY id LIMIT 1;
  
  IF default_upload_id IS NULL THEN
    -- Create a default upload record if none exists
    INSERT INTO "payslip_uploads" ("uuid", "fileName", "filePath", "payMonth", "totalFiles", "status", "emailStatus", "createdAt", "updatedAt")
    VALUES (gen_random_uuid()::text, 'legacy_upload', 'uploads/legacy', TO_CHAR(CURRENT_DATE, 'YYYY-MM'), 0, 'completed', 'completed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING id INTO default_upload_id;
  END IF;
  
  -- Update existing payslips with the default upload ID
  UPDATE "payslips" SET "uploadId" = default_upload_id WHERE "uploadId" IS NULL;
END $$;

-- Step 6: Make columns required
ALTER TABLE "payslips" ALTER COLUMN "payMonth" SET NOT NULL;
ALTER TABLE "payslips" ALTER COLUMN "uploadId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "payslip_uploads_payMonth_idx" ON "payslip_uploads"("payMonth");

-- CreateIndex
CREATE INDEX "payslip_uploads_status_idx" ON "payslip_uploads"("status");

-- CreateIndex
CREATE INDEX "payslip_uploads_emailStatus_idx" ON "payslip_uploads"("emailStatus");

-- CreateIndex
CREATE INDEX "payslips_uploadId_idx" ON "payslips"("uploadId");

-- CreateIndex
CREATE INDEX "payslips_payMonth_idx" ON "payslips"("payMonth");

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "payslip_uploads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
