import type { PassComparison, UserType } from '@/lib/types';
import { MIN_RIDES, REFUND_RATE_PCT } from '@/lib/kpassPolicy';
import { calcRefund, calcRisk } from '@/lib/kpassCalc';

export interface RiskCopy {
  line1: string;
  line2: string;
  badge: string;
}

export interface RefundCopy {
  amount: string;
  sub: string;
}

export interface VerdictCopy {
  text: string;
  badge: string;
}

const TYPE_NAME: Record<UserType, string> = {
  general: '일반',
  youth: '청년',
  lowIncome: '저소득',
};

/** 1,234원 형식. 비정상 값은 0원 */
export function formatWon(n: unknown): string {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.trunc(n) : 0;
  return `${v.toLocaleString('ko-KR')}원`;
}

/** contract.ts formatAmountFn — "1,234원". currency 기본 '원', decimals 기본 0. 비정상 값은 0 */
export function formatAmount(amount: number, opts?: { currency?: string; decimals?: number }): string {
  const currency = opts?.currency ?? '원';
  const d = opts?.decimals;
  const decimals = typeof d === 'number' && Number.isFinite(d) ? Math.min(Math.max(Math.trunc(d), 0), 20) : 0;
  const v = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  const factor = 10 ** decimals;
  const rounded = Math.round(Math.abs(v) * factor) / factor;
  const sign = v < 0 && rounded !== 0 ? '-' : '';
  const num = rounded.toLocaleString('ko-KR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return `${sign}${num}${currency}`;
}

/** contract.ts formatDisplayFn — "라벨 1,234원" */
export function formatDisplay(label: string, amount: number): string {
  return `${label} ${formatAmount(amount)}`;
}

/** 홈 위험도 카드 문구 (S2 표) */
export function riskCopy(count: number, now: Date = new Date()): RiskCopy {
  const { status, projection, remaining, remainingDays } = calcRisk(count, now);
  switch (status) {
    case 'achieved':
      return { line1: `이번 달 환급 조건 ${MIN_RIDES}회를 채웠어요`, line2: '', badge: '달성' };
    case 'danger':
      return { line1: `남은 ${remainingDays}일 동안 ${remaining}회를 채우기 어려워요`, line2: '', badge: '위험' };
    case 'not_started':
      return { line1: '오늘 첫 탑승을 기록해 보세요', line2: '', badge: '' };
    case 'on_track':
      return {
        line1: `지금 속도면 ${projection}회로 ${MIN_RIDES}회를 넘겨요`,
        line2: `남은 ${remainingDays}일 동안 ${remaining}회 더 타면 돼요`,
        badge: '순항',
      };
    default:
      return {
        line1: `지금 속도면 ${projection}회로 ${MIN_RIDES - projection}회 모자라요`,
        line2: `남은 ${remainingDays}일 동안 ${remaining}회 더 타야 해요`,
        badge: '주의',
      };
  }
}

/** 홈 환급 카드 문구 (S2 표). 금액은 calcRefund로만 계산한다 */
export function refundCopy(count: number, fare: number, userType: UserType): RefundCopy {
  const c = typeof count === 'number' && Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  if (c >= MIN_RIDES) return { amount: formatWon(calcRefund(c, fare, userType)), sub: '' };
  if (c === 0) return { amount: formatWon(0), sub: `${MIN_RIDES}회를 채우면 환급이 시작돼요` };
  return {
    amount: formatWon(0),
    sub: `${MIN_RIDES}회까지 ${MIN_RIDES - c}회 남았어요 · 달성하면 예상 ${formatWon(calcRefund(MIN_RIDES, fare, userType))}부터 받아요`,
  };
}

/** "일반 20%" */
export function typeRateLabel(userType: UserType): string {
  return `${TYPE_NAME[userType]} ${REFUND_RATE_PCT[userType]}%`;
}

/** 분석 화면 판정 문구 (S4 표) */
export function verdictCopy(winner: PassComparison['winner'], diff: number): VerdictCopy {
  if (winner === 'kpass') return { text: `K-패스가 월 ${formatWon(diff)} 이득이에요`, badge: 'K-패스 이득' };
  if (winner === 'pass') return { text: `정기권이 월 ${formatWon(diff)} 이득이에요`, badge: '정기권 이득' };
  return { text: 'K-패스와 정기권 비용이 같아요', badge: '동일' };
}
