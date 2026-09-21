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
