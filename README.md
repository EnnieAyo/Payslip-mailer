# Payslip Mailer

A NestJS application for automatically distributing bulk payslips to employees via email. The system receives PDF payslips, extracts employee information (IPPIS number), matches them with employee records, and sends individualized emails with their respective payslips.

## Features

- **Bulk Payslip Upload**: Upload PDF files containing multiple payslips
- **Automatic PDF Extraction**: Extracts IPPIS numbers from payslips
- **Employee Matching**: Automatically matches payslips to employees in the database
- **Email Distribution**: Sends payslips to employees' email addresses
- **Upload Tracking**: Monitor the status of payslip uploads
- **Failed Email Management**: Retry sending failed payslips
- **Employee Management**: CRUD operations for employee records
- **Database Integration**: Uses Prisma ORM with PostgreSQL

## Tech Stack

- **Framework**: NestJS 10.x
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Email**: Nodemailer
- **PDF Processing**: pdf-parse
- **Language**: TypeScript

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (local or remote)
- npm or yarn

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Payslip-mailer
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Update `.env` with your configuration:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/payslip_mailer"
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   SMTP_FROM=noreply@company.com
   PORT=3000
   NODE_ENV=development
   ```

4. **Setup Database**
   ```bash
   # Push schema to database
   npm run db:push
   
   # Or create and run migrations
   npm run db:migrate
   
   # Seed sample data
   npm run db:seed
   ```

## Running the Application

### Development
```bash
npm run start:dev
```

### Production
```bash
npm run build
npm run start:prod
```

## API Endpoints

### Payslip Management

**Upload Payslips**
```http
POST /payslips/upload
Content-Type: multipart/form-data

file: <PDF file>
```

**Get Upload Status**
```http
GET /payslips/upload/:uploadId
```

**Get Employee Payslips**
```http
GET /payslips/employee/:employeeId
```

**Get Unsent Payslips**
```http
GET /payslips/unsent
```

**Resend Payslip**
```http
POST /payslips/resend/:payslipId
```

### Employee Management

**Create Employee**
```http
POST /employees
Content-Type: application/json

{
  "ippisNumber": "IPPIS001",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@company.com",
  "department": "Finance"
}
```

**Get All Employees**
```http
GET /employees
```

**Get Employee by ID**
```http
GET /employees/:id
```

**Update Employee**
```http
PUT /employees/:id
Content-Type: application/json

{
  "email": "new-email@company.com"
}
```

**Delete Employee**
```http
DELETE /employees/:id
```

## Database Schema

### Employee
- `id`: Integer (Primary Key)
- `ippisNumber`: String (Unique)
- `firstName`: String
- `lastName`: String
- `email`: String (Unique)
- `department`: String (Optional)
- `createdAt`: DateTime
- `updatedAt`: DateTime

### Payslip
- `id`: Integer (Primary Key)
- `ippisNumber`: String
- `fileName`: String
- `filePath`: String
- `pdfContent`: Bytes
- `employeeId`: Integer (Foreign Key)
- `emailSent`: Boolean (default: false)
- `emailSentAt`: DateTime (Optional)
- `createdAt`: DateTime
- `updatedAt`: DateTime

### PayslipUpload
- `id`: Integer (Primary Key)
- `fileName`: String
- `filePath`: String
- `totalFiles`: Integer
- `successCount`: Integer
- `failureCount`: Integer
- `status`: String (pending, processing, completed)
- `createdAt`: DateTime
- `updatedAt`: DateTime

## Configuration

### SMTP Configuration (Gmail)

1. Enable 2-factor authentication on your Gmail account
2. Generate an App Password at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. Use the generated password in `SMTP_PASS` environment variable

### PDF Extraction

The `PdfService` extracts IPPIS numbers from payslips using regex patterns. You may need to customize the regex in [pdf.service.ts](src/pdf/pdf.service.ts) based on your payslip format:

```typescript
const ippisMatch = text.match(/IPPIS\s*:?\s*([A-Z0-9]+)/i);
```

## Project Structure

```
src/
├── app.controller.ts          # Main app controller
├── app.service.ts             # Main app service
├── app.module.ts              # Main app module
├── main.ts                    # Application entry point
├── email/
│   ├── email.service.ts       # Email sending logic
│   └── email.module.ts        # Email module
├── employee/
│   ├── employee.controller.ts # Employee endpoints
│   ├── employee.service.ts    # Employee business logic
│   ├── employee.module.ts     # Employee module
│   └── dto/
│       ├── create-employee.dto.ts
│       └── update-employee.dto.ts
├── payslip/
│   ├── payslip.controller.ts  # Payslip endpoints
│   ├── payslip.service.ts     # Payslip business logic
│   └── payslip.module.ts      # Payslip module
├── pdf/
│   ├── pdf.service.ts         # PDF processing logic
│   └── pdf.module.ts          # PDF module
└── prisma/
    ├── prisma.service.ts      # Prisma client service
    └── prisma.module.ts       # Prisma module

prisma/
├── schema.prisma              # Database schema
└── seed.ts                    # Database seed script
```

## Development Workflow

1. Modify database schema in [prisma/schema.prisma](prisma/schema.prisma)
2. Run migrations: `npm run db:migrate`
3. Update services and controllers
4. Test API endpoints
5. Commit changes

## Future Enhancements

- [ ] Advanced PDF splitting for bulk payslips with multiple pages
- [ ] Scheduled payslip distribution
- [ ] Payment reconciliation
- [ ] Email templates customization
- [ ] Support for multiple file formats (Excel, CSV)
- [ ] Analytics and reporting dashboard
- [ ] Rate limiting for API endpoints
- [ ] Authentication and authorization
- [ ] Notification webhooks

## Troubleshooting

### Email Not Sending
- Verify SMTP credentials
- Check firewall/security settings
- Enable "Less secure app access" (for Gmail)
- Review email service logs

### PDF Parsing Issues
- Ensure PDF is not encrypted
- Check if IPPIS format matches regex pattern
- Adjust regex in [PdfService](src/pdf/pdf.service.ts)

### Database Connection Issues
- Verify PostgreSQL is running
- Check DATABASE_URL format
- Ensure database exists and is accessible

## License

MIT
A NestJS app used for mailing bulk payslip to employees
