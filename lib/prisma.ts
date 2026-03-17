/* Evita criar múltiplas instâncias do Prisma em desenvolvimento */

// import { PrismaClient } from '@prisma/client'
import { PrismaClient } from "./generated/prisma/client";

// Verifica se já existe uma instância do Prisma no ambiente global
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Se não existir, cria uma nova instância do PrismaClient
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
  })

// Atribui a instância do Prisma ao ambiente global para reutilização em desenvolvimento
if (process.env.NODE_ENV !== 'production')
  globalForPrisma.prisma = prisma