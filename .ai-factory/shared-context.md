# Shared Context (auto-generated — do NOT modify)


## 패킷 간 계약 (src/lib/contract.ts — 자동 생성, 수정 금지)
여기 선언된 이름·인자·반환 타입은 확정이다. 기반 패킷은 이대로 구현하고,
화면 패킷은 이대로 호출하라. 다르게 만들지 마라.

```typescript
/**
 * 패킷 간 인터페이스 계약 — 자동 생성. **수정하지 마라.**
 *
 * 기반 패킷은 여기 선언된 모양 그대로 구현하고, 화면 패킷은 여기 적힌 이름·인자·반환
 * 타입을 그대로 가정해도 된다. 추측이 어긋나 병합에서 무너지는 것을 막기 위한 파일이다.
 */

/** 기록 엔티티 — 모든 패킷이 의존 (구현: 패킷 0001) */
export type Ride = { id: string; date: string; amountKrw: number; viaPass?: boolean };

/** 설정 엔티티 — 0004, 0008이 의존 (구현: 패킷 0001) */
export type Settings = { monthlyPassPrice: number; dailyPassPrice: number; singleRidePrice: number; refundRuleDay?: number; userId?: string };

/** 월별 인덱싱용 (format: YYYY-MM) (구현: 패킷 0001) */
export type MonthKey = string;

/** 날짜→월키 변환 (구현: 패킷 0001) */
export type getMonthKeyFn = (date: string) => string;

/** 월키 파싱 (0002에서 인덱싱) (구현: 패킷 0001) */
export type parseYearMonthFn = (key: string) => { year: number; month: number };

/** 모든 기록 로드 — 0004, 0009, 0010 의존 (구현: 패킷 0002) */
export type loadRidesFn = () => Promise<Ride[]>;

/** 설정 로드 — 0004, 0008 의존 (구현: 패킷 0002) */
export type loadSettingsFn = () => Promise<Settings | null>;

/** 월별 인덱스 구성 — 0004 의존 (구현: 패킷 0002) */
export type buildMonthIndexFn = (rides: Ride[]) => Map<string, Ride[]>;

/** 기록 저장 — 0010에서 쓰임 (구현: 패킷 0003) */
export type writePairFn = (ride: Ride) => Promise<void>;

/** 설정 저장 — 0008에서 쓰임 (구현: 패킷 0003) */
export type saveSettingsFn = (settings: Settings) => Promise<void>;

/** 설정 상태 훅 — 0008, 0009, 0013 의존 (구현: 패킷 0004) */
export type useSettingsFn = () => [Settings | null, (s: Settings) => Promise<void>];

/** 기록 배열 훅 — 0009, 0010, 0012, 0013, 0014 의존 (구현: 패킷 0004) */
export type useRidesFn = () => Ride[];

/** 월별 메타 훅 — 0009, 0010, 0012, 0013 의존 (구현: 패킷 0004) */
export type useMonthMetaFn = () => { current: string; rides: Ride[]; count: number; indices: Map<string, Ride[]> };

/** 환급액 계산 — 0006, 0009, 0012 의존 (구현: 패킷 0005) */
export type calcRefundFn = (rides: Ride[], settings: Settings) => number;

/** 순비용 계산 — 0009, 0012 의존 (구현: 패킷 0005) */
export type calcNetCostFn = (rides: Ride[], settings: Settings) => number;

/** 위험도 점수 (0-1) — 0009, 0012 의존 (구현: 패킷 0006) */
export type calcRiskFn = (rides: Ride[], settings: Settings) => number;

/** 금액 포맷 — 모든 UI 의존 (구현: 패킷 0007) */
export type formatAmountFn = (amount: number, opts?: { currency?: string; decimals?: number }) => string;

/** 레이블+금액 포맷 — 0009, 0014 의존 (구현: 패킷 0007) */
export type formatDisplayFn = (label: string, amount: number) => string;

```

## Shared Types Contract (IMPORT these, do NOT redefine)
```typescript
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

```

## Existing Codebase (import and use these — do NOT recreate)
### File Tree (src/)
  App.tsx
  components/
    AdSlot.tsx
    Amount.tsx
    BottomCTA.tsx
    Card.tsx
    CountUp.tsx
    FloatingTabBar.tsx
    MiniBar.tsx
    PageShell.tsx
    ScreenScaffold.tsx
    Sparkline.tsx
    StateView.tsx
    SummaryHero.tsx
    TossPurchase.tsx
    TossRewardAd.tsx
    home/
    insight/
  hooks/
    __tests__/
    kpass.tsx
    useInsightInputs.ts
  lib/
    __tests__/
    analytics.ts
    calc/
    contract.ts
    dateKeys.ts
    kpassCalc.ts
    kpassCopy.ts
    kpassPolicy.ts
    kpassStore.ts
    review.ts
    share.ts
    storage/
    storage.ts
    types.ts
    utils.ts
  main.tsx
  pages/
    History.tsx
    Home.tsx
    Insight.tsx
    Records.tsx
    SettingsForm.tsx
    __TdsGallery.tsx
    __tests__/
  styles/
    globals.css
    reward-ad.css
  types/
  vite-env.d.ts

