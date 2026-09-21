import { describe, it, expect, vi } from 'vitest';
import { loadSettings, loadMonthMeta, buildMonthIndex } from '@/lib/storage/loaders';

describe('loaders', () => {
  it('corrupt settings → null, storage untouched', () => {
    localStorage.setItem('kpass:settings', '{bad');
    const spy = vi.spyOn(Storage.prototype, 'setItem');
    expect(loadSettings()).toBeNull();
    expect(spy).not.toHaveBeenCalled();
    expect(localStorage.getItem('kpass:settings')).toBe('{bad');
    spy.mockRestore();
  });

  it('snapshot id is overwritten by its key', () => {
    const t = '2026-08-01T00:00:00Z';
    localStorage.setItem('kpass:monthMeta', JSON.stringify({
      id: 'monthMeta', version: 1, createdAt: t, updatedAt: t,
      months: { '2026-08': { id: 'x', userType: 'general', avgFare: 1500, createdAt: t, updatedAt: t } },
    }));
    expect(loadMonthMeta()?.months['2026-08'].id).toBe('2026-08');
  });

  it('buildMonthIndex', () => {
    expect(buildMonthIndex('abc')).toEqual({ byMonth: {}, monthsDesc: [] });
    expect(buildMonthIndex({ '2026-09-01': 2, '2026-08-03': 1 }).monthsDesc).toEqual(['2026-09', '2026-08']);
  });
});
