// Kết nối database dùng chung cho toàn app (singleton).
// Luôn import prisma từ file này, KHÔNG tự new PrismaClient() ở nơi khác
// để tránh mở quá nhiều kết nối khi Next.js hot-reload lúc dev.
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