### Exports (src/lib/)
- analytics.ts: export type LogFields = Record<string, string | number | boolean | null>; export const DWELL_MS = 3000; export function fireAndForget(call: () => unknown): void; export function logScreen(page: string, extra?: LogFields): void; export function logClick(name: string, extra?: LogFields): void; export function logImpression(name: string, extra?: LogFields): void; export function useScreenLog(page: string): void
- calc/guards.ts: export function isValidCount(n: unknown): n is number; export function isValidPositive(n: unknown): n is number; export function isValidType(t: unknown): t is UserType
- calc/refund.ts: export function calcRefund(rides: unknown, fare: unknown, userType: unknown): number; export function calcKpassNetCost(rides: unknown, fare: unknown, userType: unknown): number; export function calcBreakEven(fare: unknown, userType: unknown, passPrice: unknown): number | null; export function calcNetCost(rides: Ride[], settings: Settings): number
- calc/risk.ts: export function calcProjection(count: number, now: Date = new Date()): number; export function calcRisk(count: number, now: Date = new Date()): RiskResult; export function comparePass(kpassNetCost: number, passPrice: number | null, _rides?: number): PassComparison; export function calcInsightInitialRides(count: number, now: Date = new Date()): number
- contract.ts: export type Ride =; export type Settings =; export type MonthKey = string; export type getMonthKeyFn = (date: string) => string; export type parseYearMonthFn = (key: string) =>; export type loadRidesFn = () => Promise<Ride[]>; export type loadSettingsFn = () => Promise<Settings | null>; export type buildMonthIndexFn = (rides: Ride[]) => Map<string, Ride[]>
- dateKeys.ts: export function toDateKey(d: Date = new Date()): string; export function isValidRecordDate(key: string, now: Date = new Date()): boolean; export function formatDayLabel(key: string): string; export function getMonthKey(date: string): string; export function parseYearMonth(key: string):; export function recentMonthKeys(today: Date = new Date(), n = 6): string[]
- kpassCalc.ts: export interface MonthSummary; export function calcMonthSummary( rides: unknown, fare: unknown, userType: unknown, passPrice: unknown = null, now: Date
- kpassCopy.ts: export interface RiskCopy; export interface RefundCopy; export interface VerdictCopy; export function formatWon(n: unknown): string; export function formatAmount(amount: number, opts?:; export function formatDisplay(label: string, amount: number): string; export function riskCopy(count: number, now: Date = new Date()): RiskCopy; export function refundCopy(count: number, fare: number, userType: UserType): RefundCopy
- kpassPolicy.ts: export const RETENTION_MONTHS = 12; export const DAILY_MAX = 20; export function cutoffMonth(now: Date = new Date()): string; export const MIN_RIDES = 21; export const MAX_REFUND_RIDES = 60; export const REFUND_RATE_PCT =
- kpassStore.ts: export const STORAGE_KEYS =
- review.ts: export function requestReviewOnce(key: string = REVIEW_REQUESTED_KEY): void
- share.ts: export interface ShareAppOptions; export async function shareApp(opts: ShareAppOptions): Promise<void>
- storage/loaders.ts: export function loadSettings(_now: Date = new Date()): UserSettings | null; export function loadRides(_now: Date = new Date()): RideLog | null; export function loadMonthMeta(_now: Date = new Date()): MonthMeta | null; export function buildMonthIndex(days: unknown): MonthIndex
- storage/writes.ts: export function writePair( key1: string, val1: string | null, key2: string, val2: string | null, ): SaveResult; export function saveSettings(input: SaveSettingsInput): SaveResult; export function setDayCount(date: string, count: number): StoreResult; export function incrementToday(): StoreResult; export function decrementToday(): StoreResult
- storage.ts: export function getItem<T>(key: string): T | null; export function setItem<T>(key: string, value: T): void; export function removeItem(key: string): void
- types.ts: export type UserType = 'general' | 'youth' | 'lo...
CRITICAL: Before creating any new function, type, or component, check the list above. If something similar exists, import and use it.

## Already Implemented (do NOT duplicate or overwrite)
- 0001: Shared types, policy constants and date key helpers (files: src/lib/types.ts, src/lib/kpassPolicy.ts, src/lib/dateKeys.ts, src/lib/__tests__/dateKeys.test.ts)
- 0002: Storage loaders and buildMonthIndex (files: src/lib/storage/loaders.ts, src/lib/__tests__/loaders.test.ts)
- 0003: Storage writes: writePair, saveSettings, setDayCount, today ±1, kpassStore barrel (files: src/lib/storage/writes.ts, src/lib/kpassStore.ts, src/lib/__tests__/writes.test.ts)
- 0004: KpassProvider and useSettings/useRides/useMonthMeta hooks (files: src/hooks/kpass.tsx, src/hooks/__tests__/kpass.test.tsx)
- 0005: Calculation service ①: refund, net cost and break-even (files: src/lib/calc/guards.ts, src/lib/calc/refund.ts, src/lib/__tests__/calcRefund.test.ts)
- 0006: Calculation service ②: projection, risk, pass comparison and kpassCalc barrel (files: src/lib/calc/risk.ts, src/lib/kpassCalc.ts, src/lib/__tests__/calcRisk.test.ts)
- 0007: Copy service: kpassCopy (display text and amount format) (files: src/lib/kpassCopy.ts, src/lib/__tests__/kpassCopy.test.ts)
- 0009: S2 home cards (progress, risk, refund) (files: src/components/home/HomeCards.tsx, src/components/home/__tests__/HomeCards.test.tsx)
- 0011: S4 insight ① input-state hook and free tier (files: src/hooks/useInsightInputs.ts, src/components/insight/InsightFree.tsx, src/components/insight/__tests__/InsightFree.test.tsx)
- 0008: S1 onboarding/settings shared form (SettingsForm) (files: src/pages/SettingsForm.tsx, src/pages/__tests__/SettingsForm.test.tsx)
- 0010: S2 Home page (one-tap record + navigation) (files: src/pages/Home.tsx, src/pages/__tests__/Home.test.tsx)
- 0012: S4 Insight page (locked tier + reward gate) (files: src/pages/Insight.tsx, src/components/insight/InsightLocked.tsx, src/pages/__tests__/Insight.test.tsx)

## Available exports from existing files
// src/App.tsx
export default function App() {

// src/components/AdSlot.tsx
export function AdSlot({ adGroupId, className, variant, theme }: AdSlotProps) {

// src/components/Amount.tsx
export function Amount({

// src/components/BottomCTA.tsx
export function SubmitFooter({
export function ButtonStack({

// src/components/Card.tsx
export function Card({

// src/components/CountUp.tsx
export function CountUp({

// src/components/FloatingTabBar.tsx
export type TabItem = {
export function FloatingTabBar({ items }: { items: TabItem[] }) {

// src/components/MiniBar.tsx
export function MiniBar({

// src/components/PageShell.tsx
export function PageShell({

// src/components/ScreenScaffold.tsx
export function ScreenScaffold({

// src/components/Sparkline.tsx
export function Sparkline({

// src/components/StateView.tsx
export function EmptyState({
export function LoadingState({

// src/components/SummaryHero.tsx
export function SummaryHero({

// src/components/TossPurchase.tsx
export interface TossPurchaseResult {
export function TossPurchase({

// src/components/TossRewardAd.tsx
export function TossRewardAd({

// src/components/home/HomeCards.tsx
export interface HomeCardsProps {
export function HomeCards({ count, settings, today }: HomeCardsProps) {

// src/components/insight/InsightFree.tsx
export function InsightFree() {

// src/components/insight/InsightLocked.tsx
export function InsightLocked() {

// src/hooks/kpass.tsx
export function KpassProvider({ children }: { children: ReactNode }) {
export function useSettings() {
export function useRides(): {
export function useMonthMeta() {

// src/hooks/useInsightInputs.ts
export const RIDE_MIN = 0;
export const RIDE_MAX = 120;
export const PRICE_MIN = 1000;
export const PRICE_MAX = 500000;
export function parseIn(text: string, min: number, max: number): number | null {
export function useInsightInputs() {

// src/lib/analytics.ts
export type LogFields = Record<string, string | number | boolean | null>;
export const DWELL_

## Memory Index (자동 학습 — 힌트로만 사용, 실제 코드 확인 필수)

Available topics: deploy(4), general(13), testing(2), ui(3)

Key lessons (verify against actual code before applying):
- [general] 파일 생성 전 디렉토리 구조 확인 — mkdir -p로 경로 보장 (60% · 타 앱 1회 — 맹신 금지)
- [general] 화면·라우팅 등 소비자 모듈은 그것이 import하는 생산자 모듈이 병합된 뒤에만 병합하고, 순서를 지킬 수 없으면 소비자 병합과 동시에 최소 플레이스홀더를 만들어 매 병합 직후 타입체크와 빌드가 항상 통과하도록 유지하라. (60% · 타 앱 1회 — 맹신 금지)
- [general] 전역 라우팅·탭바·Provider 배선은 개별 화면보다 먼저(초반 20% 안에) 완료하고 미구현 화면은 스텁 라우트로 연결해, 시간 예산이 소진돼도 앱이 항상 실행 가능한 상태를 유지하라. (60% · 타 앱 1회 — 맹신 금지)
- [general] 저장·데이터 접근 등 기반 계층 패킷은 이를 import 하는 화면 패킷보다 반드시 먼저 완료·병합하고, 미완료면 상위 화면 패킷 병합을 차단하라 — 빈 기반 모듈 하나가 전 라우트 스모크를 무너뜨린다. (60% · 타 앱 1회 — 맹신 금지)
- [general] 외부에서 들어온 모든 값(라우터 state, 로컬 저장소, 부분 입력 폼)은 사용 직전에 배열·객체 기본값으로 정규화하고, 테이블/맵 조회 결과는 존재 확인 후에만 하위 속성이나 length에 접근하라. (60% · 타 앱 1회 — 맹신 금지)