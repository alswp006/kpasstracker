import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { KpassProvider } from '@/hooks/kpass';
import Insight from '@/pages/Insight';
import { InsightLocked } from '@/components/insight/InsightLocked';
import * as refund from '@/lib/calc/refund';

vi.mock('@apps-in-toss/web-framework', () => ({
  generateHapticFeedback: vi.fn(),
  loadFullScreenAd: vi.fn(),
  showFullScreenAd: vi.fn(),
  Analytics: { screen: vi.fn(), impression: vi.fn(), click: vi.fn() },
}));
vi.mock('@toss/tds-mobile', () => {
  const T = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const ListRow = Object.assign(
    ({ contents, right, ...rest }: { contents?: React.ReactNode; right?: React.ReactNode }) => (
      <div data-testid={(rest as Record<string, string>)['data-testid']}>{contents}{right}</div>
    ),
    { Texts: ({ top, bottom }: { top: string; bottom: string }) => <div><span>{top}</span><span>{bottom}</span></div> },
  );
  return {
    Badge: T,
    Button: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => <button onClick={onClick}>{children}</button>,
    Spacing: () => null,
    Top: Object.assign(({ title }: { title: React.ReactNode }) => <div>{title}</div>, { TitleParagraph: T }),
    Paragraph: { Text: T },
    ListRow,
    TextField: ({ label, value }: { label: string; value: string }) => <input aria-label={label} defaultValue={value} />,
  };
});

const iso = '2026-09-01T00:00:00.000Z';
function seed(passPrice: number | null) {
  localStorage.setItem('kpass:settings', JSON.stringify({ id: 'settings', version: 1, userType: 'general', avgFare: 1500, passPrice, createdAt: iso, updatedAt: iso }));
  localStorage.setItem('kpass:rides', JSON.stringify({ id: 'rides', version: 1, days: {}, createdAt: iso, updatedAt: iso }));
}
const ui = (el: React.ReactNode) => (
  <MemoryRouter initialEntries={[{ pathname: '/insight', state: { rideCount: 30 } }]}>
    <KpassProvider>{el}</KpassProvider>
  </MemoryRouter>
);

describe('Insight', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 22, 12, 0, 0));
  });
  afterEach(() => vi.restoreAllMocks());

  it('AC1: 슬롯 ID 없이 시나리오 3행·손익분기·스파크라인이 보인다', () => {
    seed(55000);
    render(ui(<Insight />));
    expect(screen.getByText(/^일반 · /)).toBeTruthy();
    expect(screen.getByText(/^청년 · /)).toBeTruthy();
    expect(screen.getByText(/^저소득 · /)).toBeTruthy();
    expect(screen.getByText('46회')).toBeTruthy();
    expect(screen.getByTestId('trend-sparkline')).toBeTruthy();
  });

  it('AC2: breakEven이 null이면 항상 유리 문구', () => {
    seed(55000);
    vi.spyOn(refund, 'calcBreakEven').mockReturnValue(null);
    render(ui(<InsightLocked />));
    expect(screen.getByText('이 가격에서는 K-패스가 항상 유리해요')).toBeTruthy();
  });

  it('AC3: 무료 층은 잠금 층 안에 있지 않다', () => {
    seed(55000);
    render(ui(<Insight />));
    const free = screen.getByTestId('free-tier');
    const locked = screen.getByTestId('locked-tier');
    expect(free.contains(locked)).toBe(false);
    expect(locked.contains(free)).toBe(false);
    expect(locked.closest('.reward-ad-gate')).toBeNull();
    expect(screen.getByTestId('insight-refund')).toBeTruthy();
    expect(locked.contains(screen.getByTestId('insight-refund'))).toBe(false);
  });
});
