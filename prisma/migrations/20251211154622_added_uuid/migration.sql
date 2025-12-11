/*
  Warnings:

  - A unique constraint covering the columns `[uuid]` on the table `employees` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `payslip_uploads` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `payslips` will be added. If there are existing duplicate values, this will fail.
  - The required column `uuid` was added to the `employees` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - The required column `uuid` was added to the `payslip_uploads` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - The required column `uuid` was added to the `payslips` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "uuid" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "payslip_uploads" ADD COLUMN     "uuid" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "payslips" ADD COLUMN     "uuid" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "employees_uuid_key" ON "employees"("uuid");

-- CreateIndex
CREATE INDEX "employees_uuid_idx" ON "employees"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "payslip_uploads_uuid_key" ON "payslip_uploads"("uuid");

-- CreateIndex
CREATE INDEX "payslip_uploads_uuid_idx" ON "payslip_uploads"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "payslips_uuid_key" ON "payslips"("uuid");

-- CreateIndex
CREATE INDEX "payslips_uuid_idx" ON "payslips"("uuid");
