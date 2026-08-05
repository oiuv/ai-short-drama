import { describe, expect, it } from 'vitest'
import { formatElapsedTime } from './use-timer'

describe('创作计时器', () => {
  it.each([
    [0, '0秒'],
    [9, '9秒'],
    [59, '59秒'],
    [60, '1分00秒'],
    [65, '1分05秒'],
    [3_661, '61分01秒'],
    [-1, '0秒'],
  ])('把 %i 秒格式化为 %s', (seconds, expected) => {
    expect(formatElapsedTime(seconds)).toBe(expected)
  })
})
