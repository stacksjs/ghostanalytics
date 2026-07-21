/**
 * Digest period helpers (issue #14).
 */
import { describe, expect, test } from 'bun:test'
import { pctChange, periodWindows } from '../../scripts/analytics/lib'

describe('periodWindows', () => {
  const now = new Date('2026-07-21T00:00:00.000Z')

  test('current window is the last N days ending now', () => {
    const w = periodWindows(7, now)
    expect(w.curTo).toBe('2026-07-21T00:00:00.000Z')
    expect(w.curFrom).toBe('2026-07-14T00:00:00.000Z')
  })

  test('prior window is the N days immediately before, and abuts the current one', () => {
    const w = periodWindows(7, now)
    expect(w.prevFrom).toBe('2026-07-07T00:00:00.000Z')
    expect(w.prevTo).toBe('2026-07-14T00:00:00.000Z')
    expect(w.prevTo).toBe(w.curFrom) // no gap or overlap between periods
  })
})

describe('pctChange', () => {
  test('computes rounded percent change', () => {
    expect(pctChange(120, 100)).toBe(20)
    expect(pctChange(80, 100)).toBe(-20)
    expect(pctChange(150, 120)).toBe(25)
  })
  test('no baseline (prev 0) → null', () => {
    expect(pctChange(50, 0)).toBeNull()
    expect(pctChange(0, 0)).toBeNull()
  })
})
