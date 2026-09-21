import type { PassComparison, RiskResult } from '@/lib/types';
import { MIN_RIDES } from '@/lib/kpassPolicy';

/** 하루 현실적인 최대 이용 횟수(출퇴근 왕복) — 남은 날로 채울 수 있는지 판단 */
const RIDES_PER_DAY = 2;
const INSIGHT_MAX_RIDES = 120;

function normCount(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function monthProgress(now: Date): { day: number; daysInMonth: number } {
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return { day: now.getDate(), daysInMonth };
}

/** 지금 페이스로 월말까지 이용할 횟수 = floor(count / 경과일 × 월 일수) */
export function calcProjection(count: number, now: Date = new Date()): number {
  const c = normCount(count);
  const { day, daysInMonth } = monthProgress(now);
  const result = Math.floor((c / day) * daysInMonth);
  return Number.isFinite(result) ? result : 0;
}

/** 우선순위: achieved → danger → not_started → on_track → warning */
export function calcRisk(count: number, now: Date = new Date()): RiskResult {
  const c = normCount(count);
  const { day, daysInMonth } = monthProgress(now);
  const projection = calcProjection(c, now);
  const remaining = Math.max(0, MIN_RIDES - c);
  const remainingDays = daysInMonth - day + 1;

  let status: RiskResult['status'];
  if (c >= MIN_RIDES) status = 'achieved';
  else if (remaining > remainingDays * RIDES_PER_DAY) status = 'danger';
  else if (c === 0) status = 'not_started';
  else if (projection >= MIN_RIDES) status = 'on_track';
  else status = 'warning';

  return { status, projection, remaining, remainingDays };
}

/** K-패스 실부담액과 정기권 가격 비교. 정기권 가격이 없으면 비교 불가 → even */
export function comparePass(kpassNetCost: number, passPrice: number | null, _rides?: number): PassComparison {
  if (typeof passPrice !== 'number' || !Number.isFinite(passPrice)) {
    return { kpassNetCost: 0, passPrice: 0, winner: 'even', diff: 0 };
  }
  const cost = Number.isFinite(kpassNetCost) ? kpassNetCost : 0;
  const diff = Math.abs(cost - passPrice);
  const winner = cost < passPrice ? 'kpass' : cost > passPrice ? 'pass' : 'even';
  return { kpassNetCost: cost, passPrice, winner, diff };
}

/** 인사이트 화면 초기 횟수 = min(max(예상, 현재), 120) */
export function calcInsightInitialRides(count: number, now: Date = new Date()): number {
  const c = normCount(count);
  return Math.min(Math.max(calcProjection(c, now), c), INSIGHT_MAX_RIDES);
}
