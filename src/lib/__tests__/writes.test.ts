import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { incrementToday, decrementToday, setDayCount, saveSettings } from '@/lib/kpassStore';

const T = '2026-09-22';

function seed(days: Record<string, number> = {}) {
  const iso = '2026-09-01T00:00:00.000Z';
  localStorage.setItem(
    'kpass:settings',
    JSON.stringify({ id: 'settings', version: 1, userType: 'general', avgFare: 1500, passPrice: null, createdAt: iso, updatedAt: iso }),
  );
  localStorage.setItem('kpass:rides', JSON.stringify({ id: 'rides', version: 1, days, createdAt: iso, updatedAt: iso }));
  localStorage.setItem(
    'kpass:monthMeta',
    JSON.stringify({
      id: 'monthMeta', version: 1, createdAt: iso, updatedAt: iso,
      months: { '2026-08': { id: '2026-08', userType: 'general', avgFare: 1500, createdAt: iso, updatedAt: iso } },
    }),
  );
}

describe('writes', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 22, 12, 0, 0));
  });
  afterEach(() => vi.restoreAllMocks());

  it('AC1: NO_SETTINGS leaves rides absent', () => {
    expect(incrementToday()).toEqual({ ok: false, reason: 'NO_SETTINGS' });
    expect(localStorage.getItem('kpass:rides')).toBeNull();
  });

  it('AC2: limits and invalid date', () => {
    seed({ [T]: 20 });
    expect(incrementToday()).toEqual({ ok: false, reason: 'DAILY_MAX' });
    seed({});
    expect(decrementToday()).toEqual({ ok: false, reason: 'BELOW_ZERO' });
    expect(setDayCount('2026-09-23', 1)).toEqual({ ok: false, reason: 'INVALID_DATE' });
  });

  it('increments, decrements and deletes key at 0', () => {
    seed({});
    expect(incrementToday()).toEqual({ ok: true, count: 1 });
    expect(decrementToday()).toEqual({ ok: true, count: 0 });
    expect(JSON.parse(localStorage.getItem('kpass:rides')!).days[T]).toBeUndefined();
    incrementToday();
    expect(JSON.parse(localStorage.getItem('kpass:monthMeta')!).months['2026-09']).toBeDefined();
  });

  it('AC3: QUOTA on second key rolls back both', () => {
    seed({});
    const r = localStorage.getItem('kpass:rides');
    const m = localStorage.getItem('kpass:monthMeta');
    const orig = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      if (k === 'kpass:monthMeta') throw new DOMException('full', 'QuotaExceededError');
      return orig.call(this, k, v);
    });
    expect(incrementToday()).toEqual({ ok: false, reason: 'QUOTA' });
    expect(localStorage.getItem('kpass:rides')).toBe(r);
    expect(localStorage.getItem('kpass:monthMeta')).toBe(m);
  });

  it('AC4: prunes old days; past month creates no snapshot', () => {
    seed({ '2025-08-15': 2 });
    const before = JSON.parse(localStorage.getItem('kpass:monthMeta')!).months['2026-08'];
    expect(setDayCount('2026-08-10', 3)).toEqual({ ok: true, count: 3 });
    const days = JSON.parse(localStorage.getItem('kpass:rides')!).days;
    expect(days['2025-08-15']).toBeUndefined();
    expect(days['2026-08-10']).toBe(3);
    expect(JSON.parse(localStorage.getItem('kpass:monthMeta')!).months['2026-08']).toEqual(before);
    expect(JSON.parse(localStorage.getItem('kpass:monthMeta')!).months['2026-09']).toBeUndefined();
  });

  it('saveSettings writes settings and snapshot', () => {
    expect(saveSettings({ userType: 'youth', avgFare: 1400, passPrice: null })).toEqual({ ok: true });
    expect(JSON.parse(localStorage.getItem('kpass:monthMeta')!).months['2026-09'].userType).toBe('youth');
  });
});
