import { Prisma, SessionStatus } from '@prisma/client'

export const SESSION_ACTIONS = ['approve', 'reject', 'start', 'end', 'extend', 'cancel'] as const
export type SessionAction = (typeof SESSION_ACTIONS)[number]

const TRANSITIONS: Record<SessionAction, SessionStatus[]> = {
  approve: ['PENDING'],
  reject: ['PENDING'],
  start: ['APPROVED'],
  end: ['ACTIVE'],
  extend: ['ACTIVE'],
  cancel: ['PENDING', 'APPROVED'],
}

const STAFF_ONLY_ACTIONS = new Set<SessionAction>(['approve', 'reject', 'start', 'end', 'extend'])
const QUEUE_REMOVAL_ACTIONS = new Set<SessionAction>(['start', 'reject', 'cancel'])

export function requiresStaffRole(action: SessionAction): boolean {
  return STAFF_ONLY_ACTIONS.has(action)
}

export function canApplyAction(status: SessionStatus, action: SessionAction): boolean {
  return TRANSITIONS[action].includes(status)
}

export function removesFromQueue(action: SessionAction): boolean {
  return QUEUE_REMOVAL_ACTIONS.has(action)
}

export function getAuditAction(action: SessionAction): string {
  const map: Record<SessionAction, string> = {
    approve: 'SESSION_APPROVED',
    reject: 'SESSION_REJECTED',
    start: 'SESSION_STARTED',
    end: 'SESSION_ENDED',
    extend: 'SESSION_EXTENDED',
    cancel: 'SESSION_CANCELLED',
  }
  return map[action]
}

export function getUpdateData(action: SessionAction, isStaff: boolean, note?: string): Prisma.SessionUpdateInput {
  switch (action) {
    case 'approve':
      return { status: 'APPROVED' }
    case 'reject':
      return {
        status: 'REJECTED',
        staffNote: note ?? null,
        queuePos: null,
      }
    case 'start':
      return {
        status: 'ACTIVE',
        startedAt: new Date(),
        durationMin: 60,
        queuePos: null,
      }
    case 'end':
      return {
        status: 'DONE',
        endedAt: new Date(),
        endedBy: isStaff ? 'staff' : 'student',
      }
    case 'extend':
      return {
        extended: true,
        durationMin: 120,
      }
    case 'cancel':
      return {
        status: 'CANCELLED',
        endedAt: new Date(),
        endedBy: isStaff ? 'staff' : 'student',
        staffNote: note ?? null,
        queuePos: null,
      }
  }
}

export async function reindexQueuePositions(tx: Prisma.TransactionClient): Promise<void> {
  const queue = await tx.session.findMany({
    where: { status: { in: ['PENDING', 'APPROVED'] } },
    orderBy: [{ requestedAt: 'asc' }, { id: 'asc' }],
    select: { id: true },
  })

  await Promise.all(
    queue.map((item, index) =>
      tx.session.update({
        where: { id: item.id },
        data: { queuePos: index + 1 },
      })
    )
  )
}
