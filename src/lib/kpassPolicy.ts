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
