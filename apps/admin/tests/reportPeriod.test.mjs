import assert from 'node:assert/strict'
import test from 'node:test'
import { reportPeriod } from '../src/reportPeriod.ts'

test('UTC midnight keeps the previous operation day until midnight in São Paulo', () => {
  assert.deepEqual(reportPeriod(new Date('2026-10-14T02:30:00Z')), { start: '2026-10-07', end: '2026-10-13' })
  assert.deepEqual(reportPeriod(new Date('2026-10-14T03:00:00Z')), { start: '2026-10-08', end: '2026-10-14' })
})

test('the inclusive seven-day period crosses year and leap-month boundaries', () => {
  assert.deepEqual(reportPeriod(new Date('2027-01-01T12:00:00Z')), { start: '2026-12-26', end: '2027-01-01' })
  assert.deepEqual(reportPeriod(new Date('2028-03-01T12:00:00Z')), { start: '2028-02-24', end: '2028-03-01' })
})
