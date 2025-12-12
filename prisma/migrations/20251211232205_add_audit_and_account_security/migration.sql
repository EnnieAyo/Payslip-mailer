-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "createdBy" INTEGER,
ADD COLUMN     "updatedBy" INTEGER;

-- AlterTable
ALTER TABLE "payslip_uploads" ADD COLUMN     "createdBy" INTEGER,
ADD COLUMN     "updatedBy" INTEGER;

-- AlterTable
ALTER TABLE "payslips" ADD COLUMN     "createdBy" INTEGER,
ADD COLUMN     "updatedBy" INTEGER;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "createdBy" INTEGER,
ADD COLUMN     "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "updatedBy" INTEGER;
