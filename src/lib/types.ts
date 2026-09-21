// Domain types (SPEC) — 타입 전용, 런타임 코드 없음
export type UserType = 'general' | 'youth' | 'lowIncome';

export interface UserSettings {
  id: 'settings';
  version: 1;
  userType: UserType;
  avgFare: number;
  passPrice: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface RideLog {
  id: 'rides';
  version: 1;
  days: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

export interface MonthSnapshot {
  id: string;
  userType: UserType;
  avgFare: number;
  createdAt: string;
  updatedAt: string;
}

export interface MonthMeta {
  id: 'monthMeta';
  version: 1;
  months: Record<string, MonthSnapshot>;
  createdAt: string;
  updatedAt: string;
}

export interface MonthIndex {
  byMonth: Record<string, number>;
  monthsDesc: string[];
}

export type RiskStatus = 'achieved' | 'danger' | 'not_started' | 'on_track' | 'warning';

export interface RiskResult {
  status: RiskStatus;
  projection: number;
  remaining: number;
  remainingDays: number;
}

export interface MonthSummary {
  month: string;
  count: number;
  achieved: boolean;
  refund: number;
  usedFallback: boolean;
}

export interface PassComparison {
  kpassNetCost: number;
  passPrice: number;
  winner: 'kpass' | 'pass' | 'even';
  diff: number;
}

export type StoreResult =
  | { ok: true; count: number }
  | { ok: false; reason: 'NO_SETTINGS' | 'INVALID_DATE' | 'DAILY_MAX' | 'BELOW_ZERO' | 'QUOTA' };

export type SaveSettingsInput = Pick<UserSettings, 'userType' | 'avgFare' | 'passPrice'>;

export type SaveResult = { ok: true } | { ok: false; reason: 'QUOTA' };

// 라우트 state — 직접 진입 시 null일 수 있다
export interface RouteState {
  [key: string]: unknown;
}

export interface InsightRouteState {
  rideCount?: number;
}
