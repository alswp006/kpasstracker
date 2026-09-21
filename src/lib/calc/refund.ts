import type { Ride, Settings } from '@/lib/contract';
import type { UserType } from '@/lib/types';
import { MAX_REFUND_RIDES, MIN_RIDES, REFUND_RATE_PCT } from '@/lib/kpassPolicy';
import { isValidCount, isValidPositive, isValidType } from './guards';

/** floor(min(rides,60) × fare × rate / 10) × 10 — 21회 미만이면 0 */
export function calcRefund(rides: unknown, fare: unknown, userType: unknown): number {
  if (!isValidCount(rides) || !isValidPositive(fare) || !isValidType(userType)) return 0;
  if (rides < MIN_RIDES) return 0;
  const base = Math.min(rides, MAX_REFUND_RIDES) * fare * REFUND_RATE_PCT[userType];
  const result = Math.floor(base / 1000) * 10;
  return Number.isFinite(result) ? result : 0;
}

/** 실부담액 = 낸 교통비 − 환급액 */
export function calcKpassNetCost(rides: unknown, fare: unknown, userType: unknown): number {
  if (!isValidCount(rides) || !isValidPositive(fare) || !isValidType(userType)) return 0;
  const cost = rides * fare - calcRefund(rides, fare, userType);
  return Number.isFinite(cost) ? cost : 0;
}

/** K-패스 실부담액이 정기권 가격을 처음 넘는 이용 횟수(0~200회 탐색). 없으면 null */
export function calcBreakEven(fare: unknown, userType: unknown, passPrice: unknown): number | null {
  if (!isValidPositive(fare) || !isValidType(userType) || !isValidPositive(passPrice)) return null;
  for (let n = 0; n <= 200; n++) {
    if (calcKpassNetCost(n, fare, userType) > passPrice) return n;
  }
  return null;
}

/** 계약 시그니처: 기록 목록의 실부담액 = 낸 교통비 합계 − 환급액(일반 유형, 평균 요금 기준). 0 미만은 0 */
export function calcNetCost(rides: Ride[], settings: Settings): number {
  const list = Array.isArray(rides) ? rides.filter((r) => r && isValidPositive(r.amountKrw)) : [];
  if (list.length === 0) return 0;
  const total = list.reduce((sum, r) => sum + r.amountKrw, 0);
  const fare = total / list.length;
  const type = 'general';
  const refund = calcRefund(list.length, fare, type);
  const cost = total - refund;
  return Number.isFinite(cost) && cost > 0 ? cost : 0;
}
