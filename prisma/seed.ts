import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from "../src/generated/prisma/client";
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
  accelerateUrl: undefined,
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  }),
});

async function main() {
  // Clear existing data
  await prisma.payslip.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.user.deleteMany();

  // Seed users with admin and payroll manager roles
  const adminPassword = await bcrypt.hash('admin123456', 10);
  const managerPassword = await bcrypt.hash('manager123456', 10);

  const users = await Promise.all([
    prisma.user.create({
      data: {
        email: 'admin@company.com',
        password: adminPassword,
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
        permissions: [
          'payslips:read',
          'payslips:write',
          'employees:read',
          'employees:write',
          'users:read',
          'users:write',
        ],
        isActive: true,
        isLocked: false,
        failedLoginAttempts: 0,
      },
    }),
    prisma.user.create({
      data: {
        email: 'manager@company.com',
        password: managerPassword,
        firstName: 'Payroll',
        lastName: 'Manager',
        role: 'payroll_manager',
        permissions: [
          'payslips:read',
          'payslips:write',
          'employees:read',
        ],
        isActive: true,
        isLocked: false,
        failedLoginAttempts: 0,
      },
    }),
  ]);

  console.log(`Seeded ${users.length} users`);
  console.log('Default login credentials:');
  console.log('  Admin: admin@company.com / admin123456');
  console.log('  Manager: manager@company.com / manager123456');

  // Seed employees
  const employees = await Promise.all([
    prisma.employee.create({
      data: {
        ippisNumber: 'IPPIS001',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@company.com',
        department: 'Finance',
      },
    }),
    prisma.employee.create({
      data: {
        ippisNumber: 'IPPIS002',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@company.com',
        department: 'HR',
      },
    }),
    prisma.employee.create({
      data: {
        ippisNumber: 'IPPIS003',
        firstName: 'Michael',
        lastName: 'Johnson',
        email: 'michael.johnson@company.com',
        department: 'IT',
      },
    }),
  ]);

  console.log(`Seeded ${employees.length} employees`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
