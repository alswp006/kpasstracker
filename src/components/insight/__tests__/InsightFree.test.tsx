import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { KpassProvider } from '@/hooks/kpass';
import { InsightFree } from '../InsightFree';
import { calcInsightInitialRides } from '@/lib/kpassCalc';
import * as calc from '@/lib/kpassCalc';
import * as risk from '@/lib/calc/risk';

vi.mock('@toss/tds-mobile', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span data-testid="badge">{children}</span>,
  Paragraph: { Text: ({ children }: { children: React.ReactNode }) => <p>{children}</p> },
  Spacing: () => null,
  TextField: ({ label, value, help, onChange }: { label: string; value: string; help?: string; onChange: (e: { target: { value: string } }) => void }) => (
    <label>
      {label}
      <input aria-label={label} value={value} onChange={(e) => onChange(e)} />
      {help ? <span>{help}</span> : null}
    </label>
  ),
}));

const iso = '2026-09-01T00:00:00.000Z';
function seed(passPrice: number | null, days: Record<string, number> = {}) {
  localStorage.setItem('kpass:settings', JSON.stringify({ id: 'settings', version: 1, userType: 'general', avgFare: 1500, passPrice, createdAt: iso, updatedAt: iso }));
  localStorage.setItem('kpass:rides', JSON.stringify({ id: 'rides', version: 1, days, createdAt: iso, updatedAt: iso }));
}
function renderAt(state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/insight', state }]}>
      <KpassProvider><InsightFree /></KpassProvider>
    </MemoryRouter>,
  );
}

describe('InsightFree', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 22, 12, 0, 0));
  });
  afterEach(() => vi.restoreAllMocks());

  it('AC1: invalid rideCount state falls back to calcInsightInitialRides', () => {
    seed(60000, { '2026-09-01': 7, '2026-09-02': 7 });
    renderAt({ rideCount: 'abc' });
    const expected = calcInsightInitialRides(14, new Date(2026, 8, 22));
    expect((screen.getByLabelText('이번 달 탑승 횟수') as HTMLInputElement).value).toBe(String(expected));
  });

  it('AC2: 121 rides shows help, hides verdict; null price skips comparePass', () => {
    seed(null);
    const spy = vi.spyOn(risk, 'comparePass');
    renderAt({ rideCount: 121 });
    expect(spy).not.toHaveBeenCalled();
    expect(screen.queryByTestId('verdict-card')).toBeNull();
    expect(screen.getByText(/정기권 가격을 넣으면/)).toBeTruthy();
  });

  it('AC2b: out-of-range input shows error help', async () => {
    seed(60000);
    renderAt({ rideCount: 30 });
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.change(screen.getByLabelText('이번 달 탑승 횟수'), { target: { value: '121' } });
    expect(screen.getByText(/0회에서 120회/)).toBeTruthy();
    expect(screen.queryByTestId('verdict-card')).toBeNull();
  });

  it('AC3: diff=0 shows 동일 verdict and badge', () => {
    // 30회 × 1500 = 45,000 − 환급 13,500(30%) → 실부담 31,500? 정확값은 계산기로 산출
    const net = calc.calcKpassNetCost(30, 1500, 'general');
    seed(net);
    renderAt({ rideCount: 30 });
    expect(screen.getByTestId('badge').textContent).toBe('동일');
    expect(screen.getByText('K-패스와 정기권 비용이 같아요')).toBeTruthy();
  });
});
