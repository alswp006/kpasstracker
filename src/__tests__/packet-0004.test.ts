import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { KpassProvider, useRides } from '@/hooks/kpass';

const ISO = '2026-09-01T00:00:00.000Z';
const TODAY = '2026-09-22';

function seed(days: Record<string, number>) {
  localStorage.setItem(
    'kpass:settings',
    JSON.stringify({ id: 'settings', version: 1, userType: 'general', avgFare: 1500, passPrice: null, createdAt: ISO, updatedAt: ISO }),
  );
  localStorage.setItem('kpass:rides', JSON.stringify({ id: 'rides', version: 1, days, createdAt: ISO, updatedAt: ISO }));
  localStorage.setItem(
    'kpass:monthMeta',
    JSON.stringify({
      id: 'monthMeta', version: 1, createdAt: ISO, updatedAt: ISO,
      months: { '2026-09': { id: '2026-09', userType: 'general', avgFare: 1500, createdAt: ISO, updatedAt: ISO } },
    }),
  );
}

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(KpassProvider, null, children);

describe('KpassProvider and useSettings/useRides/useMonthMeta hooks', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 22, 12, 0, 0));
  });
  afterEach(() => vi.restoreAllMocks());

  it('AC-0: reads state synchronously from localStorage on first render', () => {
    seed({ '2026-09-21': 2, [TODAY]: 3 });
    const { result } = renderHook(() => useRides(), { wrapper });
    expect(result.current.todayCount).toBe(3);
    expect(result.current.monthIndex.byMonth['2026-09']).toBe(5);
  });

  it('AC-1[P0]: increment() ok raises todayCount and monthIndex by 1', () => {
    seed({ '2026-09-21': 2 });
    const { result } = renderHook(() => useRides(), { wrapper });
    expect(result.current.todayCount).toBe(0);
    expect(result.current.monthIndex.byMonth['2026-09']).toBe(2);

    let res: unknown;
    act(() => {
      res = result.current.increment();
    });
    expect(res).toEqual({ ok: true, count: 1 });
    expect(result.current.todayCount).toBe(1);
    expect(result.current.monthIndex.byMonth['2026-09']).toBe(3);
  });

  it('AC-2[P0]: QUOTA on setItem keeps todayCount and returns reason QUOTA', () => {
    seed({ [TODAY]: 2 });
    const { result } = renderHook(() => useRides(), { wrapper });
    expect(result.current.todayCount).toBe(2);

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    let res: { ok: boolean; reason?: string } | undefined;
    act(() => {
      res = result.current.increment() as { ok: boolean; reason?: string };
    });
    expect(res?.ok).toBe(false);
    expect(res?.reason).toBe('QUOTA');
    expect(result.current.todayCount).toBe(2);
    expect(result.current.monthIndex.byMonth['2026-09']).toBe(2);
  });

  it('AC-3[P0]: visibilitychange (visible) reloads externally changed storage', () => {
    seed({ [TODAY]: 1 });
    const { result } = renderHook(() => useRides(), { wrapper });
    expect(result.current.todayCount).toBe(1);

    seed({ [TODAY]: 7, '2026-09-20': 4 });
    expect(result.current.todayCount).toBe(1);

    act(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current.todayCount).toBe(7);
    expect(result.current.monthIndex.byMonth['2026-09']).toBe(11);
  });

  it('AC-3: hidden visibilitychange does not reload', () => {
    seed({ [TODAY]: 1 });
    const { result } = renderHook(() => useRides(), { wrapper });
    seed({ [TODAY]: 9 });

    act(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current.todayCount).toBe(1);
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    expect(document.visibilityState).toBe('visible');
  });
});
