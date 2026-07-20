import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.productAiAnalysis.findFirst({ orderBy: { id: 'desc' } }).then(a => console.log(a?.aiFeasibility)).finally(() => prisma.$disconnect());
