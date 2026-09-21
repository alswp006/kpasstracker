import { describe, it, expect } from 'vitest';
import { cutoffMonth } from '@/lib/kpassPolicy';
import { isValidRecordDate, toDateKey, formatDayLabel } from '@/lib/dateKeys';

const NOW = new Date(2026, 8, 22, 12, 0, 0);

describe('dateKeys', () => {
  it('cutoffMonth(2026-09-22) === 2025-09', () => {
    expect(cutoffMonth(new Date(2026, 8, 22))).toBe('2025-09');
  });
  it('isValidRecordDate 경계값', () => {
    expect(isValidRecordDate('2026-09-22', NOW)).toBe(true);
    expect(isValidRecordDate('2025-09-01', NOW)).toBe(true);
    expect(isValidRecordDate('2026-09-23', NOW)).toBe(false);
    expect(isValidRecordDate('2025-08-31', NOW)).toBe(false);
    expect(isValidRecordDate('2026-02-30', NOW)).toBe(false);
    expect(isValidRecordDate('2026-9-22', NOW)).toBe(false);
  });
  it('toDateKey는 로컬 날짜를 쓴다', () => {
    expect(toDateKey(new Date(2026, 8, 22, 0, 30))).toBe('2026-09-22');
  });
  it('formatDayLabel', () => {
    expect(formatDayLabel('2026-09-22')).toBe('9월 22일 (화)');
    expect(() => formatDayLabel('invalid')).not.toThrow();
  });
});

import { getMonthKey, parseYearMonth } from '@/lib/dateKeys';

describe('getMonthKey / parseYearMonth', () => {
  it('날짜에서 월키를 만든다', () => {
    expect(getMonthKey('2026-09-22')).toBe('2026-09');
    expect(getMonthKey('2026-02-30')).toBe('');
  });
  it('월키를 파싱한다', () => {
    expect(parseYearMonth('2026-09')).toEqual({ year: 2026, month: 9 });
    expect(parseYearMonth('2026-13')).toEqual({ year: 0, month: 0 });
    expect(parseYearMonth('bad')).toEqual({ year: 0, month: 0 });
  });
});
