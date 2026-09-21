import { useContext, useState } from 'react';
import { UNSAFE_LocationContext } from 'react-router-dom';
import { useRides, useSettings } from '@/hooks/kpass';
import { calcInsightInitialRides } from '@/lib/kpassCalc';
import { getMonthKey, toDateKey } from '@/lib/dateKeys';

export const RIDE_MIN = 0;
export const RIDE_MAX = 120;
export const PRICE_MIN = 1000;
export const PRICE_MAX = 500000;

function digitsOnly(v: string): string {
  return v.replace(/[^0-9]/g, '');
}

export function parseIn(text: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return n >= min && n <= max ? n : null;
}

function readRouteRides(state: unknown): number | null {
  if (!state || typeof state !== 'object') return null;
  const v = (state as { rideCount?: unknown }).rideCount;
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return Math.min(Math.max(Math.trunc(v), RIDE_MIN), RIDE_MAX);
}

/** 입력칸 문자열 상태. 검증·계산은 소비 쪽(InsightFree)에서 한다 */
export function useInsightInputs() {
  // useLocation과 동일한 값 — 라우터 밖(null)에서도 죽지 않도록 컨텍스트에서 직접 읽는다
  const location = useContext(UNSAFE_LocationContext).location;
  const { settings } = useSettings();
  const { monthIndex } = useRides();

  const [rideCount, setRideCount] = useState<string>(() => {
    const fromRoute = readRouteRides(location.state);
    if (fromRoute !== null) return String(fromRoute);
    const now = new Date();
    const count = monthIndex.byMonth[getMonthKey(toDateKey(now))] ?? 0;
    return String(calcInsightInitialRides(count, now));
  });
  const [passPrice, setPassPrice] = useState<string>(() =>
    settings?.passPrice != null ? String(settings.passPrice) : '',
  );

  return {
    rideCount,
    passPrice,
    setRideCount: (v: string) => setRideCount(digitsOnly(v)),
    setPassPrice: (v: string) => setPassPrice(digitsOnly(v)),
  };
}

export type InsightInputs = ReturnType<typeof useInsightInputs>;
