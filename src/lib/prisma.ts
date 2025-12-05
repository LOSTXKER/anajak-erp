/**
 * Prisma Client Instance
 * Singleton pattern to prevent multiple instances in development
 * Configured for Vercel Serverless Functions
 */

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  console.log('[Prisma] Creating new client...')
  console.log('[Prisma] DATABASE_URL exists:', !!process.env.DATABASE_URL)
  
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma

