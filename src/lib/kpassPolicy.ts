/** 기록 보존 개월 수 */
export const RETENTION_MONTHS = 12;

/** 하루 최대 탑승 기록 횟수 */
export const DAILY_MAX = 20;

/** 보존 기간 시작 월(YYYY-MM) = 기준일의 월 − 12개월 */
export function cutoffMonth(now: Date = new Date()): string {
  const total = now.getFullYear() * 12 + now.getMonth() - RETENTION_MONTHS;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

/** 환급 최소 이용 횟수 (미만이면 환급 0) */
export const MIN_RIDES = 21;

/** 환급 산정 상한 이용 횟수 */
export const MAX_REFUND_RIDES = 60;

/** 유형별 환급률(%) — 정수 퍼센트로 두어 부동소수 오차를 피한다 */
export const REFUND_RATE_PCT = {
  general: 20,
  youth: 30,
  lowIncome: 53,
} as const;
