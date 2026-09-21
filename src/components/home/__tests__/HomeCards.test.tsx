import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { mockAll } from '@/__tests__/__helpers__/mocks';
import { HomeCards } from '@/components/home/HomeCards';

mockAll();

const today = new Date(2026, 8, 22);
const settings = { userType: 'general' as const, avgFare: 1500 };

describe('HomeCards', () => {
  it('AC-1: warning copy and badge', () => {
    render(<HomeCards count={14} settings={settings} today={today} />);
    expect(screen.getByText('지금 속도면 19회로 2회 모자라요')).toBeInTheDocument();
    expect(screen.getByText('주의')).toBeInTheDocument();
    expect(screen.getByText('일반 20%')).toBeInTheDocument();
    expect(screen.getAllByTestId('progress-card')).toHaveLength(1);
  });

  it('AC-2: refund amount when achieved', () => {
    render(<HomeCards count={22} settings={settings} today={today} />);
    expect(screen.getByText('6,600원')).toBeInTheDocument();
  });

  it('AC-3: count 0 shows no badge and start hint', () => {
    render(<HomeCards count={0} settings={settings} today={new Date(2026, 8, 5)} />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText('21회를 채우면 환급이 시작돼요')).toBeInTheDocument();
  });
});
