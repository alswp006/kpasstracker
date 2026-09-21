import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { KpassProvider } from '@/hooks/kpass';
import History from '@/pages/History';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});
vi.mock('@apps-in-toss/web-framework', () => ({
  generateHapticFeedback: vi.fn(),
  Analytics: { screen: vi.fn(), impression: vi.fn(), click: vi.fn() },
}));
vi.mock('@toss/tds-mobile', () => {
  const T = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const ListRow = Object.assign(
    ({ contents, right, ...rest }: { contents?: React.ReactNode; right?: React.ReactNode }) => (
      <div data-testid={(rest as Record<string, string>)['data-testid']}>{contents}{right}</div>
    ),
    { Texts: ({ top, bottom }: { top: string; bottom?: string }) => <span>{top}{bottom}</span> },
  );
  return {
    Spacing: () => null,
    Skeleton: () => null,
    Top: Object.assign(({ title }: { title: React.ReactNode }) => <div>{title}</div>, { TitleParagraph: T }),
    Paragraph: { Text: T },
    Asset: { ContentIcon: () => null },
    ListRow,
    Button: ({ children, onClick }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button onClick={onClick}>{children}</button>
    ),
  };
});

const iso = '2026-09-01T00:00:00.000Z';
function seed(userType: string, days: Record<string, number>, snapshot = true) {
  localStorage.setItem('kpass:settings', JSON.stringify({ id: 'settings', version: 1, userType, avgFare: 1500, passPrice: null, createdAt: iso, updatedAt: iso }));
  localStorage.setItem('kpass:rides', JSON.stringify({ id: 'rides', version: 1, days, createdAt: iso, updatedAt: iso }));
  if (snapshot) {
    localStorage.setItem('kpass:monthMeta', JSON.stringify({
      id: 'monthMeta', version: 1, createdAt: iso, updatedAt: iso,
      months: { '2026-08': { id: '2026-08', userType: 'general', avgFare: 1500, createdAt: iso, updatedAt: iso } },
    }));
  }
}
const ui = () => (
  <MemoryRouter initialEntries={['/history']}>
    <KpassProvider><History /></KpassProvider>
  </MemoryRouter>
);
const august = { '2026-08-03': 11, '2026-08-04': 11 };

describe('History', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 22, 12, 0, 0));
  });
  afterEach(() => vi.restoreAllMocks());

  it('AC1: 스냅샷 기준으로 8월 환급액을 보여준다', () => {
    seed('general', august);
    render(ui());
    const row = screen.getByTestId('month-row');
    expect(row.textContent).toContain('2026년 8월');
    expect(row.textContent).toContain('6,600원');
  });

  it('AC2: 설정이 청년으로 바뀌어도 8월 금액은 그대로다', () => {
    seed('youth', august);
    render(ui());
    expect(screen.getByTestId('month-row').textContent).toContain('6,600원');
  });

  it('AC3: 지난 기록이 없으면 빈 상태와 홈으로 가기 버튼', () => {
    seed('general', { '2026-09-10': 3 });
    render(ui());
    expect(screen.queryByTestId('month-row')).toBeNull();
    expect(screen.getByText('아직 지난달 기록이 없어요')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '홈으로 가기' }));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });
});
