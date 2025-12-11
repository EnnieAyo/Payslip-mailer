import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from "../src/generated/prisma/client";

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
