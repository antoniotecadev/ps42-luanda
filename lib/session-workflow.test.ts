import { describe, expect, it } from 'vitest'
import {
  canApplyAction,
  getAuditAction,
  getUpdateData,
  removesFromQueue,
  requiresStaffRole,
  type SessionAction,
} from './session-workflow'

describe('session-workflow transitions', () => {
  it('permite approve apenas em PENDING', () => {
    expect(canApplyAction('PENDING', 'approve')).toBe(true)
    expect(canApplyAction('APPROVED', 'approve')).toBe(false)
    expect(canApplyAction('ACTIVE', 'approve')).toBe(false)
  })

  it('permite start apenas em APPROVED', () => {
    expect(canApplyAction('APPROVED', 'start')).toBe(true)
    expect(canApplyAction('PENDING', 'start')).toBe(false)
    expect(canApplyAction('ACTIVE', 'start')).toBe(false)
  })

  it('permite cancel em PENDING/APPROVED', () => {
    expect(canApplyAction('PENDING', 'cancel')).toBe(true)
    expect(canApplyAction('APPROVED', 'cancel')).toBe(true)
    expect(canApplyAction('ACTIVE', 'cancel')).toBe(false)
  })
})

describe('session-workflow authorization', () => {
  it('marca ações staff-only corretamente', () => {
    const staffActions: SessionAction[] = ['approve', 'reject', 'start', 'end', 'extend']
    for (const action of staffActions) {
      expect(requiresStaffRole(action)).toBe(true)
    }
    expect(requiresStaffRole('cancel')).toBe(false)
  })
})

describe('session-workflow queue/audit helpers', () => {
  it('identifica ações que removem da fila', () => {
    expect(removesFromQueue('start')).toBe(true)
    expect(removesFromQueue('reject')).toBe(true)
    expect(removesFromQueue('cancel')).toBe(true)
    expect(removesFromQueue('approve')).toBe(false)
    expect(removesFromQueue('end')).toBe(false)
  })

  it('gera action de auditoria por acção', () => {
    expect(getAuditAction('approve')).toBe('SESSION_APPROVED')
    expect(getAuditAction('start')).toBe('SESSION_STARTED')
    expect(getAuditAction('end')).toBe('SESSION_ENDED')
  })

  it('gera update data consistente para start/cancel', () => {
    const startData = getUpdateData('start', true)
    expect(startData.status).toBe('ACTIVE')
    expect(startData.durationMin).toBe(60)
    expect(startData.queuePos).toBeNull()

    const cancelData = getUpdateData('cancel', false, 'cancelado pelo cadete')
    expect(cancelData.status).toBe('CANCELLED')
    expect(cancelData.endedBy).toBe('student')
    expect(cancelData.queuePos).toBeNull()
    expect(cancelData.staffNote).toBe('cancelado pelo cadete')
  })
})
