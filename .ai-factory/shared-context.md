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
// Domain types — add your app-specific types here
export {};

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
  hooks/
  lib/
    analytics.ts
    review.ts
    share.ts
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
  styles/
    globals.css
    reward-ad.css
  types/
  vite-env.d.ts

### Exports (src/lib/)
- analytics.ts: export type LogFields = Record<string, string | number | boolean | null>; export const DWELL_MS = 3000; export function fireAndForget(call: () => unknown): void; export function logScreen(page: string, extra?: LogFields): void; export function logClick(name: string, extra?: LogFields): void; export function logImpression(name: string, extra?: LogFields): void; export function useScreenLog(page: string): void
- review.ts: export function requestReviewOnce(key: string = REVIEW_REQUESTED_KEY): void
- share.ts: export interface ShareAppOptions; export async function shareApp(opts: ShareAppOptions): Promise<void>
- storage.ts: export function getItem<T>(key: string): T | null; export function setItem<T>(key: string, value: T): void; export function removeItem(key: string): void
- utils.ts: export function cn(...classes: (string | boolean | undefined | null)[]): string; export function formatNumber(n: number): string; export function formatCurrency(n: number, currency = 'KRW'): string

### Components (src/components/)
- AdSlot.tsx: AdSlot
- Amount.tsx: Amount
- BottomCTA.tsx: SubmitFooter, ButtonStack
- Card.tsx: Card
- CountUp.tsx: CountUp
- FloatingTabBar.tsx: FloatingTabBar
- MiniBar.tsx: MiniBar
- PageShell.tsx: PageShell
- ScreenScaffold.tsx: ScreenScaffold
- Sparkline.tsx: Sparkline
- StateView.tsx: EmptyState, LoadingState
- SummaryHero.tsx: SummaryHero
- TossPurchase.tsx: TossPurchase
- TossRewardAd.tsx: TossRewardAd
CRITICAL: Before creating any new function, type, or component, check the list above. If something similar exists, import and use it.