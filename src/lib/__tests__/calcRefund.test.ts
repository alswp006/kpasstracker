import { describe, it, expect } from 'vitest';
import { calcRefund, calcKpassNetCost, calcBreakEven, calcNetCost } from '@/lib/calc/refund';

describe('calcRefund', () => {
  it('AC-1: 유형별 환급액', () => {
    expect(calcRefund(22, 1500, 'general')).toBe(6600);
    expect(calcRefund(30, 1500, 'youth')).toBe(13500);
    expect(calcRefund(21, 1500, 'lowIncome')).toBe(16690);
    expect(calcRefund(20, 1500, 'lowIncome')).toBe(0);
    expect(calcRefund(75, 1500, 'general')).toBe(18000);
  });

  it('AC-2: 손익분기', () => {
    expect(calcBreakEven(1500, 'general', 55000)).toBe(46);
    expect(calcBreakEven(1500, 'general', 500000)).toBeNull();
  });

  it('AC-3: 잘못된 입력은 0/null, 예외 없음', () => {
    const bad: unknown[] = [NaN, Infinity, -1, '22', undefined, null];
    for (const b of bad) {
      expect(calcRefund(b, 1500, 'general')).toBe(0);
      expect(calcRefund(22, b, 'general')).toBe(0);
      expect(calcKpassNetCost(b, 1500, 'general')).toBe(0);
      expect(calcBreakEven(b, 'general', 55000)).toBeNull();
      expect(calcBreakEven(1500, 'general', b)).toBeNull();
    }
    expect(calcRefund(22, 1500, 'bad')).toBe(0);
    expect(calcKpassNetCost(22, 1500, 'bad')).toBe(0);
    expect(calcBreakEven(1500, 'bad', 55000)).toBeNull();
  });
});

describe('calcNetCost (contract)', () => {
  const settings = { monthlyPassPrice: 62000, dailyPassPrice: 5000, singleRidePrice: 1500 };
  const mk = (n: number) => Array.from({ length: n }, (_, i) => ({ id: String(i), date: '2026-09-01', amountKrw: 1500 }));

  it('returns 0 for empty or invalid input', () => {
    expect(calcNetCost([], settings)).toBe(0);
    expect(calcNetCost(null as never, settings)).toBe(0);
  });

  it('no refund below 21 rides: net = total', () => {
    expect(calcNetCost(mk(20), settings)).toBe(30000);
  });

  it('subtracts refund at 22 rides', () => {
    expect(calcNetCost(mk(22), settings)).toBe(22 * 1500 - calcRefund(22, 1500, 'general'));
  });
});
