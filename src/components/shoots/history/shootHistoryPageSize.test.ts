import { afterEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_SHOOT_HISTORY_PAGE_SIZE,
  isShootHistoryPageSize,
  readShootHistoryPageSize,
  shootHistoryPageSizeStorageKey,
  writeShootHistoryPageSize,
} from './shootHistoryPageSize'

afterEach(() => {
  localStorage.clear()
})

describe('Shoot History page size preference', () => {
  it('defaults to the live page size of 12 when unset', () => {
    expect(DEFAULT_SHOOT_HISTORY_PAGE_SIZE).toBe(12)
    expect(readShootHistoryPageSize('42')).toBe(12)
    expect(isShootHistoryPageSize(12)).toBe(true)
    expect(isShootHistoryPageSize(96)).toBe(true)
    expect(isShootHistoryPageSize(20)).toBe(false)
  })

  it('persists per user account rather than a shared bare key', () => {
    writeShootHistoryPageSize(7, 48)
    writeShootHistoryPageSize(9, 24)
    expect(localStorage.getItem(shootHistoryPageSizeStorageKey(7))).toBe('48')
    expect(localStorage.getItem(shootHistoryPageSizeStorageKey(9))).toBe('24')
    expect(localStorage.getItem('shoot-history-page-size')).toBeNull()
    expect(readShootHistoryPageSize(7)).toBe(48)
    expect(readShootHistoryPageSize(9)).toBe(24)
    expect(readShootHistoryPageSize(11)).toBe(12)
  })
})
