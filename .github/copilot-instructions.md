**Project Overview**

- **Summary:** A NestJS application that extracts IPPIS numbers from uploaded PDF payslips, matches them to employees (Prisma + PostgreSQL), and emails individualized payslips via SMTP.
- **Primary modules:** `src/payslip`, `src/employee`, `src/email`, `src/pdf`, `src/prisma`.

**How To Run**

- **Dev:** `npm run start:dev` — start Nest in watch mode.
- **Build:** `npm run build` then `npm run start:prod` (production `dist/main` is ESM).
- **DB workflows:**
  - Schema changes: `npm run db:migrate` (dev migrations) or `npm run db:push` (sync schema).
  - Seed: `npm run db:seed` (`prisma/seed.ts`).

**Key Conventions & Patterns (Project-specific)**

- **Module-per-feature:** Each feature follows Nest conventions: module, controller, service. See `src/employee`, `src/payslip`, `src/email`, `src/pdf`.
- **Prisma usage:** `src/prisma/prisma.service.ts` extends `PrismaClient` and is exported by `src/prisma/prisma.module.ts` for DI. Use `PrismaService` directly in services.
- **PDF pipeline:** `PdfService` (in `src/pdf/pdf.service.ts`) exposes `extractIppisFromPdf`, `splitBulkPdf`, and `savePdfFile`.
  - IPPIS extraction uses a simple regex: `text.match(/IPPIS\s*:?\s*([A-Z0-9]+)/i)` — update this when payslip formats change.
  - `savePdfFile` stores files under `uploads/<uploadId>` relative to `process.cwd()`.
- **Email sending:** `EmailService` (in `src/email/email.service.ts`) constructs a Nodemailer transporter from env vars (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`). Methods return boolean success flags and log errors.
- **DTOs & Validation:** DTOs live under `src/*/dto`. `class-validator` / `class-transformer` are listed as dependencies — expect DTOs to use decorators (e.g., `@IsEmail`, `@IsString`). The project does not auto-apply a global ValidationPipe in `src/main.ts` (add it if you need request validation enforced).
- **Error handling:** Services throw Nest exceptions (e.g., `BadRequestException` in PDF parsing). Many service methods catch errors and return booleans; follow the same pattern when integrating.
- **ESM mode:** `package.json` uses `