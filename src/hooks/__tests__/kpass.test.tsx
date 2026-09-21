import type { ReactNode } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { KpassProvider, useRides } from '@/hooks/kpass';

const iso = '2026-09-01T00:00:00.000Z';

function seed(days: Record<string, number> = {}) {
  localStorage.setItem(
    'kpass:settings',
    JSON.stringify({ id: 'settings', version: 1, userType: 'general', avgFare: 1500, passPrice: null, createdAt: iso, updatedAt: iso }),
  );
  localStorage.setItem('kpass:rides', JSON.stringify({ id: 'rides', version: 1, days, createdAt: iso, updatedAt: iso }));
}

const wrapper = ({ children }: { children: ReactNode }) => <KpassProvider>{children}</KpassProvider>;

describe('kpass hooks', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 22, 12, 0, 0));
  });
  afterEach(() => vi.restoreAllMocks());

  it('AC1: increment raises todayCount and monthIndex', () => {
    seed({ '2026-09-22': 1 });
    const { result } = renderHook(() => useRides(), { wrapper });
    expect(result.current.todayCount).toBe(1);
    act(() => {
      expect(result.current.increment().ok).toBe(true);
    });
    expect(result.current.todayCount).toBe(2);
    expect(result.current.monthIndex.byMonth['2026-09']).toBe(2);
  });

  it('AC2: QUOTA keeps todayCount', () => {
    seed({ '2026-09-22': 1 });
    const { result } = renderHook(() => useRides(), { wrapper });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    let res: ReturnType<typeof result.current.increment> | undefined;
    act(() => {
      res = result.current.increment();
    });
    expect(res).toEqual({ ok: false, reason: 'QUOTA' });
    expect(result.current.todayCount).toBe(1);
  });

  it('AC3: reloads on visibilitychange', () => {
    seed({ '2026-09-22': 1 });
    const { result } = renderHook(() => useRides(), { wrapper });
    seed({ '2026-09-22': 5 });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current.todayCount).toBe(5);
  });
});
