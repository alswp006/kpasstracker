import type { PassComparison, RiskResult } from '@/lib/types';
import { calcBreakEven, calcKpassNetCost, calcRefund } from '@/lib/calc/refund';
import { calcRisk, comparePass } from '@/lib/calc/risk';

export * from '@/lib/calc/refund';
export * from '@/lib/calc/risk';

/** 화면이 한 번에 필요로 하는 월간 계산 결과 묶음 */
export interface MonthSummary {
  refund: number;
  netCost: number;
  risk: RiskResult;
  breakEven: number | null;
  comparison: PassComparison;
}

/**
 * 이용 횟수·평균 요금·유형·정기권 가격으로 환급액, 실부담액, 위험도, 손익분기,
 * 정기권 비교를 한 번에 계산한다. 비정상 입력은 각 함수의 방어 규칙대로 0/null이 되며 예외를 던지지 않는다.
 */
export function calcMonthSummary(
  rides: unknown,
  fare: unknown,
  userType: unknown,
  passPrice: unknown = null,
  now: Date = new Date(),
): MonthSummary {
  const count = typeof rides === 'number' && Number.isFinite(rides) && rides > 0 ? Math.floor(rides) : 0;
  const price = typeof passPrice === 'number' && Number.isFinite(passPrice) && passPrice > 0 ? passPrice : null;
  const netCost = calcKpassNetCost(count, fare, userType);

  return {
    refund: calcRefund(count, fare, userType),
    netCost,
    risk: calcRisk(count, now),
    breakEven: calcBreakEven(fare, userType, price),
    comparison: comparePass(count, fare as number, userType, price),
  };
}
