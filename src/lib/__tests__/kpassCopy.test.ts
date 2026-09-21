import { describe, it, expect } from 'vitest';
import { formatAmount, formatDisplay, formatWon, riskCopy, refundCopy, typeRateLabel, verdictCopy } from '@/lib/kpassCopy';

const sep22 = new Date(2026, 8, 22);

describe('kpassCopy', () => {
  it('formatWon', () => {
    expect(formatWon(6600)).toBe('6,600원');
    expect(formatWon(NaN)).toBe('0원');
  });

  it('formatAmount / formatDisplay', () => {
    expect(formatAmount(1234567)).toBe('1,234,567원');
    expect(formatAmount(1234.5, { decimals: 1, currency: 'KRW' })).toBe('1,234.5KRW');
    expect(formatAmount(-6600)).toBe('-6,600원');
    expect(formatAmount(NaN)).toBe('0원');
    expect(formatDisplay('예상 환급', 6600)).toBe('예상 환급 6,600원');
  });

  it('riskCopy warning', () => {
    expect(riskCopy(14, sep22)).toEqual({
      line1: '지금 속도면 19회로 2회 모자라요',
      line2: '남은 9일 동안 7회 더 타야 해요',
      badge: '주의',
    });
  });

  it('riskCopy achieved / not_started', () => {
    expect(riskCopy(22, sep22)).toEqual({ line1: '이번 달 환급 조건 21회를 채웠어요', line2: '', badge: '달성' });
    expect(riskCopy(0, new Date(2026, 8, 1)).badge).toBe('');
  });

  it('refundCopy', () => {
    expect(refundCopy(14, 1500, 'general').sub).toBe('21회까지 7회 남았어요 · 달성하면 예상 6,300원부터 받아요');
    expect(refundCopy(0, 1500, 'general').sub).toBe('21회를 채우면 환급이 시작돼요');
    expect(refundCopy(22, 1500, 'general').amount).toBe('6,600원');
  });

  it('typeRateLabel', () => {
    expect(typeRateLabel('general')).toBe('일반 20%');
    expect(typeRateLabel('lowIncome')).toBe('저소득 53%');
  });

  it('verdictCopy', () => {
        expect(verdictCopy('kpass', 19000)).toEqual({ text: 'K-패스가 월 19,000원 이득이에요', badge: 'K-패스 이득' });
    expect(verdictCopy('pass', 5000)).toEqual({ text: '정기권이 월 5,000원 이득이에요', badge: '정기권 이득' });
    expect(verdictCopy('even', 0)).toEqual({ text: 'K-패스와 정기권 비용이 같아요', badge: '동일' });
  });
});
