import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { KpassProvider } from '@/hooks/kpass';
import Records from '@/pages/Records';

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
    { Texts: ({ top }: { top: string }) => <span>{top}</span> },
  );
  return {
    Spacing: () => null,
    Skeleton: () => null,
    Top: Object.assign(({ title }: { title: React.ReactNode }) => <div>{title}</div>, { TitleParagraph: T }),
    Paragraph: { Text: T },
    Asset: { ContentIcon: () => null },
    ListRow,
    Button: ({ children, disabled, onClick, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button disabled={disabled} onClick={onClick} aria-label={rest['aria-label']}>{children}</button>
    ),
    Toast: ({ open, text }: { open: boolean; text: string }) => (open ? <div role="status">{text}</div> : null),
  };
});

const iso = '2026-09-01T00:00:00.000Z';
function seed(days: Record<string, number>) {
  localStorage.setItem('kpass:settings', JSON.stringify({ id: 'settings', version: 1, userType: 'general', avgFare: 1500, passPrice: null, createdAt: iso, updatedAt: iso }));
  localStorage.setItem('kpass:rides', JSON.stringify({ id: 'rides', version: 1, days, createdAt: iso, updatedAt: iso }));
}
const ui = () => (
  <MemoryRouter initialEntries={['/records']}>
    <KpassProvider><Records /></KpassProvider>
  </MemoryRouter>
);

describe('Records', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 22, 12, 0, 0));
  });
  afterEach(() => vi.restoreAllMocks());

  it('AC1: 22개 행이 최신순으로 나온다', () => {
    seed({});
    render(ui());
    const rows = screen.getAllByTestId('day-row');
    expect(rows).toHaveLength(22);
    expect(rows[0].textContent).toContain('9월 22일 (화)');
  });

  it('AC2: 20회인 날 +는 상한 Toast를 띄우고 값을 유지한다', () => {
    seed({ '2026-09-22': 20 });
    render(ui());
    fireEvent.click(screen.getByLabelText('9월 22일 (화) 1회 늘리기'));
    expect(screen.getByText('하루 최대 20회까지 기록할 수 있어요')).toBeTruthy();
    expect(screen.getAllByTestId('day-row')[0].textContent).toContain('20회');
  });

  it('AC3: 1회인 날 −는 키를 지우고 합계를 1 줄인다', () => {
    seed({ '2026-09-22': 1, '2026-09-10': 2 });
    render(ui());
    expect(screen.getByTestId('month-total').textContent).toBe('3');
    fireEvent.click(screen.getByLabelText('9월 22일 (화) 1회 줄이기'));
    expect(screen.getByTestId('month-total').textContent).toBe('2');
    const stored = JSON.parse(localStorage.getItem('kpass:rides') ?? '{}');
    expect(stored.days['2026-09-22']).toBeUndefined();
  });
});
