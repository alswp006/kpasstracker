# SPEC — KPassTracker

## Common Principles

- **플랫폼과 스택**: 앱인토스 미니앱으로, Vite + React + TypeScript, TDS(`@toss/tds-mobile`), React Router(`react-router-dom`), localStorage로 만든다.
- **이미 있는 것 (다시 설계하지 않음)**: 아래 항목은 템플릿이 제공하는 것을 그대로 쓴다.
  - 토스 세션, TDS 셋업
  - `AdSlot`, `TossRewardAd`, `TossPurchase`, localStorage 헬퍼
  - `PageShell` / `ScreenScaffold`, `SubmitFooter`, `FloatingTabBar`, `SummaryHero`, `CountUp`, `Sparkline`, `MiniBar`
  - `logClick`, `logImpression`, `shareApp`, `requestReviewOnce`
- **서버 없음**: 모든 데이터는 기기 localStorage에만 저장한다. 외부 API도 호출하지 않는다.
- **생성형 AI 미사용**: 모든 결과는 정해진 계산식으로 만든다. 그래서 AI 고지·AI 라벨 의무는 해당하지 않는다.
- **결제·프로모션 미사용**: `TossPurchase`와 `grantPromotionReward`는 MVP에서 호출하지 않는다. 잠금 층을 여는 990원 일회성 결제는 설계 노트로만 남긴다(Q4).
- **결과 계층화**: 리워드 게이트는 `/insight` 한 곳에만 둔다.
  - 무료 층: 이번 달 예상 환급액, 그리고 정기권 대비 어느 쪽이 이득인지 판정. 앱의 목적은 여기서 달성된다.
  - 잠금 층: 유형별 3종 시나리오, 손익분기 회차, 최근 6개월 추이.
  - fail-open: 슬롯 ID가 없거나 광고 로드에 실패하면 게이트가 자동으로 열린다.
- **날짜 기준**: 기기 로컬 시각을 쓴다. 날짜 키는 `YYYY-MM-DD`, 월 키는 `YYYY-MM` 형식이다.
- **정책 상수** (`src/lib/kpassPolicy.ts` 한 파일에서만 정의):

| 상수 | 값 | 출처 |
|---|---|---|
| `REQUIRED_RIDES` | 21 | PRD |
| `REFUND_MAX_RIDES` | 60 | 가정 A2 |
| `REFUND_RATE` | `{ general: 0.20, youth: 0.30, lowIncome: 0.53 }` | 가정 A1 |
| `DAILY_MAX_RIDES` | 20 | 잘못된 입력 방지 |
| `RETENTION_MONTHS` | 13 | 이번 달 + 지난 12개월 |
| `INSIGHT_MAX_RIDES` | 120 | `/insight` 탑승 횟수 입력 상한(F6 AC-5) |

- **스타일**
  - UI는 TDS 컴포넌트만으로 만든다.
  - 간격은 `Spacing`(size 필수)으로만 조절한다.
  - 색상은 `var(--tds-color-*)`만 쓴다. HEX 하드코딩은 금지한다.
  - 커스텀 CSS는 flex/grid 배치에만 허용한다.
- **환경변수**: `VITE_TOSS_AD_GROUP_ID`(배너), `VITE_TOSS_AD_SLOT_ID`(리워드). 빌드 시점에 주입되므로 값이 바뀌면 다시 빌드하고 재배포해야 한다.

### AC 표기 규칙 (EARS)

모든 AC는 `AC-n [태그][우선순위]: 제목` 형식으로 쓴다. 첫 번째 하위 항목은 `EARS:`이고, 태그에 맞는 키워드로 시작해야 한다.

| 태그 | EARS 유형 | `EARS:` 문장 시작 키워드 | 쓰는 경우 |
|---|---|---|---|
| `[E]` | Event-driven | **When** <트리거>, … | 사용자 조작, 함수 호출, 시스템 이벤트(진입, `visibilitychange`)에 대한 반응 |
| `[S]` | State-driven | **While** <상태>, … | 어떤 상태가 유지되는 동안의 표시·동작 |
| `[U]` | Ubiquitous | **Always** … (조건 없음) | 상태와 무관한 불변 규칙, 정적 코드 규칙, 순수 함수의 고정 입출력 |
| `[W]` | Unwanted | **If** <원치 않는 상황>, **then** … | 에러, invalid input, 한도 초과, 손상 데이터, 광고·환경 실패 |
| `[O]` | Optional | **Where** <선택 기능/모드>, … | 특정 모드나 선택 기능이 있을 때만 적용되는 동작 |

- `EARS:` 줄의 키워드와 태그가 다르면 검수 스크립트가 실패로 판정한다.
- `[U]`의 `EARS:` 문장에는 "~이면", "~에서", "~인 경우" 같은 조건절을 넣지 않는다. 조건이 있으면 `[S]`(상태), `[W]`(원치 않는 입력·상황), `[E]`(트리거) 중 하나로 태그한다.
- `전제:`는 테스트 fixture(초기 데이터·기기 날짜)이며 EARS 조건이 아니다. `[U]` AC에는 `전제:`를 쓰지 않는다.
- `검증:`은 pass/fail 확인 항목이다.

### 계산 규칙 (F2 순수 함수 정의)

| 함수 | 정의 |
|---|---|
| `calcRefund(rides, fare, type)` | `rides < 21`이면 0. 그 외에는 `floor(min(rides, 60) × fare × REFUND_RATE[type] / 10) × 10` (10원 미만 절사) |
| `calcKpassNetCost(rides, fare, type)` | `rides × fare − calcRefund(rides, fare, type)` |
| `calcProjection(count, today)` | e = `today.getDate()`, D = 이번 달 일수일 때 `Math.round(count / e × D)` |
| `calcRisk(count, today)` | 아래 판정 순서를 따른다 |
| `comparePass(rides, fare, type, passPrice)` | `diff = passPrice − calcKpassNetCost(...)`. diff > 0이면 `'kpass'`, diff < 0이면 `'pass'`, 0이면 `'even'`. 반환하는 금액은 `abs(diff)` |
| `calcBreakEven(fare, type, passPrice)` | n = 0부터 200까지 차례로 보면서 `calcKpassNetCost(n) > passPrice`가 되는 가장 작은 n. 없으면 `null` |

**비정상 입력 정의와 반환값** (모든 F2 함수는 예외를 던지지 않는다)

| 인자 | 비정상 조건 |
|---|---|
| `rides`, `count` | 유한한 number가 아님(NaN, ±Infinity, number가 아닌 값) 또는 음수 |
| `fare`, `passPrice` | 유한한 number가 아님 또는 0 이하 |
| `type` | `'general' \| 'youth' \| 'lowIncome'`이 아님 |

| 함수 | 인자 중 하나라도 비정상일 때 반환값 |
|---|---|
| `calcRefund` | `0` |
| `calcKpassNetCost` | `0` |
| `calcProjection` | `count`가 비정상이면 `0` |
| `calcRisk` | `count`가 비정상이면 `count = 0`으로 보고 판정 순서를 그대로 적용 |
| `comparePass` | `{ kpassNetCost: 0, passPrice: 0, winner: 'even', diff: 0 }` |
| `calcBreakEven` | `null` |

- `comparePass`가 비정상 입력에서 `'even'`을 반환하므로, UI는 두 입력(탑승 횟수 0~120, 정기권 가격 1,000~500,000 정수)이 모두 유효할 때만 `comparePass`를 호출한다. 정기권 가격이 `null`이거나 비어 있으면 호출하지 않는다. 그래서 화면의 "동일" 판정은 유효한 입력에서 `diff = 0`일 때만 나온다(F6 AC-3, AC-10).

`calcRisk` 판정 순서 (r = D − 오늘 + 1, 남은 횟수 = max(0, 21 − count)). 위에서부터 처음 맞는 규칙을 쓴다.

1. count ≥ 21 → `achieved`
2. 남은 횟수 > r × 2 → `danger`
3. count = 0 → `not_started`
4. projection ≥ 21 → `on_track`
5. 그 외 → `warning`

- `danger`는 `not_started`보다 **먼저** 판정한다. 기록이 0회라도 남은 일수 안에 21회를 채울 수 없으면(하루 최대 2회 기준, A6) `danger`다.
  - 예: 30일짜리 달에서 0회라면 20일까지는 `not_started`, 21일부터는 `danger`이다(F2 AC-9).
- 화면 문구는 status에 따라 정해진다(S2 risk-card 문구 표).

**`/insight` 탑승 횟수 초기값**: `insightRideCount = min(max(projection, count), 120)`. S2의 "정기권과 비교하기" 이동과 F6 AC-8의 탭 진입이 모두 이 식을 쓴다. 그래서 초기값은 항상 F6 AC-5의 유효 범위(0~120) 안에 있다.

## Data Models

### 스키마 요약 (논리 테이블)

localStorage는 관계형 DB가 아니지만, 검수와 구현이 같은 기준을 쓰도록 저장 구조를 논리 테이블로 정리한다. **엔티티(테이블)는 4개이고, 4개 모두 `id`·`createdAt`·`updatedAt`을 가진다.**

| # | 논리 테이블 | 저장 위치 | PK (`id`) | 행 수 | `createdAt` / `updatedAt` |
|---|---|---|---|---|---|
| T1 | `UserSettings` | 키 `kpass:settings` (문서 전체) | `'settings'` 고정 리터럴 | 0~1 | 문서 수준 |
| T2 | `RideLog` | 키 `kpass:rides` (문서 전체) | `'rides'` 고정 리터럴 | 0~1 | 문서 수준 |
| T3 | `MonthMeta` | 키 `kpass:monthMeta` (문서 전체) | `'monthMeta'` 고정 리터럴 | 0~1 | 문서 수준 |
| T4 | `MonthSnapshot` | `kpass:monthMeta`의 `months` 맵 값 | `'YYYY-MM'` (맵 키와 같은 값을 `id` 필드에도 저장) | 0~13 | 스냅샷 수준 |

- **`RideLog.days`는 테이블이 아니다.** `RideLog` 문서의 map 타입 컬럼이며, 각 항목은 `'YYYY-MM-DD'` → 정수(1~20)인 원시 값이다. 항목마다 수정 이력이 필요한 요구사항이 없고, 항목에 타임스탬프를 두면 저장량이 13개월 × 31일 × 약 60B만큼 늘어나므로 엔티티로 올리지 않는다. 항목의 변경 시각은 문서의 `updatedAt`으로 추적한다.

**제약 조건 (DDL 대응)**

| 대상 | 제약 | 강제 위치 |
|---|---|---|
| T1~T3 `id` | PRIMARY KEY, 고정 리터럴. 키당 문서 1개(singleton) | 저장 키 자체. 로더가 고정값으로 채움 |
| T4 `id` | PRIMARY KEY, `YYYY-MM`(월 01~12). **`id` = 소속 `months` 맵 키** | 로더가 맵 키로 덮어씀(F1 AC-22). 쓰기 함수가 맵 키로 저장 |
| T4 `id` | UNIQUE — 한 달에 스냅샷 1개 | 맵 키가 중복될 수 없음 |
| `RideLog.days` 키 | UNIQUE — 날짜당 값 1개 | 맵 키가 중복될 수 없음 |
| `userType` (T1, T4) | CHECK `IN ('general','youth','lowIncome')` | 로더 검증 규칙 |
| `avgFare` (T1, T4) | CHECK 정수 100~10,000 | 로더 검증 규칙, S1 입력 검증 |
| `passPrice` (T1) | CHECK `NULL` 또는 정수 1,000~500,000 | 로더 검증 규칙, S1·S4 입력 검증 |
| `RideLog.days` 값 | CHECK 정수 1~20 (0이면 키 삭제) | 로더 검증 규칙, 쓰기 함수 |
| `version` (T1~T3) | CHECK `= 1` | 로더 검증 규칙 |
| `createdAt`, `updatedAt` (T1~T4) | NOT NULL, ISO 8601. `createdAt ≤ updatedAt` | 쓰기 함수. 누락 시 로더가 채움 |

**참조 관계 (FK)**

| 참조 | 종류 | 대상 존재 여부 | ON DELETE |
|---|---|---|---|
| T4 `MonthSnapshot` → T3 `MonthMeta` | 포함(부모 문서) | 항상 존재(스냅샷은 `months` 안에만 있음) | 부모 문서가 없거나 손상이면 스냅샷도 없는 것으로 읽음(CASCADE와 같은 효과) |
| T4 `MonthSnapshot.id` ↔ T2 `RideLog.days` 키 앞 7자리 | **약한 참조(soft reference)**, 강제하지 않음 | 한쪽만 있어도 정상 | NO ACTION — 어느 쪽을 지워도 다른 쪽은 바뀌지 않음 |
| T2·T3 쓰기 → T1 `UserSettings` | 존재 선행 조건(쓰기 전 검사) | T1이 없으면 쓰기 거부(`NO_SETTINGS`, F1 AC-15) | NO ACTION — T1이 없어져도 T2·T3은 보존(F1 AC-13) |

- 모든 참조 대상(T1, T2, T3)은 이 SPEC에 정의된 테이블이다. 정의되지 않은 테이블을 참조하는 관계는 없다.
- `MonthSnapshot.userType`은 T1을 가리키는 FK가 **아니다.** 스냅샷을 만든 시점의 설정 값을 복사해 둔 값이며, 설정이 바뀌어도 지난달 스냅샷은 그대로여야 한다(F1 AC-20, F7). 제약은 `UserType` 값 도메인(CHECK)뿐이다.

**인덱스 (메모리 파생, 저장하지 않음)**

| 인덱스 | 대상 | 키 | 쓰는 곳 | 갱신 시점 |
|---|---|---|---|---|
| PK 조회 | `RideLog.days` | `'YYYY-MM-DD'` | 오늘 횟수(S2), 날짜 행 값(S3) | 맵 키 자체(O(1) 조회) |
| PK 조회 | `MonthMeta.months` | `'YYYY-MM'` | 월별 환급 계산 기준(S5) | 맵 키 자체(O(1) 조회) |
| `MonthIndex` | `RideLog.days` | `'YYYY-MM'` → 월 합계 | 이번 달 누적(S2, S3 합계, S4 초기값), 월별 목록(S5), 6개월 추이(S4) | `buildMonthIndex(days)`로 만든다. `useRides`가 `days`가 바뀔 때만 다시 계산한다(`useMemo`) |

```ts
interface MonthIndex {
  byMonth: Record<string /* 'YYYY-MM' */, number /* 그 달 days 값 합계, 1 이상 */>;
  monthsDesc: string[];        // byMonth의 키를 최신순으로 정렬한 배열
}
```

- 화면은 월 합계를 얻을 때 `days`를 직접 순회하지 않고 `MonthIndex`만 쓴다. 기록이 있는 달(합계 1 이상)만 인덱스에 들어간다.
- `buildMonthIndex`는 `src/lib/storage/kpassStore.ts`에 두는 순수 함수이며, 입력이 객체가 아니면 `{ byMonth: {}, monthsDesc: [] }`를 반환하고 예외를 던지지 않는다(F1 AC-21).

### 식별자(identity) 규칙

- 저장 문서 3개(T1~T3)는 **localStorage 키가 곧 식별자**다. 각 키에는 문서가 하나만 있으므로 별도의 생성 ID(UUID 등)를 두지 않는다.
  - 문서마다 키에 대응하는 고정 리터럴 `id` 필드를 둔다: `kpass:settings` → `id: 'settings'`, `kpass:rides` → `id: 'rides'`, `kpass:monthMeta` → `id: 'monthMeta'`.
  - 로더는 저장된 `id` 값과 관계없이 키에 맞는 고정값으로 `id`를 채운다. `id`가 없거나 다른 값이어도 손상으로 보지 않는다. 식별자는 키로 결정되기 때문이다.
- `MonthSnapshot`(T4)은 **`id` 필드를 가진다.** 값은 소속 `months` 맵의 `'YYYY-MM'` 키와 같다.
  - 쓰기 함수는 스냅샷을 만들거나 덮어쓸 때 `id`를 맵 키로 저장한다.
  - 로더는 `id`가 없거나 맵 키와 다르면 손상으로 보지 않고 `id`를 맵 키로 채운다. 식별자는 맵 키로 결정된다. 다른 달 키에 새 항목을 만들거나 항목을 옮기지 않는다(F1 AC-22).
- `RideLog.days` 항목은 테이블 행이 아니라 `RideLog` 문서의 map 컬럼 값이다(스키마 요약 참고). `'YYYY-MM-DD'` 키가 항목을 구분하며, 항목에는 `id`와 타임스탬프를 두지 않는다.

### 공통 저장 규칙

- 저장 키 3개(`kpass:settings`, `kpass:rides`, `kpass:monthMeta`)는 모두 **단일 문서**이며, 문서 수준에 `id`, `createdAt`, `updatedAt`을 둔다. `MonthSnapshot`은 스냅샷 수준에 `id`, `createdAt`, `updatedAt`을 둔다.
  - `createdAt`: 해당 키(스냅샷은 해당 월 키)의 첫 번째 쓰기가 성공한 시각(ISO 8601). 이후에는 바뀌지 않는다.
  - `updatedAt`: 해당 키(스냅샷은 해당 월 스냅샷)에 쓰기가 성공할 때마다 그 시각으로 바꾼다.
  - 키가 없어서 로더가 기본값을 반환할 때는 메모리 기본값에 현재 시각을 넣는다. 기본값만으로는 저장하지 않는다. 처음 쓸 때 그 값이 `createdAt`으로 저장된다.
  - 다른 부분은 정상인데 `id`/`createdAt`/`updatedAt`만 없거나 잘못된 문서·스냅샷은 손상으로 보지 않는다. 메모리에서 채우고(`id`는 키, 타임스탬프는 현재 시각), 다음 쓰기 때 저장한다(F1 AC-14, AC-22).
- 로더(`loadSettings`, `loadRides`, `loadMonthMeta`)는 읽기만 한다. 손상·비정상 값을 걸러내더라도 localStorage에 쓰지 않는다. 정리된 값은 다음 성공한 쓰기 때 저장된다.
- 로더는 `console.error`를 호출하지 않고 예외를 던지지 않는다.

### 로더 검증 규칙

| 키 | 문서 전체를 손상으로 보는 조건 | 손상일 때 반환 | 항목 단위 처리 |
|---|---|---|---|
| `kpass:settings` | JSON 파싱 실패, 객체가 아님, `version !== 1`, `userType`이 3종이 아님, `avgFare`가 100~10,000 정수가 아님 | `null` (온보딩으로 보냄, F1 AC-16) | `passPrice`가 `null`도 아니고 1,000~500,000 정수도 아니면 `null`로 읽는다 |
| `kpass:rides` | JSON 파싱 실패, 객체가 아님, `version !== 1`, `days`가 객체가 아님 | 빈 기록 `{ id:'rides', version:1, days:{} }` (F1 AC-5) | `days` 항목 규칙(아래)을 적용한다(F1 AC-17) |
| `kpass:monthMeta` | JSON 파싱 실패, 객체가 아님, `version !== 1`, `months`가 객체가 아님 | 빈 문서 `{ id:'monthMeta', version:1, months:{} }` (F1 AC-18) | 스냅샷 항목 규칙(아래)을 적용한다(F1 AC-18, AC-22) |

- **`days` 항목 규칙**
  - 키가 실제로 있는 날짜의 `YYYY-MM-DD` 형식이 아니면(예: `"2026-9-5"`, `"2026-02-30"`, `"abc"`) 항목을 버린다.
  - 값이 number가 아니거나, 유한하지 않거나, 정수가 아니거나, 1 미만이면 항목을 버린다.
  - 값이 20을 넘는 정수면 20으로 clamp한다.
- **스냅샷 항목 규칙**
  - 키가 `YYYY-MM` 형식(월 01~12)이 아니면 항목을 버린다.
  - 값이 객체가 아니거나, `userType`이 3종이 아니거나, `avgFare`가 100~10,000 정수가 아니면 항목을 버린다. 그 달은 대체 계산된다(F7 AC-4).
  - `id`가 없거나 맵 키와 다르면 항목을 유지하고 `id`를 맵 키로 채운다(F1 AC-22).
  - `createdAt`/`updatedAt`만 없거나 잘못되면 항목을 유지한다. `updatedAt`은 현재 시각으로, `createdAt`은 `updatedAt`으로 채운다.

### T1. UserSettings — localStorage 키 `kpass:settings`

```ts
type UserType = 'general' | 'youth' | 'lowIncome';
interface UserSettings {
  id: 'settings';              // PK = 저장 키(고정 리터럴)
  version: 1;
  userType: UserType;          // 필수, CHECK 3종
  avgFare: number;             // 1회 평균 요금(원), 정수 100~10,000
  passPrice: number | null;    // 월 정기권 가격(원), 정수 1,000~500,000, 미입력 시 null
  createdAt: string;           // ISO 8601, 최초 저장 시각(불변)
  updatedAt: string;           // ISO 8601
}
```

- 제약: 키가 없거나 로더 검증 규칙상 손상이면(`loadSettings()`가 `null`) 온보딩이 필요한 상태로 본다.
- 참조됨: 탑승 기록 쓰기의 선행 조건(`NO_SETTINGS`), 새 스냅샷의 값 출처, 스냅샷 없는 달의 대체 계산(F7 AC-4).
- 크기: 약 220B.

### T2. RideLog — localStorage 키 `kpass:rides`

```ts
interface RideLog {
  id: 'rides';                 // PK = 저장 키(고정 리터럴)
  version: 1;
  days: Record<string /* 'YYYY-MM-DD', UNIQUE */, number /* 정수 1~20 */>;  // map 컬럼(테이블 아님)
  createdAt: string;           // ISO 8601, 최초 저장 시각(불변)
  updatedAt: string;           // ISO 8601, days 항목이 바뀔 때마다 갱신
}
```

- 제약: 값이 0이 된 날짜 키는 삭제한다.
- 제약: `kpass:rides`를 쓸 때마다 보존 기간 밖의 키를 같은 `setItem`에서 삭제한다(아래 "키 간 관계" 2번).
- 제약: 쓸 수 있는 날짜는 "유효한 기록 날짜"뿐이다. 유효한 기록 날짜의 조건은 아래 세 가지를 모두 만족하는 것이다. 이 조건을 벗어나면 `setDayCount`는 `INVALID_DATE`를 반환한다(F1 AC-19).
  - 실제로 있는 날짜의 `YYYY-MM-DD` 문자열이다(`days` 항목 규칙과 같다).
  - 오늘(기기 로컬 날짜)보다 뒤가 아니다.
  - 월이 `cutoffMonth`보다 앞서지 않는다.
- 인덱스: 월 합계는 `MonthIndex`로 얻는다(스키마 요약 "인덱스").
- 크기: 13개월 × 31일 × 약 22B ≈ 9KB.

### T3·T4. MonthMeta / MonthSnapshot — localStorage 키 `kpass:monthMeta`

```ts
interface MonthSnapshot {
  id: string;                  // PK = 'YYYY-MM', 소속 months 맵 키와 항상 같다
  userType: UserType;          // 스냅샷 시점 설정 값 복사(FK 아님, CHECK 3종)
  avgFare: number;             // 스냅샷 시점 설정 값 복사, 정수 100~10,000
  createdAt: string;           // ISO 8601, 이 달의 스냅샷이 처음 만들어진 시각. 덮어써도 유지
  updatedAt: string;           // ISO 8601, 이 스냅샷을 마지막으로 덮어쓴 시각
}
interface MonthMeta {
  id: 'monthMeta';             // PK = 저장 키(고정 리터럴)
  version: 1;
  months: Record<string /* 'YYYY-MM', UNIQUE, = MonthSnapshot.id */, MonthSnapshot>;
  createdAt: string;           // ISO 8601, 최초 저장 시각(불변)
  updatedAt: string;           // ISO 8601
}
```

- 제약: 스냅샷 갱신 대상은 **이번 달 키(오늘 기준 `YYYY-MM`) 하나뿐**이다.
  - 아래 두 경우에만 이번 달 스냅샷을 현재 설정으로 덮어쓴다.
    - 탑승 기록 쓰기(`incrementToday`, `decrementToday`, `setDayCount`)가 **이번 달 날짜**에 쓸 때
    - 설정이 저장될 때(`saveSettings`)
  - 탑승 기록 쓰기가 **이번 달이 아닌 날짜**(보존 기간 안의 지난달)에 쓸 때는 어떤 스냅샷도 만들거나 바꾸지 않는다.
    - 그 달의 기존 스냅샷은 그대로 둔다.
    - 그 달의 스냅샷이 없으면 새로 만들지 않는다. 그 달은 대체 계산된다(F7 AC-4).
    - 이번 달 스냅샷도 만들거나 바꾸지 않는다.
  - 덮어쓸 때 `userType`, `avgFare`, `updatedAt`만 바꾸고, 기존 스냅샷의 `createdAt`은 유지한다. `id`는 맵 키로 저장한다.
  - 이번 달 스냅샷이 없으면 새로 만들고 `id` = 이번 달 키, `createdAt` = `updatedAt` = 쓰기 시각으로 둔다.
  - 보존 기간 정리로 삭제된 스냅샷은 되살리지 않는다. 같은 월 키로 다시 만들면 새 `createdAt`을 받는다.
  - 그래서 지난달 스냅샷은 한 번 저장된 뒤로는 보존 기간 정리로 삭제되는 경우와 로더가 채운 `id`·타임스탬프가 다음 쓰기에 반영되는 경우 말고는 바뀌지 않는다(F1 AC-20).
- 제약: 지난달 환급액은 그 달의 스냅샷으로 계산한다.
- 제약: `kpass:monthMeta`를 쓸 때마다 보존 기간 밖의 월 키를 같은 `setItem`에서 삭제한다(아래 "키 간 관계" 2번).
- 크기: 13 × 약 125B ≈ 1.7KB.

### 키 간 관계와 쓰기 규칙

1. **관계**
   - `RideLog.days` 키의 앞 7자리(`YYYY-MM`)가 `MonthSnapshot.id`(= `months` 맵 키)와 대응한다. 한 달에 스냅샷은 0개 또는 1개다. 이 관계는 약한 참조이며 강제하지 않는다(스키마 요약 "참조 관계").
   - **탑승 기록이 있는데 스냅샷이 없는 달**: 현재 설정으로 대신 계산하고 "현재 설정 기준"이라고 표시한다(F7 AC-4). 스냅샷이 없는 지난달에 `setDayCount`로 기록을 써도 스냅샷은 생기지 않으므로 이 상태가 계속된다.
   - **고아 스냅샷**(스냅샷은 있는데 그 달의 `days` 키가 없음): 정상 상태로 허용한다. 예를 들어 기록 없이 설정만 저장한 달이 여기에 해당한다. 화면에는 표시하지 않고(F7 AC-7), 2번의 보존 규칙으로만 삭제된다.
   - 연쇄 삭제(cascade)는 없다(ON DELETE NO ACTION). 한 키를 지우거나 비워도 다른 키는 바뀌지 않는다. 데이터가 삭제되는 경우는 0값 날짜 키 삭제, 보존 기간 정리, 로더 검증에서 버려진 항목이 다음 쓰기에 반영되는 경우 세 가지뿐이다.
2. **보존 기간 정리 (RideLog·MonthMeta 공통)**
   - `cutoffMonth` = 현재 월 − 12개월. 예: 2026-09이면 2025-09.
   - 월이 `cutoffMonth`보다 앞서는 키를 삭제한다.
     - `RideLog`: `YYYY-MM-DD` 키의 월로 판단한다.
     - `MonthMeta`: `YYYY-MM` 키로 판단한다.
   - 정리는 해당 키를 쓰는 `setItem`에 함께 반영한다. 정리만을 위한 별도 쓰기는 없다.
   - 탑승 기록 쓰기는 날짜가 이번 달인지와 관계없이 항상 두 키를 모두 쓴다. 그래서 두 키가 함께 정리된다. 이번 달이 아닌 날짜에 쓸 때 `kpass:monthMeta` 쓰기에는 정리와 문서 `updatedAt` 변경만 반영되고, `months`의 남은 스냅샷 값(`userType`, `avgFare`, `createdAt`, `updatedAt`)은 바뀌지 않는다. `saveSettings`는 `kpass:monthMeta`만 정리한다.
   - 로더는 `cutoffMonth`보다 앞선 키를 결과에서 뺀다. 그래서 정리 전이라도 화면에는 나오지 않는다.
3. **쓰기 순서와 롤백**
   - 탑승 기록 쓰기(`incrementToday`, `decrementToday`, `setDayCount`) 순서:
     0. `loadSettings()`가 `null`이면(키 없음 또는 손상) 아무것도 쓰지 않고 `{ ok:false, reason:'NO_SETTINGS' }`를 반환한다. 이 검사는 다른 모든 검사보다 먼저 한다. 스냅샷은 `{ userType, avgFare }`가 있어야 만들 수 있기 때문이다(F1 AC-15).
     0-1. (`setDayCount`만) date가 유효한 기록 날짜가 아니면 아무것도 쓰지 않고 `{ ok:false, reason:'INVALID_DATE' }`를 반환한다. 이 검사는 `NO_SETTINGS` 다음, `DAILY_MAX`·`BELOW_ZERO` 전에 한다(F1 AC-19). `incrementToday`·`decrementToday`는 항상 오늘 날짜를 쓰므로 이 사유를 반환하지 않는다.
     0-2. `DAILY_MAX`, `BELOW_ZERO`를 검사한다.
     1. 새 `rides`와 `monthMeta` 객체를 메모리에서 계산한다(정리 포함). 쓰는 날짜가 이번 달일 때만 이번 달 스냅샷을 갱신한다.
     2. 두 키의 이전 raw 문자열(`getItem` 결과, 없으면 `null`)을 보관한다.
     3. `setItem('kpass:monthMeta')`를 실행한다. 실패하면 아무것도 바뀌지 않은 상태로 `{ ok:false, reason:'QUOTA' }`를 반환한다.
     4. `setItem('kpass:rides')`를 실행한다. 실패하면 `kpass:monthMeta`를 이전 raw 문자열로 되돌린다(이전 값이 `null`이면 `removeItem`). 그런 뒤 `{ ok:false, reason:'QUOTA' }`를 반환한다.
     5. 두 쓰기가 모두 성공한 뒤에만 메모리 상태(훅 state)를 갱신한다. `MonthIndex`는 새 `days`로 다시 계산된다.
   - `saveSettings` 순서: `kpass:monthMeta` → `kpass:settings`. 롤백 규칙은 위와 같다. `kpass:settings` 쓰기가 실패하면 `kpass:monthMeta`를 되돌린다.
     - 저장된 `kpass:settings`가 손상이어서 `loadSettings()`가 `null`이었다면, `saveSettings`는 그 문서를 새 문서로 덮어쓴다. 이때 `createdAt`은 쓰기 시각이다.
   - 롤백 쓰기 자체가 실패하면 예외를 삼키고 `QUOTA`를 반환한다.
     - 이때 `kpass:monthMeta`에 남을 수 있는 차이는 세 가지뿐이다: 보존 기간 정리, 로더가 채운 `id`·타임스탬프, 그리고 **이번 달** 스냅샷 1개(이번 달 날짜 쓰기나 `saveSettings`일 때만). 이번 달 스냅샷 값은 실제 설정과 같거나(탑승 기록 쓰기), 저장하려던 설정이다(`saveSettings`).
     - 이번 달 스냅샷은 다음 이번 달 탑승 기록 쓰기나 설정 저장 때 현재 설정으로 다시 덮어쓰이므로 저절로 복구된다.
     - 스냅샷 값 갱신이 이번 달 키로만 한정되므로, 지난달 스냅샷의 `userType`·`avgFare`는 성공·실패·롤백 실패 어느 경우에도 바뀌지 않는다.
   - 모든 저장 함수는 예외를 밖으로 던지지 않는다.
4. **데이터 초기화**
   - MVP에는 데이터 초기화 UI가 없다. 기기에서 앱 데이터를 지우면 세 키가 함께 사라진다(A8).
   - 일부 키만 없거나 손상일 때의 동작:
     - `kpass:settings` 없음 또는 손상 → 온보딩으로 보낸다. `kpass:rides`와 `kpass:monthMeta`는 그대로 두고, 온보딩을 저장한 뒤 그대로 표시한다(F1 AC-13, AC-16).
     - `kpass:rides` 없음 또는 손상 → 빈 기록으로 읽는다(F1 AC-5, AC-6). 비정상 항목만 있으면 그 항목만 걸러낸다(F1 AC-17).
     - `kpass:monthMeta` 없음 또는 손상 → 빈 `months`로 읽고 모든 달을 대체 계산한다(F1 AC-18, F7 AC-4, AC-5). 다음 쓰기 때 새 문서로 만든다.

### 파생 타입 (저장하지 않음)

```ts
type RiskStatus = 'achieved' | 'danger' | 'not_started' | 'on_track' | 'warning';
interface RiskResult {
  status: RiskStatus;
  projection: number;
  remaining: number;
  remainingDays: number;
}
interface MonthSummary {
  month: string;
  count: number;
  achieved: boolean;
  refund: number;
  usedFallback: boolean;
}
interface PassComparison {
  kpassNetCost: number;
  passPrice: number;
  winner: 'kpass' | 'pass' | 'even';
  diff: number;
}
// MonthIndex는 스키마 요약 "인덱스" 참고
type StoreResult =
  | { ok: true; count: number }
  | { ok: false; reason: 'NO_SETTINGS' | 'INVALID_DATE' | 'DAILY_MAX' | 'BELOW_ZERO' | 'QUOTA' };
type SaveSettingsInput = Pick<UserSettings, 'userType' | 'avgFare' | 'passPrice'>;
type SaveResult = { ok: true } | { ok: false; reason: 'QUOTA' };
```

전체 저장량은 약 11KB 이하로, 5MB 한도의 0.2% 수준이다.

## Feature List

### F1. 데이터 계층 — 설정·탑승 기록 저장소

- Description: `UserSettings`, `RideLog`, `MonthMeta`(`MonthSnapshot` 포함)를 읽고 쓰는 저장소 모듈(`src/lib/storage/kpassStore.ts`)과 훅(`useSettings`, `useRides`)을 만든다.
  - 공개 함수: `loadSettings()`, `loadRides()`, `loadMonthMeta()`, `saveSettings(input): SaveResult`, `incrementToday(): StoreResult`, `decrementToday(): StoreResult`, `setDayCount(date, n): StoreResult`, `buildMonthIndex(days): MonthIndex`.
  - `useRides`는 `{ rides, monthIndex }`를 제공한다. `monthIndex`는 `days`가 바뀔 때만 다시 계산한다.
  - 파싱 에러, 비정상 저장값 검증(Data Models "로더 검증 규칙"), 용량 초과, 키 사이 쓰기 순서와 롤백, 보존 기간 정리를 모두 이 계층에서 처리한다. 그래서 UI는 예외를 받지 않는다.
  - 탑승 기록 쓰기 3종의 검사 순서는 아래와 같다. 어느 검사에서든 실패하면 아무것도 쓰지 않는다.
    1. 설정이 없으면 `NO_SETTINGS`
    2. (`setDayCount`만) date가 유효한 기록 날짜가 아니면 `INVALID_DATE`. 유효한 기록 날짜는 실제로 있는 날짜의 `YYYY-MM-DD`이면서, 오늘보다 뒤가 아니고, `cutoffMonth`보다 앞서지 않는 날짜다.
    3. `DAILY_MAX`, `BELOW_ZERO`
  - 스냅샷은 이번 달 날짜에 쓸 때만 갱신한다. 지난달 날짜에 쓸 때는 어떤 스냅샷도 만들거나 바꾸지 않는다(Data Models MonthMeta 제약).
  - UI가 `NO_SETTINGS`를 받으면 `navigate('/onboarding', { replace: true })`를 호출하고 화면 수치는 바꾸지 않는다(F4 AC-14, F5 AC-8). 보통은 F3 AC-2 리다이렉트 때문에 이 경우가 생기지 않는다.
  - `decrementToday()`는 오늘 값 n이 1 이상이면 `setDayCount(today, n − 1)`과 같다.
  - `setDayCount`는 n > 20이면 `DAILY_MAX`, n < 0이면 `BELOW_ZERO`를 반환하고 아무것도 쓰지 않는다.
- Data: UserSettings, RideLog, MonthMeta, MonthSnapshot (모두 읽기·쓰기)
- API: 없음 (외부 API 호출 없음)
- Requirements:
- AC-1 [E][P0]: 오늘 탑승 +1 저장
  - EARS: **When** `incrementToday()`가 호출되면, 저장소는 오늘 날짜의 횟수를 1 올려 저장하고 이번 달 스냅샷을 갱신한다.
  - 전제: 설정 `{ userType:'general', avgFare:1500 }`, `kpass:rides` = `{ id:"rides", version:1, days:{ "2026-09-22": 1 }, createdAt:"2026-09-01T00:00:00.000Z", updatedAt:... }`, 기기 날짜 2026-09-22
  - 전제: `kpass:monthMeta.months["2026-09"]` = `{ id:"2026-09", userType:"general", avgFare:1500, createdAt:"2026-09-01T00:00:00.000Z", updatedAt:"2026-09-01T00:00:00.000Z" }`
  - 검증: `days["2026-09-22"]` = 2가 저장되고 `{ ok: true, count: 2 }`를 반환한다
  - 검증: `kpass:rides.createdAt`은 `"2026-09-01T00:00:00.000Z"` 그대로이고, `updatedAt`은 호출 시각으로 바뀐다
  - 검증: `kpass:monthMeta.months["2026-09"]`는 `{ id:"2026-09", userType:"general", avgFare:1500 }`이고, `createdAt`은 `"2026-09-01T00:00:00.000Z"` 그대로이며 `updatedAt`은 호출 시각으로 바뀐다
- AC-2 [E][P0]: 날짜별 횟수 지정
  - EARS: **When** `setDayCount(date, n)`이 유효한 기록 날짜로 호출되면, 저장소는 그 날짜 값을 n으로 저장한다. n이 0이면 날짜 키를 삭제한다.
  - 전제: 기기 날짜 2026-09-22, 설정 있음
  - 검증: `setDayCount("2026-09-10", 3)`을 호출하면 `days["2026-09-10"]` = 3이 저장된다
  - 검증: 이어서 `setDayCount("2026-09-10", 0)`을 호출하면 `"2026-09-10"` 키가 삭제된다
- AC-3 [W][P1]: (엣지 케이스) 일일 상한 초과 거부
  - EARS: **If** 오늘 값이 20인 상태에서 `incrementToday()`가 호출되면, **then** 저장소는 아무것도 쓰지 않고 `DAILY_MAX`를 반환한다.
  - 전제: 설정 있음, `days["2026-09-22"]` = 20
  - 검증: 두 키의 raw 문자열이 호출 전과 같고, `{ ok: false, reason: 'DAILY_MAX' }`를 반환한다
  - 검증: `setDayCount("2026-09-10", 21)`도 `{ ok:false, reason:'DAILY_MAX' }`를 반환하고 아무것도 쓰지 않는다
- AC-4 [W][P1]: (에러) 저장 공간 부족 — QuotaExceededError
  - EARS: **If** `incrementToday()` 도중 `localStorage.setItem`이 `QuotaExceededError`를 던지면, **then** 예외를 밖으로 전파하지 않고 `QUOTA`를 반환한다.
  - 전제: 설정 있음, 모든 `setItem` 호출이 `QuotaExceededError`를 던지도록 mock
  - 검증: `{ ok: false, reason: 'QUOTA' }`를 반환한다
  - 검증: `kpass:rides`와 `kpass:monthMeta`의 raw 문자열이 호출 전과 같다
  - 검증: 메모리 상태의 오늘 횟수와 `monthIndex.byMonth["2026-09"]`는 호출 전 값을 유지한다
- AC-5 [W][P1]: (에러) 손상된 JSON 복구 — invalid data
  - EARS: **If** `kpass:rides`의 값이 JSON으로 파싱되지 않으면, **then** `loadRides()`는 빈 기록을 반환하고 에러를 기록하지 않는다.
  - 전제: `kpass:rides` = `"{not json"`
  - 검증: `loadRides().days`는 `{}`, `version`은 1, `id`는 `'rides'`이다
  - 검증: `console.error`는 0회 호출된다
  - 검증: `version`이 2인 문서(`{"id":"rides","version":2,"days":{"2026-09-20":3}}`)도 `days:{}`로 읽는다
- AC-6 [S][P1]: (빈 상태) 최초 실행
  - EARS: **While** localStorage에 `kpass:*` 키가 하나도 없는 동안, 로더는 기본값을 반환하고 아무것도 쓰지 않는다.
  - 전제: localStorage 비어 있음
  - 검증: `loadSettings()`는 `null`을 반환한다
  - 검증: `loadRides()`는 `id:'rides'`, `version:1`, `days:{}`를 반환한다
  - 검증: `loadMonthMeta()`는 `id:'monthMeta'`, `version:1`, `months:{}`를 반환한다
  - 검증: 세 로더를 호출한 뒤에도 `localStorage.getItem('kpass:rides')`와 `localStorage.getItem('kpass:monthMeta')`는 `null`이다
- AC-7 [E][P2]: 보존 기간 초과 데이터 정리 (RideLog·MonthMeta)
  - EARS: **When** 탑승 기록 쓰기가 1회 일어나면, 저장소는 두 키에서 `cutoffMonth`보다 앞선 키를 같은 쓰기 안에서 삭제한다.
  - 전제: 기기 날짜 2026-09-22, 설정 있음
  - 전제: `days`에 `"2025-08-31": 2`, `"2025-09-01": 1`이 있다
  - 전제: `monthMeta.months`에 `"2025-08"`, `"2025-09"`, `"2026-06"`(고아 스냅샷)이 있고, 각 스냅샷의 `id`는 맵 키와 같다
  - 검증: `incrementToday()` 1회 호출 후 `days`에서 `"2025-08-31"`은 삭제되고 `"2025-09-01"`은 남는다
  - 검증: `months`에서 `"2025-08"`은 삭제되고 `"2025-09"`와 `"2026-06"`은 남는다. 남은 두 스냅샷의 `id`·`userType`·`avgFare`·`createdAt`·`updatedAt`은 호출 전과 같다
  - 검증: `setItem` 호출은 `kpass:monthMeta` 1회, `kpass:rides` 1회로 총 2회이다
- AC-8 [E][P1]: 오늘 탑승 −1 (되돌리기)
  - EARS: **When** `decrementToday()`가 호출되면, 저장소는 오늘 값을 1 낮춰 저장한다. 결과가 0이면 날짜 키를 삭제한다.
  - 전제: 기기 날짜 2026-09-22, 설정 있음, `days["2026-09-22"]` = 2
  - 검증: 첫 호출에서 `days["2026-09-22"]` = 1이 저장되고 `{ ok:true, count:1 }`를 반환한다
  - 검증: 두 번째 호출에서 `"2026-09-22"` 키가 삭제되고 `{ ok:true, count:0 }`를 반환한다
  - 검증: 두 번 모두 `monthMeta.months["2026-09"]`가 `id:"2026-09"`와 현재 설정으로 갱신된다
- AC-9 [W][P1]: (엣지 케이스) 0 미만 거부
  - EARS: **If** 오늘 값이 0인 상태에서 `decrementToday()`가 호출되거나 `setDayCount(date, n)`에 n < 0이 들어오면, **then** 저장소는 아무것도 쓰지 않고 `BELOW_ZERO`를 반환한다.
  - 전제: 설정 있음, `days`에 `"2026-09-22"` 키 없음
  - 검증: `decrementToday()`와 `setDayCount("2026-09-22", -1)`은 각각 `{ ok:false, reason:'BELOW_ZERO' }`를 반환한다
  - 검증: 두 키의 raw 문자열이 호출 전과 같다
- AC-10 [W][P1]: (에러) 키 사이 부분 쓰기 롤백
  - EARS: **If** `kpass:monthMeta` 쓰기는 성공하고 이어진 `kpass:rides` 쓰기가 `QuotaExceededError`를 던지면, **then** 저장소는 `kpass:monthMeta`를 이전 값으로 되돌리고 `QUOTA`를 반환한다.
  - 전제: 설정 있음, key가 `'kpass:rides'`일 때만 `setItem`이 `QuotaExceededError`를 던지도록 mock
  - 전제: 호출 전 `kpass:monthMeta` raw = M0, `kpass:rides` raw = R0
  - 검증: `incrementToday()`는 `{ ok:false, reason:'QUOTA' }`를 반환한다
  - 검증: 호출 후 `kpass:monthMeta` raw는 M0과 바이트 단위로 같다. M0이 `null`이었다면 키가 없다
  - 검증: `kpass:rides` raw는 R0과 같다
  - 검증: 메모리 상태의 오늘 횟수는 바뀌지 않는다
- AC-11 [E][P0]: 설정 저장 성공
  - EARS: **When** `saveSettings(input)`이 호출되면, 저장소는 이번 달 스냅샷과 설정을 순서대로 저장하고 `{ ok:true }`를 반환한다.
  - 전제: 기기 날짜 2026-09-22, `kpass:settings` 없음, `kpass:monthMeta` 없음
  - 검증: `saveSettings({ userType:'youth', avgFare:1500, passPrice:null })`는 `{ ok:true }`를 반환한다
  - 검증: `kpass:settings`에 `id:'settings'`, `userType:'youth'`, `avgFare:1500`, `passPrice:null`이 저장되고, `createdAt`과 `updatedAt`은 호출 시각과 같다
  - 검증: `kpass:monthMeta`에 `id:'monthMeta'`, `version:1`과 호출 시각의 `createdAt`·`updatedAt`이 저장된다
  - 검증: `kpass:monthMeta.months["2026-09"]` = `{ id:'2026-09', userType:'youth', avgFare:1500, createdAt:<호출 시각>, updatedAt:<호출 시각> }`
  - 검증: 이어서 `saveSettings({ userType:'general', avgFare:1500, passPrice:null })`를 호출하면 `kpass:settings.createdAt`과 `months["2026-09"].createdAt`은 첫 값 그대로이고, 두 곳의 `updatedAt`만 바뀐다. `months["2026-09"].userType`은 `'general'`, `id`는 `'2026-09'`이다
- AC-12 [W][P1]: (에러) 설정 저장 실패 — QuotaExceededError
  - EARS: **If** `saveSettings()` 도중 `kpass:settings` 쓰기가 `QuotaExceededError`를 던지면, **then** 저장소는 `kpass:monthMeta`를 이전 값으로 되돌리고 `{ ok:false, reason:'QUOTA' }`를 반환한다.
  - 전제: key가 `'kpass:settings'`일 때만 `setItem`이 던지도록 mock. 호출 전 `kpass:settings` 없음, `kpass:monthMeta` raw = M0
  - 검증: 예외가 밖으로 전파되지 않는다
  - 검증: `kpass:settings`는 여전히 없다
  - 검증: `kpass:monthMeta` raw는 M0과 같다
  - 검증: 메모리 상태의 `settings`는 `null`이다
- AC-13 [S][P1]: (엣지 케이스) 설정만 없는 상태에서 기록 보존
  - EARS: **While** `kpass:settings`는 없고 `kpass:rides`에 기록이 있는 동안, 저장소는 기록을 지우거나 바꾸지 않는다.
  - 전제: `kpass:settings` 없음, `kpass:rides.days` = `{ "2026-09-20": 3 }`
  - 검증: `loadRides().days` = `{ "2026-09-20": 3 }`
  - 검증: 이어서 `saveSettings(...)`를 성공시킨 뒤에도 `kpass:rides` raw 문자열은 호출 전과 같다
- AC-14 [W][P2]: (엣지 케이스) 식별자·타임스탬프 누락 문서
  - EARS: **If** 저장된 문서에 `id`, `createdAt`, `updatedAt` 중 하나 이상이 없으면, **then** 로더는 문서를 손상으로 보지 않고 `id`는 키에 맞는 고정값으로, 타임스탬프는 현재 시각으로 채운다.
  - 전제: 설정 있음, `kpass:rides` = `{ "version":1, "days":{ "2026-09-20": 3 } }`
  - 검증: `loadRides().days` = `{ "2026-09-20": 3 }`, `id` = `'rides'`이고, `createdAt`과 `updatedAt`은 ISO 8601 문자열이다
  - 검증: `console.error`는 0회 호출된다
  - 검증: 다음 `incrementToday()`가 성공하면 `kpass:rides`에 `id:'rides'`와 `createdAt`이 저장된다
  - 검증: `kpass:monthMeta` = `{ "version":1, "months":{} }`도 `id:'monthMeta'`와 ISO 8601 타임스탬프로 채워져 읽힌다
- AC-15 [W][P1]: (에러) 설정 없이 탑승 기록 쓰기 — NO_SETTINGS
  - EARS: **If** `loadSettings()`가 `null`인 상태에서 `incrementToday()`, `decrementToday()`, `setDayCount(date, n)` 중 하나가 호출되면, **then** 저장소는 아무것도 쓰지 않고 `{ ok:false, reason:'NO_SETTINGS' }`를 반환한다.
  - 전제: 기기 날짜 2026-09-22, `kpass:settings` 없음, `kpass:rides.days` = `{ "2026-09-22": 20 }`, 호출 전 `kpass:rides` raw = R0, `kpass:monthMeta` raw = M0(`null` 포함)
  - 검증: `incrementToday()`, `decrementToday()`, `setDayCount("2026-09-10", 3)`, `setDayCount("2026-09-10", 21)`은 각각 `{ ok:false, reason:'NO_SETTINGS' }`를 반환한다. 오늘 값이 20이어도 `DAILY_MAX`가 아니라 `NO_SETTINGS`이다
  - 검증: `setDayCount("2026-02-30", 3)`도 `INVALID_DATE`가 아니라 `NO_SETTINGS`를 반환한다
  - 검증: 모든 호출 뒤 `kpass:rides` raw는 R0과, `kpass:monthMeta` raw는 M0과 바이트 단위로 같다. M0이 `null`이었다면 키가 없다
  - 검증: `setItem` 호출은 0회이고, 예외는 밖으로 전파되지 않는다
  - 검증: `kpass:settings`가 손상 JSON(`"{oops"`)인 경우에도 결과가 같다
- AC-16 [W][P1]: (에러) 손상·비정상 설정 — invalid data
  - EARS: **If** `kpass:settings`가 JSON으로 파싱되지 않거나 로더 검증 규칙상 손상이면, **then** `loadSettings()`는 `null`을 반환하고 앱은 사용자를 온보딩으로 보낸다.
  - 전제: `kpass:settings`를 아래 값으로 각각 둔다
    - `"{oops"`
    - `{"id":"settings","version":1,"userType":"student","avgFare":1500,"passPrice":null}`
    - `{"id":"settings","version":1,"userType":"general","avgFare":50,"passPrice":null}`
    - `{"id":"settings","version":1,"userType":"general","avgFare":1500.5,"passPrice":null}`
    - `{"id":"settings","version":2,"userType":"general","avgFare":1500,"passPrice":null}`
  - 검증: 다섯 경우 모두 `loadSettings()`는 `null`을 반환하고 `console.error`는 0회 호출된다
  - 검증: `/`로 진입하면 최종 `location.pathname` = `/onboarding`이다(F3 AC-2)
  - 검증: 로드한 뒤에도 `kpass:settings`, `kpass:rides`, `kpass:monthMeta`의 raw 문자열은 바뀌지 않는다
  - 검증: `{"id":"settings","version":1,"userType":"general","avgFare":1500,"passPrice":300}`은 손상이 아니다. `loadSettings()`는 `passPrice:null`인 설정을 반환한다
- AC-17 [W][P1]: (에러) 비정상 `days` 항목 — invalid data
  - EARS: **If** `kpass:rides.days`에 로더 검증 규칙에 맞지 않는 항목이 있으면, **then** `loadRides()`는 20 초과 정수는 20으로 clamp하고 나머지 비정상 항목은 버리며, 에러를 기록하지 않는다.
  - 전제: 기기 날짜 2026-09-22, `kpass:rides.days` = `{ "2026-09-20": 25, "2026-09-21": -1, "2026-09-19": 2.5, "2026-09-18": "3", "2026-09-16": 0, "2026-9-5": 2, "2026-02-30": 1, "abc": 4, "2026-09-17": 4 }`
  - 검증: `loadRides().days` = `{ "2026-09-20": 20, "2026-09-17": 4 }`
  - 검증: `console.error`는 0회 호출되고 예외가 없다
  - 검증: 로드한 뒤에도 `kpass:rides` raw 문자열은 바뀌지 않는다
  - 검증: 설정이 있는 상태에서 이어서 `incrementToday()`가 성공하면, 저장된 `days`는 `{ "2026-09-20": 20, "2026-09-17": 4, "2026-09-22": 1 }`이다
- AC-18 [W][P1]: (에러) 손상·비정상 monthMeta — invalid data
  - EARS: **If** `kpass:monthMeta`가 JSON으로 파싱되지 않거나 로더 검증 규칙상 손상이면, **then** `loadMonthMeta()`는 빈 `months`를 반환하고, 문서는 정상이지만 비정상인 스냅샷 항목만 있으면 그 항목만 버린다.
  - 전제: `kpass:monthMeta` = `"{broken"`
  - 검증: `loadMonthMeta()`는 `{ id:'monthMeta', version:1, months:{} }`(타임스탬프 포함)를 반환하고 `console.error`는 0회 호출된다
  - 검증: `version`이 2인 문서와 `months`가 배열인 문서도 `months:{}`로 읽는다
  - 검증: `months` = `{ "2026-08": { "userType":"general", "avgFare":1500, "createdAt":"2026-08-01T00:00:00.000Z", "updatedAt":"2026-08-31T00:00:00.000Z" }, "2026-07": { "id":"2026-07", "userType":"student", "avgFare":1500 }, "2026-13": { "id":"2026-13", "userType":"general", "avgFare":1500 } }`이면, 결과 `months`에는 `"2026-08"`만 남고 그 `id`는 `"2026-08"`로 채워진다
  - 검증: 로드한 뒤에도 `kpass:monthMeta` raw 문자열은 바뀌지 않는다
- AC-19 [W][P1]: (에러) 유효하지 않은 날짜 — INVALID_DATE
  - EARS: **If** 설정이 있는 상태에서 `setDayCount(date, n)`의 date가 실제로 없는 날짜이거나 `YYYY-MM-DD` 형식이 아니거나, 오늘보다 뒤이거나, 월이 `cutoffMonth`보다 앞서면, **then** 저장소는 아무것도 쓰지 않고 `{ ok:false, reason:'INVALID_DATE' }`를 반환한다.
  - 전제: 기기 날짜 2026-09-22(`cutoffMonth` = 2025-09), 설정 `{ userType:'general', avgFare:1500 }`, 호출 전 `kpass:rides` raw = R0, `kpass:monthMeta` raw = M0
  - 검증: 아래 호출은 모두 `{ ok:false, reason:'INVALID_DATE' }`를 반환한다
    - 없는 날짜·형식 오류: `setDayCount("2026-02-30", 1)`, `setDayCount("2026-9-5", 1)`, `setDayCount("abc", 1)`, `setDayCount("", 1)`
    - 미래 날짜: `setDayCount("2026-09-23", 1)`, `setDayCount("2027-01-01", 1)`
    - 보존 기간 밖: `setDayCount("2025-08-31", 1)`
  - 검증: `setDayCount("2026-09-23", 21)`과 `setDayCount("2026-09-23", -1)`도 `DAILY_MAX`·`BELOW_ZERO`가 아니라 `INVALID_DATE`를 반환한다
  - 검증: 모든 호출 뒤 `kpass:rides` raw는 R0과, `kpass:monthMeta` raw는 M0과 바이트 단위로 같고, `setItem` 호출은 0회이며, 예외는 밖으로 전파되지 않는다
  - 검증: 경계값 `setDayCount("2026-09-22", 1)`(오늘)과 `setDayCount("2025-09-01", 1)`(`cutoffMonth` 첫날)은 `{ ok:true, count:1 }`를 반환한다
- AC-20 [E][P1]: 지난달 날짜 쓰기는 스냅샷을 바꾸지 않는다
  - EARS: **When** `setDayCount(date, n)`이 이번 달이 아닌 유효한 기록 날짜로 호출되면, 저장소는 그 날짜 값을 저장하고 그 달과 이번 달의 스냅샷을 만들거나 바꾸지 않는다.
  - 전제: 기기 날짜 2026-09-22, 현재 설정 `{ userType:'youth', avgFare:1400 }`
  - 전제: `monthMeta.months` = `{ "2026-08": { id:"2026-08", userType:"general", avgFare:1500, createdAt:"2026-08-01T00:00:00.000Z", updatedAt:"2026-08-31T00:00:00.000Z" } }`. `"2026-07"`과 `"2026-09"` 스냅샷은 없다
  - 전제: `days`에 `"2026-08-05": 23`이 있다
  - 검증: `setDayCount("2026-08-10", 3)`은 `{ ok:true, count:3 }`를 반환하고 `days["2026-08-10"]` = 3이 저장된다
  - 검증: 호출 후 `months["2026-08"]`은 `{ id:"2026-08", userType:"general", avgFare:1500, createdAt:"2026-08-01T00:00:00.000Z", updatedAt:"2026-08-31T00:00:00.000Z" }`와 깊은 비교(deep equal)로 같다
  - 검증: 호출 후 `months`에 `"2026-09"` 키가 없다
  - 검증: 이어서 `setDayCount("2026-07-05", 2)`를 호출하면 `{ ok:true, count:2 }`를 반환하고, `months`에 `"2026-07"` 키는 여전히 없다. `/history`의 2026년 7월 행에는 "현재 설정 기준"이 붙는다(F7 AC-4)
  - 검증: `setItem` 호출은 호출마다 `kpass:monthMeta` 1회, `kpass:rides` 1회이다
  - 검증: `/history`의 2026년 8월 금액은 호출 전과 같은 general/1500 기준 값이다(26회 → "예상 7,800원")
- AC-21 [U][P1]: 월 합계 인덱스 (`buildMonthIndex`)
  - EARS: **Always** `buildMonthIndex(days)`는 `days`를 월 키로 묶은 합계와 최신순 월 목록을 반환하고 예외를 던지지 않는다.
  - 검증: `buildMonthIndex({ "2026-09-20":3, "2026-09-21":2, "2026-08-05":23, "2026-07-01":18 })` = `{ byMonth:{ "2026-09":5, "2026-08":23, "2026-07":18 }, monthsDesc:["2026-09","2026-08","2026-07"] }`
  - 검증: `buildMonthIndex({})` = `{ byMonth:{}, monthsDesc:[] }`
  - 검증: `buildMonthIndex(null as unknown as Record<string, number>)`과 `buildMonthIndex([] as unknown as Record<string, number>)`은 `{ byMonth:{}, monthsDesc:[] }`를 반환한다
  - 검증: 홈 month-count, `/records` 합계, `/history` 목록, `/insight` 추이는 모두 `useRides().monthIndex`에서 값을 읽는다(코드 리뷰로 확인: 네 화면 파일에 `Object.keys(days)`·`Object.entries(days)` 호출이 0건)
- AC-22 [W][P2]: (엣지 케이스) 스냅샷 `id` 누락·불일치
  - EARS: **If** `months`의 스냅샷에 `id`가 없거나 맵 키와 다른 값이면, **then** 로더는 항목을 손상으로 보지 않고 `id`를 맵 키로 채우며, 다른 월 키의 항목을 만들거나 바꾸지 않는다.
  - 전제: 기기 날짜 2026-09-22, 설정 `{ userType:'general', avgFare:1500 }`, `kpass:monthMeta.months` = `{ "2026-08": { "id":"2026-07", "userType":"general", "avgFare":1500, "createdAt":"2026-08-01T00:00:00.000Z", "updatedAt":"2026-08-31T00:00:00.000Z" }, "2026-06": { "userType":"youth", "avgFare":1400, "createdAt":"2026-06-01T00:00:00.000Z", "updatedAt":"2026-06-30T00:00:00.000Z" } }`
  - 검증: `loadMonthMeta().months["2026-08"].id` = `"2026-08"`, `months["2026-06"].id` = `"2026-06"`이고, 결과 `months`의 키는 `"2026-08"`, `"2026-06"` 2개뿐이다(`"2026-07"` 없음)
  - 검증: 두 항목의 `userType`·`avgFare`·`createdAt`·`updatedAt`은 저장값 그대로이고, `console.error`는 0회 호출된다
  - 검증: 로드한 뒤에도 `kpass:monthMeta` raw 문자열은 바뀌지 않는다
  - 검증: 이어서 `incrementToday()`가 성공하면 저장된 `months["2026-08"].id` = `"2026-08"`, `months["2026-06"].id` = `"2026-06"`이고, 새로 생긴 `months["2026-09"].id` = `"2026-09"`이다

### F2. 계산 엔진 — 환급액·진행률·위험도·정기권 비교

- Description: Common Principles의 계산 규칙을 순수 함수(`src/lib/kpassCalc.ts`)로 구현한다. 모든 화면은 금액과 상태를 이 함수로만 얻고, 화면 안에서 따로 계산하지 않는다. 비정상 입력은 "비정상 입력 정의와 반환값" 표대로 처리하고 예외를 던지지 않는다.
- Data: UserSettings와 RideLog(`MonthIndex`)에서 나온 값을 입력으로 받는다. 저장하는 데이터는 없다.
- API: 없음
- Requirements:
- AC-1 [U][P0]: 유형별 환급액 계산
  - EARS: **Always** `calcRefund`는 계산 규칙의 식으로 환급액을 계산하고 10원 미만을 절사한다.
  - 검증: `calcRefund(22, 1500, 'general')` = 6600
  - 검증: `calcRefund(30, 1500, 'youth')` = 13500
  - 검증: `calcRefund(21, 1500, 'lowIncome')` = 16690 (16,695원에서 10원 미만 절사)
- AC-2 [W][P0]: 21회 미만은 환급 0
  - EARS: **If** `calcRefund`의 rides가 21 미만이면, **then** 0을 반환한다.
  - 검증: `calcRefund(20, 1500, 'lowIncome')` = 0
  - 검증: `calcRefund(0, 1500, 'general')` = 0
- AC-3 [U][P1]: (엣지 케이스) 60회 상한
  - EARS: **Always** `calcRefund`는 rides를 최대 60회까지만 반영한다.
  - 검증: `calcRefund(75, 1500, 'general')` = 18000
- AC-4 [U][P0]: 위험도 판정 (2026년 9월, 30일)
  - EARS: **Always** `calcRisk`는 판정 순서 1~5 중 처음 맞는 규칙으로 status를 정한다.
  - 검증: `calcRisk(14, 2026-09-22)` = `{ status:'warning', projection:19, remaining:7, remainingDays:9 }`
  - 검증: `calcRisk(5, 2026-09-28)`의 status = `'danger'`, remaining = 16, remainingDays = 3
  - 검증: `calcRisk(21, 2026-09-10)`의 status = `'achieved'`, remaining = 0
  - 검증: `calcRisk(12, 2026-09-10)` = `{ status:'on_track', projection:36, remaining:9, remainingDays:21 }`
- AC-5 [S][P1]: (빈 상태) 기록 0회 — 월 초
  - EARS: **While** count = 0이고 남은 횟수 21이 r × 2 이하인 동안, `calcRisk`는 `'not_started'`를 반환한다.
  - 검증: `calcRisk(0, 2026-09-02)`는 status = `'not_started'`, remaining = 21, remainingDays = 29를 반환한다
  - 검증: `calcRisk(0, 2026-09-20)`는 status = `'not_started'`를 반환한다 (r = 11, 21 ≤ 22)
  - 검증: `calcProjection(0, 2026-09-02)` = 0
- AC-6 [U][P0]: 정기권 비교
  - EARS: **Always** `comparePass`는 정기권 가격에서 K-패스 실부담을 뺀 차이로 승자와 금액을 정한다.
  - 검증: `comparePass(30, 1500, 'general', 55000)` = `{ kpassNetCost:36000, passPrice:55000, winner:'kpass', diff:19000 }`
  - 검증: `comparePass(50, 1500, 'general', 55000)`은 kpassNetCost = 60000, winner = `'pass'`, diff = 5000을 반환한다
  - 검증: `comparePass(30, 1500, 'general', 36000)` = `{ kpassNetCost:36000, passPrice:36000, winner:'even', diff:0 }`
- AC-7 [U][P1]: (엣지 케이스) 손익분기 회차
  - EARS: **Always** `calcBreakEven`은 0~200 사이에서 실부담이 정기권 가격을 넘는 가장 작은 회차를 반환하고, 없으면 `null`을 반환한다.
  - 검증: `calcBreakEven(1500, 'general', 55000)` = 46
  - 검증: `calcBreakEven(1500, 'general', 500000)` = `null`
- AC-8 [W][P1]: (에러) invalid input 방어 — rides
  - EARS: **If** `calcRefund`의 rides가 음수이거나 NaN이면, **then** 0을 반환하고 예외를 던지지 않는다.
  - 검증: `calcRefund(-3, 1500, 'general')` = 0
  - 검증: `calcRefund(NaN, 1500, 'general')` = 0
  - 검증: `calcKpassNetCost(-3, 1500, 'general')` = 0, `calcKpassNetCost(NaN, 1500, 'general')` = 0
- AC-9 [W][P0]: (엣지 케이스) 기록 0회 — 월말 danger 우선
  - EARS: **If** count = 0인데 남은 횟수 21이 r × 2를 넘으면, **then** `calcRisk`는 `'not_started'`가 아니라 `'danger'`를 반환한다.
  - 검증: `calcRisk(0, 2026-09-29)` = `{ status:'danger', projection:0, remaining:21, remainingDays:2 }`
  - 검증: `calcRisk(0, 2026-09-21)`의 status = `'danger'` (r = 10, 21 > 20)
- AC-10 [W][P1]: (에러) invalid input 방어 — fare·type
  - EARS: **If** `calcRefund` 또는 `calcKpassNetCost`의 fare가 NaN·0·음수이거나 type이 3종이 아니면, **then** 0을 반환하고 예외를 던지지 않는다.
  - 검증: `calcRefund(30, NaN, 'general')`, `calcRefund(30, 0, 'general')`, `calcRefund(30, -1500, 'general')`은 모두 0이다
  - 검증: `calcRefund(30, 1500, 'student' as UserType)` = 0
  - 검증: `calcKpassNetCost(30, NaN, 'general')`, `calcKpassNetCost(30, 0, 'general')`, `calcKpassNetCost(30, 1500, 'student' as UserType)`은 모두 0이다
  - 검증: 위 호출에서 예외가 발생하지 않는다
- AC-11 [W][P1]: (에러) invalid input 방어 — comparePass
  - EARS: **If** `comparePass`의 rides·fare·type·passPrice 중 하나라도 비정상이면, **then** `{ kpassNetCost:0, passPrice:0, winner:'even', diff:0 }`을 반환하고 예외를 던지지 않는다.
  - 검증: 아래 호출은 모두 `{ kpassNetCost:0, passPrice:0, winner:'even', diff:0 }`을 반환한다
    - `comparePass(30, 1500, 'general', NaN)`
    - `comparePass(30, 1500, 'general', 0)`
    - `comparePass(30, 1500, 'general', -55000)`
    - `comparePass(30, NaN, 'general', 55000)`
    - `comparePass(-1, 1500, 'general', 55000)`
    - `comparePass(30, 1500, 'student' as UserType, 55000)`
  - 검증: `comparePass(30, 1500, 'general', null as unknown as number)`도 같은 값을 반환한다. 이 반환값은 화면 판정에 쓰지 않는다(F6 AC-10)
- AC-12 [W][P1]: (에러) invalid input 방어 — calcRisk·calcProjection
  - EARS: **If** `calcRisk` 또는 `calcProjection`의 count가 음수이거나 NaN이면, **then** `calcProjection`은 0을 반환하고 `calcRisk`는 count = 0으로 보고 판정하며, 둘 다 예외를 던지지 않는다.
  - 검증: `calcProjection(-3, 2026-09-22)` = 0, `calcProjection(NaN, 2026-09-22)` = 0
  - 검증: `calcRisk(-3, 2026-09-02)` = `{ status:'not_started', projection:0, remaining:21, remainingDays:29 }`
  - 검증: `calcRisk(NaN, 2026-09-22)` = `{ status:'danger', projection:0, remaining:21, remainingDays:9 }`
- AC-13 [W][P2]: (에러) invalid input 방어 — calcBreakEven
  - EARS: **If** `calcBreakEven`의 fare·type·passPrice 중 하나라도 비정상이면, **then** `null`을 반환하고 예외를 던지지 않는다.
  - 검증: `calcBreakEven(NaN, 'general', 55000)`, `calcBreakEven(0, 'general', 55000)`, `calcBreakEven(1500, 'student' as UserType, 55000)`은 모두 `null`이다
  - 검증: `calcBreakEven(1500, 'general', 0)`, `calcBreakEven(1500, 'general', -1)`, `calcBreakEven(1500, 'general', NaN)`은 모두 `null`이다

### F3. 온보딩·설정 화면

- Description: 처음 들어온 사용자에게 K-패스 유형(일반·청년·저소득)과 1회 평균 요금을 받아 저장한다. `/settings`에서 같은 폼을 다시 열어 설정을 고칠 수 있다. 설정 모드에서는 월 정기권 가격도 입력할 수 있다. 저장은 모두 `saveSettings()`(F1)로 한다. 설정 모드는 설정이 있을 때만 렌더된다. 설정이 `null`이면 `/settings`도 `/onboarding`으로 리다이렉트되므로(AC-2), 설정 모드 폼은 항상 저장된 설정 값으로 초기화된다.
- Data: UserSettings(쓰기), MonthMeta·MonthSnapshot(이번 달 스냅샷 갱신)
- API: 없음
- Requirements:
- AC-1 [E][P0]: 온보딩 저장
  - EARS: **When** `/onboarding`에서 유형과 유효한 요금을 입력한 뒤 "시작하기"를 탭하면, 설정을 저장하고 홈으로 replace 이동한다.
  - 전제: `kpass:settings` 없음
  - 검증: 유형 "청년", 요금 "1500"으로 TDS Button "시작하기"를 탭하면 `kpass:settings` = `{ id:'settings', version:1, userType:'youth', avgFare:1500, passPrice:null, createdAt:<ISO>, updatedAt:<ISO> }`가 저장된다
  - 검증: `navigate('/', { replace: true })`가 실행된다
- AC-2 [S][P0]: 미설정 시 온보딩 강제
  - EARS: **While** `loadSettings()`가 `null`인 동안(`kpass:settings`가 없거나 손상), `/`, `/insight`, `/history`, `/records`, `/settings`로 진입하면 모두 `/onboarding`으로 replace 리다이렉트된다.
  - 검증: 다섯 경로 각각에서 최종 `location.pathname` = `/onboarding`이고, 히스토리 길이는 늘지 않는다
  - 검증: `/settings`로 진입한 경우 S1은 온보딩 모드로 렌더된다. `Top` 문구는 "K-패스 유형을 알려주세요", 제출 버튼은 "시작하기"이고, "월 정기권 가격" 필드는 0개이다
  - 검증: `kpass:settings` = `"{oops"`일 때도 결과가 같다
- AC-3 [W][P1]: (에러) 빈 요금 invalid input 거부
  - EARS: **If** 요금 필드가 빈 상태에서 키보드 완료 키로 제출하면, **then** 에러 문구를 표시하고 저장하지 않는다.
  - 검증: TDS TextField 아래에 에러 문구 "평균 요금을 입력해주세요"가 표시된다
  - 검증: `kpass:settings` raw는 바뀌지 않는다
- AC-4 [W][P1]: (에러) 범위 밖 요금 invalid input 거부
  - EARS: **If** 100 미만이거나 10,000 초과인 요금으로 제출하면, **then** 에러 문구를 표시하고 저장하지 않는다.
  - 검증: 요금 "50" 또는 "12000"으로 제출하면 에러 문구 "100원에서 10,000원 사이로 입력해주세요"가 표시된다
  - 검증: `kpass:settings` raw는 바뀌지 않는다
- AC-5 [S][P1]: (빈 상태) 초기 폼
  - EARS: **While** 온보딩 폼에 아직 아무것도 입력하지 않은 동안, 유형은 "일반"이 선택되어 있고 요금 필드는 비어 있으며 제출 버튼은 비활성이다.
  - 검증: 유형 "일반" 행에 체크 표시가 있다
  - 검증: 요금 필드 value = `""`
  - 검증: "시작하기" 버튼은 `disabled`이다
- AC-6 [E][P1]: 설정 수정
  - EARS: **When** `/settings`에서 값을 바꾸고 "저장"을 탭하면, 설정과 이번 달 스냅샷을 저장하고 이전 화면으로 돌아간다.
  - 전제: 기기 날짜 2026-09-22, 설정 `{ userType:'general', avgFare:1500, passPrice:null }`
  - 검증: 유형을 "저소득"으로 바꾸고 저장하면 `kpass:settings.userType`과 `monthMeta.months["2026-09"].userType`이 모두 `'lowIncome'`이 되고, `months["2026-09"].id` = `'2026-09'`이다
  - 검증: `kpass:settings.createdAt`은 바뀌지 않고 `updatedAt`만 바뀐다
  - 검증: TDS Toast "설정을 저장했어요"가 표시되고 `navigate(-1)`이 실행된다
- AC-7 [U][P2]: 모바일 키보드
  - EARS: **Always** S1의 숫자 입력 필드는 숫자 키패드를 쓰고, 키보드가 열려도 제출 버튼이 보인다.
  - 검증: 요금 TextField와 정기권 가격 TextField는 `inputMode="numeric"`이다
  - 검증: 키보드가 열려 있어도 SubmitFooter 버튼은 뷰포트 안에 보인다
  - 검증: 키보드의 완료/Enter 키는 제출과 같은 동작을 한다
- AC-8 [W][P1]: (에러) 저장 실패 — QuotaExceededError
  - EARS: **If** "시작하기" 또는 "저장"을 탭했는데 `saveSettings()`가 `{ ok:false, reason:'QUOTA' }`를 반환하면, **then** 실패 Toast를 표시하고 현재 화면에 머문다.
  - 검증: TDS Toast "저장 공간이 부족해 저장하지 못했어요"가 표시된다
  - 검증: 온보딩 모드에서는 `/onboarding`에 머물고 `navigate`가 호출되지 않는다
  - 검증: 설정 모드에서는 `/settings`에 머물고 `navigate(-1)`이 호출되지 않는다
  - 검증: 입력값은 폼에 그대로 남는다
- AC-9 [O][P1]: 설정 모드 — 정기권 가격 저장
  - EARS: **Where** S1이 설정 모드(`mode="settings"`)로 렌더되면, "월 정기권 가격" TextField를 표시하고 유효한 값을 정수로 저장한다.
  - 전제: 설정 `{ userType:'general', avgFare:1500, passPrice:null }`
  - 검증: 온보딩 모드에서는 "월 정기권 가격" 필드가 렌더되지 않는다(0개)
  - 검증: 설정 모드에서 "62000"을 입력하고 "저장"을 탭하면 `kpass:settings.passPrice` = 62000(number)이 저장되고 Toast "설정을 저장했어요"가 표시된다
  - 검증: 경계값 "1000"과 "500000"은 에러 없이 저장된다
- AC-10 [O][P1]: 설정 모드 — 정기권 가격 비우기
  - EARS: **Where** S1이 설정 모드로 렌더되면, 정기권 가격 필드는 저장된 값으로 채워지고, 필드를 비운 채 저장하면 `passPrice`를 `null`로 저장한다.
  - 전제: 설정 `{ userType:'general', avgFare:1500, passPrice:55000 }`
  - 검증: `/settings` 진입 시 필드 초기값은 "55000"이다. `passPrice`가 `null`이면 빈 문자열이다
  - 검증: 필드를 모두 지우고 "저장"을 탭하면 `kpass:settings.passPrice` = `null`이 저장된다
  - 검증: 정기권 가격 에러 문구는 0개이다
- AC-11 [W][P1]: (에러) 설정 모드 — 정기권 가격 범위 밖
  - EARS: **If** 설정 모드에서 정기권 가격을 1,000 미만이나 500,000 초과로 넣고 저장하면, **then** 에러 문구를 표시하고 아무 설정도 저장하지 않는다.
  - 전제: 설정 `{ userType:'general', avgFare:1500, passPrice:null }`
  - 검증: 유형을 "청년"으로 바꾸고 정기권 가격 "500" 또는 "600000"으로 저장하면, 정기권 가격 TextField 아래에 "1,000원에서 500,000원 사이로 입력해주세요"가 표시된다
  - 검증: `kpass:settings`와 `kpass:monthMeta`의 raw는 바뀌지 않는다. `userType`도 `'general'` 그대로다
  - 검증: Toast는 표시되지 않고 `/settings`에 머문다

### F4. 홈 — 원탭 기록·진행률·예상 환급액·미달 위험

- Description: 홈에서 큰 버튼을 한 번 눌러 오늘 탑승을 기록하고(`incrementToday`), 잘못 누른 경우 "−1"로 되돌린다(`decrementToday`). 이번 달 횟수·21회 진행률·남은 횟수·예상 환급액을 바로 확인한다. 이번 달 누적은 `monthIndex.byMonth[이번 달] ?? 0`, 오늘 횟수는 `days[오늘] ?? 0`으로 읽는다. 월말 미달 위험은 푸시 대신 홈의 상태 카드로 알린다. 카드 문구는 S2의 문구 표를 따른다.
- Data: RideLog(읽기·쓰기), UserSettings(읽기), MonthMeta·MonthSnapshot(쓰기)
- API: 없음
- Requirements:
- AC-1 [E][P0]: 원탭 기록
  - EARS: **When** `data-testid="record-button"` "탑승 +1"을 탭하면, `incrementToday()`로 저장하고 화면 수치와 Toast를 갱신한다.
  - 전제: 2026-09-22, 이번 달 누적 13회, 오늘 1회
  - 검증: `data-testid="month-count"`는 "14"로, `data-testid="today-count"`는 "오늘 2회"로 바뀐다
  - 검증: TDS Toast "오늘 2번째 탑승을 기록했어요"가 표시된다
  - 검증: `logClick('record_ride')`가 1회 호출된다
- AC-2 [E][P1]: 기록 되돌리기
  - EARS: **When** `data-testid="undo-button"` "−1"을 탭하면, `decrementToday()`를 1회 호출하고 화면 수치를 갱신한다.
  - 전제: 2026-09-22, 이번 달 누적 14회, 오늘 2회
  - 검증: `decrementToday`가 1회 호출된다
  - 검증: today-count는 "오늘 1회", month-count는 "13"이 된다
  - 검증: `days["2026-09-22"]` = 1이 저장된다
- AC-3 [S][P0]: 핵심 지표 레이아웃 (달성)
  - EARS: **While** 설정이 `{ userType:'general', avgFare:1500 }`이고 이번 달 누적이 22회인 동안, 홈은 달성 상태의 진행 카드와 환급 카드를 표시한다.
  - 검증: `data-testid="progress-card"` Card가 1개 있다
  - 검증: 그 안에 SummaryHero(CountUp) "22회", MiniBar(100%), 문구 "환급 조건 달성"이 있다
  - 검증: `data-testid="refund-card"` Card에 "6,600원"이 t2 타이포로, 유형 라벨 "일반 20%"와 함께 표시된다
- AC-4 [S][P0]: 미달 위험 카드 (warning·danger)
  - EARS: **While** 이번 달 status가 `warning` 또는 `danger`인 동안, risk-card는 S2 문구 표의 해당 문구와 Badge를 표시한다.
  - 검증: 2026-09-22에 14회(warning)이면 `data-testid="risk-card"`에 "지금 속도면 19회로 2회 모자라요"와 "남은 9일 동안 7회 더 타야 해요"가 표시되고 Badge "주의"가 붙는다
  - 검증: 2026-09-28에 5회(danger)이면 "남은 3일 동안 16회를 채우기 어려워요"가 표시되고 Badge "위험"이 붙는다
- AC-5 [S][P1]: (빈 상태) 이번 달 기록 없음 — not_started
  - EARS: **While** 이번 달 누적이 0회이고 `calcRisk` status가 `not_started`인 동안, 홈은 첫 기록을 유도하는 빈 상태를 표시한다.
  - 전제: 2026-09-02, 이번 달 0회
  - 검증: SummaryHero는 "0회"를 표시한다
  - 검증: risk-card는 "오늘 첫 탑승을 기록해 보세요"를 표시하고 Badge는 0개이다
  - 검증: refund-card는 금액 "0원"(t2)과 "21회를 채우면 환급이 시작돼요"를 표시한다
- AC-6 [W][P1]: (엣지 케이스) 일일 상한 초과
  - EARS: **If** 오늘 20회인 상태에서 "탑승 +1"을 탭하면, **then** 상한 Toast를 표시하고 수치를 유지한다.
  - 검증: TDS Toast "하루 최대 20회까지 기록할 수 있어요"가 표시된다
  - 검증: today-count는 "오늘 20회"를 유지한다
- AC-7 [W][P1]: (에러) 저장 실패
  - EARS: **If** "탑승 +1"을 탭했는데 `incrementToday()`가 `{ ok:false, reason:'QUOTA' }`를 반환하면, **then** 실패 Toast를 표시하고 수치를 유지한다.
  - 검증: TDS Toast "저장 공간이 부족해 기록하지 못했어요"가 표시된다
  - 검증: month-count와 today-count 값은 그대로이다
- AC-8 [E][P1]: (엣지 케이스) 월 경계 초기화
  - EARS: **When** 기기 날짜가 새 달로 바뀐 뒤 홈에 진입하거나 `visibilitychange`로 앱이 foreground로 돌아오면, 홈은 새 달 기준으로 다시 계산한다.
  - 전제: 2026-09-30까지 9월에 30회 기록, 기기 날짜가 2026-10-01로 바뀜
  - 검증: month-count는 "0"을 표시한다
  - 검증: 9월 기록 30회는 저장소에 그대로 남고 `monthIndex.byMonth["2026-09"]` = 30이다
- AC-9 [S][P0]: 환급 카드 — 1~20회 (미달성)
  - EARS: **While** 이번 달 누적이 1~20회인 동안, refund-card는 예상 환급액 0원과 21회를 채웠을 때의 예상 환급 시작액을 표시한다.
  - 전제: 2026-09-22, 설정 `{ userType:'general', avgFare:1500 }`, 이번 달 14회
  - 검증: refund-card에 금액 "0원"(t2), 유형 라벨 "일반 20%", 문구 "21회까지 7회 남았어요 · 달성하면 예상 6,300원부터 받아요"가 표시된다. 6,300은 `calcRefund(21, 1500, 'general')` 값이다
  - 검증: 20회일 때 문구는 "21회까지 1회 남았어요 · 달성하면 예상 6,300원부터 받아요"이다
- AC-10 [S][P1]: 위험 카드 — on_track·achieved 문구
  - EARS: **While** 이번 달 status가 `on_track` 또는 `achieved`인 동안, risk-card는 S2 문구 표의 해당 문구와 Badge를 표시한다.
  - 검증: 2026-09-10에 12회(on_track)이면 "지금 속도면 36회로 21회를 넘겨요"와 "남은 21일 동안 9회 더 타면 돼요"가 표시되고 Badge "순항"이 붙는다
  - 검증: 2026-09-22에 22회(achieved)이면 "이번 달 환급 조건 21회를 채웠어요"가 표시되고 Badge "달성"이 붙는다
- AC-11 [S][P1]: (엣지 케이스) 기록 0회 — 월말 danger
  - EARS: **While** 이번 달 누적이 0회이고 `calcRisk` status가 `danger`인 동안, risk-card는 첫 기록 유도 문구 대신 danger 문구를 표시한다.
  - 전제: 2026-09-29, 이번 달 0회
  - 검증: risk-card에 "남은 2일 동안 21회를 채우기 어려워요"가 표시되고 Badge "위험"이 붙는다
  - 검증: 문구 "오늘 첫 탑승을 기록해 보세요"는 화면에 0건이다
  - 검증: SummaryHero "0회", refund-card 금액 "0원"과 "21회를 채우면 환급이 시작돼요"는 AC-5와 같다
- AC-12 [W][P1]: (에러) 되돌리기 저장 실패
  - EARS: **If** "−1"을 탭했는데 `decrementToday()`가 `{ ok:false, reason:'QUOTA' }`를 반환하면, **then** 실패 Toast를 표시하고 수치를 유지한다.
  - 전제: 오늘 2회, 이번 달 14회
  - 검증: TDS Toast "저장 공간이 부족해 기록을 되돌리지 못했어요"가 표시된다
  - 검증: today-count "오늘 2회", month-count "14"가 그대로이다
- AC-13 [S][P1]: 되돌리기 버튼 비활성
  - EARS: **While** 오늘 기록이 0회인 동안, undo-button은 비활성이다.
  - 검증: undo-button은 `disabled`이고, 탭해도 `decrementToday`는 0회 호출된다
- AC-14 [W][P1]: (에러) 기록 중 설정 사라짐 — NO_SETTINGS
  - EARS: **If** "탑승 +1" 또는 "−1"을 탭했는데 `incrementToday()` 또는 `decrementToday()`가 `{ ok:false, reason:'NO_SETTINGS' }`를 반환하면, **then** `navigate('/onboarding', { replace: true })`를 호출하고 화면 수치를 바꾸지 않는다.
  - 전제: 2026-09-22, 설정 있는 상태로 홈 렌더(이번 달 14회, 오늘 2회). 탭하기 직전에 `localStorage.removeItem('kpass:settings')`를 실행한다
  - 검증: "탑승 +1"을 탭하면 `navigate('/onboarding', { replace: true })`가 1회 호출되고 최종 `location.pathname` = `/onboarding`이다
  - 검증: 이동 전까지 month-count "14", today-count "오늘 2회"는 그대로이고, Toast는 0건이다
  - 검증: `kpass:rides`와 `kpass:monthMeta`의 raw 문자열은 탭 전과 같다
  - 검증: 같은 전제에서 "−1"을 탭해도 결과가 같다
  - 검증: 탭 직전에 `kpass:settings`를 `"{oops"`로 바꿔도 결과가 같다

### F5. 이번 달 기록 수정 (`/records`)

- Description: 기록을 깜빡한 날을 보충하거나 잘못 누른 기록을 고칠 수 있도록, 이번 달 1일부터 오늘까지 날짜별 횟수를 ±로 수정한다. "+"와 "−"는 `setDayCount(date, n ± 1)`을 호출하며, 이번 달 날짜이므로 F1 규칙에 따라 이번 달 스냅샷도 함께 갱신된다. 행 값은 `days[날짜] ?? 0`, 상단 합계는 `monthIndex.byMonth[이번 달] ?? 0`으로 읽는다. 미래 날짜와 지난달은 목록에 나오지 않으므로 정상 흐름에서 `INVALID_DATE`는 반환되지 않는다.
- Data: RideLog(읽기·쓰기), MonthMeta·MonthSnapshot(쓰기 — 저장할 때마다 이번 달 스냅샷 갱신)
- API: 없음
- Requirements:
- AC-1 [E][P0]: 날짜 목록
  - EARS: **When** `/records`에 진입하면, 이번 달 1일부터 오늘까지의 날짜 행을 최신순으로 표시한다.
  - 전제: 기기 날짜 2026-09-22
  - 검증: `data-testid="day-row"` ListRow 22개가 최신순으로 표시된다
  - 검증: 첫 행 텍스트는 "9월 22일 (화)"이다
- AC-2 [E][P0]: 지난 날짜 보충
  - EARS: **When** 날짜 행의 "+" 버튼을 탭하면, 그 날짜 값을 1 올려 저장하고 행과 합계를 갱신한다.
  - 전제: `days["2026-09-15"]` 없음
  - 검증: "9월 15일" 행의 "+"를 2번 탭하면 `days["2026-09-15"]` = 2가 저장되고 행 우측에 "2회"가 표시된다
  - 검증: 상단 합계가 2 늘어난다
  - 검증: `monthMeta.months["2026-09"]`가 `id:"2026-09"`와 현재 설정으로 갱신된다
- AC-3 [W][P1]: (엣지 케이스) 0 미만 방지
  - EARS: **If** 0회인 날의 "−" 버튼에 입력이 들어오면, **then** 버튼은 비활성이고 저장소는 바뀌지 않는다.
  - 검증: 그 행의 "−" 버튼은 `disabled`이다
  - 검증: 탭해도 `setDayCount`는 0회 호출된다
- AC-4 [W][P1]: (엣지 케이스) 일일 상한 초과
  - EARS: **If** 20회인 날의 "+"를 탭하면, **then** 상한 Toast를 표시하고 값을 유지한다.
  - 검증: TDS Toast "하루 최대 20회까지 기록할 수 있어요"가 표시된다
  - 검증: 행 값은 "20회"를 유지한다
- AC-5 [S][P1]: (빈 상태) 기록 없는 날과 빈 달
  - EARS: **While** 날짜 값이 없는 동안 그 행은 회색 "0회"를 표시한다. 이번 달 합계가 0인 동안에는 안내 문구를 표시한다.
  - 검증: 값이 없는 행의 우측에 "0회"가 `var(--tds-color-grey-400)` 색으로 표시된다
  - 검증: 이번 달 합계가 0이면 목록 위에 Paragraph.Text "아직 이번 달 기록이 없어요. 탄 날에 +를 눌러주세요"가 표시된다
- AC-6 [W][P1]: (에러) 저장 실패 시 롤백
  - EARS: **If** "+" 또는 "−"를 탭했는데 `setDayCount()`가 `{ ok:false, reason:'QUOTA' }`를 반환하면, **then** 실패 Toast를 표시하고 행 값을 유지한다.
  - 검증: TDS Toast "저장 공간이 부족해 기록하지 못했어요"가 표시된다
  - 검증: 행 값과 상단 합계는 이전 값을 유지한다
- AC-7 [U][P2]: 터치 영역
  - EARS: **Always** 각 행의 ± 버튼은 최소 터치 크기와 간격을 지킨다.
  - 검증: 각 행의 "−"/"+" 버튼은 44×44px 이상이다
  - 검증: 두 버튼 사이 가로 간격은 8px 이상이다
- AC-8 [W][P1]: (에러) 수정 중 설정 사라짐 — NO_SETTINGS
  - EARS: **If** "+" 또는 "−"를 탭했는데 `setDayCount()`가 `{ ok:false, reason:'NO_SETTINGS' }`를 반환하면, **then** `navigate('/onboarding', { replace: true })`를 호출하고 행 값과 합계를 바꾸지 않는다.
  - 전제: 2026-09-22, 설정 있는 상태로 `/records` 렌더, `days["2026-09-15"]` = 2, 이번 달 합계 14회. 탭하기 직전에 `localStorage.removeItem('kpass:settings')`를 실행한다
  - 검증: "9월 15일" 행의 "+"를 탭하면 `navigate('/onboarding', { replace: true })`가 1회 호출되고 최종 `location.pathname` = `/onboarding`이다
  - 검증: 이동 전까지 그 행은 "2회", 상단 합계는 14회 그대로이고, Toast는 0건이다
  - 검증: `kpass:rides`와 `kpass:monthMeta`의 raw 문자열은 탭 전과 같다
  - 검증: 같은 전제에서 그 행의 "−"를 탭해도 결과가 같다

### F6. 정기권 비교 시뮬레이션·인사이트 (`/insight`, 리워드 게이트)

- Description: 예상 월 탑승 횟수와 정기권 가격을 입력하면 이번 달 예상 환급액과 K-패스·정기권 중 어느 쪽이 얼마나 이득인지를 무료로 보여준다. 유형별 3종 시나리오, 손익분기 회차, 최근 6개월 추이는 `TossRewardAd` 뒤의 잠금 층에 둔다. 추이는 `monthIndex.byMonth`에서 이번 달 포함 최근 6개월 값을 읽는다(기록 없는 달은 0). 탑승 횟수 초기값은 항상 `min(max(projection, count), 120)`이라 입력 유효 범위(0~120)를 벗어나지 않는다.
  - 정기권 가격은 "비교하기"에 필수다. 정기권 가격 필드의 초기값은 저장된 `passPrice`이고, `null`이면 빈 값이다.
  - "비교하기" 처리 순서:
    1. 두 필드를 검증한다. 하나라도 비었거나 범위 밖이면 에러 문구만 표시하고 멈춘다. 이때 `comparePass`와 `saveSettings`는 호출하지 않는다(AC-5, AC-6, AC-10).
    2. `comparePass`로 판정을 갱신한다.
    3. `saveSettings({ userType, avgFare, passPrice })`로 정기권 가격을 저장한다. `userType`과 `avgFare`는 현재 설정 값이다.
    4. 저장이 `QUOTA`면 실패 Toast를 표시한다. 판정은 이번 세션 입력값으로 갱신된 상태를 유지하고, 저장값은 바뀌지 않는다(AC-11).
  - verdict-card의 판정 문구와 Badge는 유효한 입력으로 계산한 `comparePass` 결과로만 그린다. "동일"은 `diff = 0`(winner `'even'`)일 때만 표시된다.
- Data: UserSettings(읽기, passPrice 쓰기), RideLog(읽기, `MonthIndex`), MonthMeta(읽기)
- API: 없음
- Requirements:
- AC-1 [W][P0]: 무료 층은 광고와 무관하게 보인다
  - EARS: **If** 광고를 한 번도 띄울 수 없는 환경이면(`VITE_TOSS_AD_SLOT_ID` 미설정, 광고 로드 실패, 타임아웃 중 하나), **then** 무료 층은 그대로 표시되고, 템플릿 TossRewardAd는 게이트를 자동으로 연다.
  - 전제: 설정 `{ userType:'general', avgFare:1500, passPrice:55000 }`, `navigate('/insight', { state: { rideCount: 30 } })`로 진입
  - 검증: `data-testid="free-tier"` 영역에 "이번 달 예상 환급액 9,000원"이 표시된다
  - 검증: `data-testid="verdict-card"`에 "K-패스가 월 19,000원 이득이에요"가 표시된다
  - 검증: 사용자는 K-패스를 유지할지 판단할 수 있다(PRD 목표 달성)
- AC-2 [E][P1]: 더 깊은 층은 게이트 뒤에 있다
  - EARS: **When** 광고 시청이 끝나거나 광고를 띄울 수 없어 게이트가 자동으로 열리면, TossRewardAd의 자식인 `data-testid="locked-tier"`에 시나리오·손익분기·추이를 표시한다.
  - 전제: AC-1과 같은 설정과 진입
  - 검증: locked-tier에 `data-testid="scenario-card"` Card 3개가 표시된다. 값은 일반 9,000원/실부담 36,000원, 청년 13,500원/31,500원, 저소득 23,850원/21,150원이다
  - 검증: `data-testid="break-even"`에 "월 46회 이상 타면 정기권이 이득이에요"가 표시된다
  - 검증: `data-testid="trend-sparkline"`에 최근 6개월 월별 탑승 횟수가 표시된다
- AC-3 [E][P0]: 입력 후 비교
  - EARS: **When** 유효한 탑승 횟수와 정기권 가격을 입력하고 SubmitFooter "비교하기"를 탭하면, 판정을 갱신하고 정기권 가격을 저장한다.
  - 전제: 설정 `{ userType:'general', avgFare:1500, passPrice:null }`
  - 검증: 탑승 횟수 "50", 정기권 가격 "55000"으로 비교하면 verdict-card에 "정기권이 월 5,000원 이득이에요"와 Badge "정기권 이득"이 표시된다
  - 검증: `kpass:settings.passPrice` = 55000이 저장된다
  - 검증: `logClick('compare_pass')`가 1회 호출된다
  - 검증: 탑승 횟수 "30", 정기권 가격 "36000"으로 비교하면(diff = 0) verdict-card에 "K-패스와 정기권 비용이 같아요"와 Badge "동일"이 표시된다
- AC-4 [S][P1]: (빈 상태) 정기권 가격 미입력
  - EARS: **While** passPrice가 null이고 아직 비교하지 않은 동안, free-tier는 환급액만 표시하고 판정 자리에 안내를 표시한다.
  - 검증: free-tier에는 "이번 달 예상 환급액"만 표시된다
  - 검증: verdict-card 자리에 Asset.ContentIcon과 "정기권 가격을 넣으면 어느 쪽이 이득인지 알려드려요"가 표시된다
- AC-5 [W][P1]: (에러) 탑승 횟수 invalid input
  - EARS: **If** 탑승 횟수가 0~120 범위 밖인 상태로 제출하면, **then** 에러 문구를 표시하고 판정과 저장값을 바꾸지 않는다.
  - 검증: "130"으로 제출하면 TextField 에러 문구 "0회에서 120회 사이로 입력해주세요"가 표시된다
  - 검증: verdict-card와 `kpass:settings` raw는 바뀌지 않는다
- AC-6 [W][P1]: (에러) 정기권 가격 invalid input
  - EARS: **If** 정기권 가격이 1,000~500,000 범위 밖인 상태로 제출하면, **then** 에러 문구를 표시하고 판정과 저장값을 바꾸지 않는다.
  - 검증: "500"으로 제출하면 TextField 에러 문구 "1,000원에서 500,000원 사이로 입력해주세요"가 표시된다
  - 검증: `kpass:settings.passPrice`와 verdict-card는 바뀌지 않는다
- AC-7 [S][P1]: (엣지 케이스) 추이 데이터 부족
  - EARS: **While** 기록이 있는 달(`monthIndex.monthsDesc` 길이)이 2개월 미만인 동안, 추이 그래프 대신 안내 문구를 표시한다.
  - 검증: trend-sparkline은 렌더되지 않고 "추이를 보려면 2개월 이상 기록이 필요해요"가 표시된다
- AC-8 [E][P2]: 탭 진입 기본값과 계측
  - EARS: **When** `location.state` 없이 탭바로 `/insight`에 진입하면, 탑승 횟수 초기값을 `min(max(projection, count), 120)`으로 채우고 계측을 호출한다.
  - 전제: `location.state` = null, 2026-09-22, 이번 달 14회
  - 검증: 탑승 횟수 필드의 초기값은 "19"이다
  - 검증: verdict-card가 처음 렌더되면 `logImpression('insight_verdict')`와 `requestReviewOnce()`가 각각 1회 호출된다
  - 검증: "결과 공유하기"를 탭하면 `shareApp()`과 `logClick('share_insight')`가 호출된다
- AC-9 [W][P1]: (엣지 케이스) 초기값 상한 120 clamp
  - EARS: **If** 초기값 계산식의 `max(projection, count)`가 120을 넘으면, **then** 탑승 횟수 필드는 정확히 "120"으로 채워지고 에러 문구는 표시되지 않는다.
  - 전제: 설정 `{ userType:'general', avgFare:1500, passPrice:55000 }`, 기기 날짜 2026-09-01, 이번 달 10회(`calcProjection(10, 2026-09-01)` = 300)
  - 검증: 홈의 "정기권과 비교하기"를 탭하면 `navigate('/insight', { state: { rideCount: 120 } })`가 호출된다
  - 검증: `/insight`의 탑승 횟수 필드 value는 정확히 `"120"`이다
  - 검증: 탭바로 `location.state` 없이 진입해도 필드 value는 `"120"`이다
  - 검증: 2026-09-22에 이번 달 130회(projection 177)일 때도 두 진입 경로 모두 필드 value는 `"120"`이다
  - 검증: 두 경우 모두 "0회에서 120회 사이로 입력해주세요" 문구는 0건이다. 그대로 "비교하기"를 탭하면 에러 없이 verdict-card가 `comparePass(120, 1500, 'general', 55000)` 결과로 갱신된다
- AC-10 [W][P1]: (에러) 정기권 가격 미입력 — invalid input
  - EARS: **If** 정기권 가격 필드가 빈 상태에서 "비교하기"를 탭하면, **then** 에러 문구를 표시하고 판정과 저장값을 바꾸지 않는다.
  - 전제: 설정 `{ userType:'general', avgFare:1500, passPrice:null }`, 탑승 횟수 "30", 정기권 가격 필드 `""`
  - 검증: 정기권 가격 TextField 아래에 "정기권 가격을 입력해주세요"가 표시된다
  - 검증: verdict-card 자리는 AC-4의 안내("정기권 가격을 넣으면 어느 쪽이 이득인지 알려드려요")를 그대로 유지한다. Badge "동일"과 문구 "K-패스와 정기권 비용이 같아요"는 0건이다
  - 검증: `comparePass`와 `saveSettings`는 0회 호출되고, `kpass:settings`와 `kpass:monthMeta` raw는 바뀌지 않는다
  - 검증: 설정 `passPrice:55000`으로 판정이 표시된 상태에서 필드를 지우고 탭해도, 같은 에러 문구가 표시되고 verdict-card는 이전 판정("K-패스가 월 19,000원 이득이에요")을 유지하며 `kpass:settings.passPrice`는 55000 그대로이다
- AC-11 [W][P1]: (에러) 정기권 가격 저장 실패 — QuotaExceededError
  - EARS: **If** 유효한 입력으로 "비교하기"를 탭했는데 `saveSettings()`가 `{ ok:false, reason:'QUOTA' }`를 반환하면, **then** 실패 Toast를 표시하고, 판정은 이번 세션 입력값으로 갱신된 상태를 유지하며, 저장값은 바꾸지 않는다.
  - 전제: 설정 `{ userType:'general', avgFare:1500, passPrice:null }`, 모든 `setItem`이 `QuotaExceededError`를 던지도록 mock. 호출 전 `kpass:settings` raw = S0, `kpass:monthMeta` raw = M0
  - 검증: 탑승 횟수 "50", 정기권 가격 "55000"으로 탭하면 TDS Toast "저장 공간이 부족해 저장하지 못했어요"가 표시된다
  - 검증: verdict-card에는 "정기권이 월 5,000원 이득이에요"가 표시된다(이번 입력값 기준)
  - 검증: `kpass:settings` raw는 S0과, `kpass:monthMeta` raw는 M0과 같다. 메모리 상태의 `settings.passPrice`는 `null`이다
  - 검증: `/insight`에 머물고 `navigate`는 호출되지 않는다. 두 필드 값("50", "55000")은 그대로 남는다
  - 검증: `logClick('compare_pass')`는 1회 호출된다
  - 검증: 이후 `/insight`에 다시 진입하면 정기권 가격 필드는 빈 값이고 AC-4 안내가 표시된다

### F7. 지난달 환급 기록 (`/history`)

- Description: 지난 12개월의 월별 탑승 횟수, 21회 달성 여부, 기록으로 추정한 예상 환급액을 목록으로 보여준다. 행 목록은 `monthIndex.monthsDesc`에서 이번 달을 뺀 월로 만들고, 각 달의 횟수는 `monthIndex.byMonth`, 금액 기준은 `months[월]` 스냅샷(PK 조회)으로 얻는다. 설정을 바꾸거나 지난달 날짜에 기록을 써도 지난달 스냅샷은 바뀌지 않으므로 과거 값의 계산 기준은 바뀌지 않는다(F1 AC-20). 탑승 기록이 1회 이상 있는 달만 행으로 표시한다.
- Data: RideLog(`MonthIndex`), MonthMeta·MonthSnapshot(읽기), UserSettings(대체값 계산용 읽기)
- API: 없음
- Requirements:
- AC-1 [E][P0]: 월별 목록
  - EARS: **When** `/history`에 진입하면, 이번 달을 뺀 지난 12개월 중 기록이 있는 달을 최신순 행으로 표시한다.
  - 전제: 2026-09-22. 2026-08에 23회(스냅샷 `id:"2026-08"`, general/1500), 2026-07에 18회(스냅샷 `id:"2026-07"`, youth/1400)
  - 검증: `data-testid="month-row"` ListRow 2개가 최신순으로 "2026년 8월 · 23회 · 달성 · 예상 6,900원", "2026년 7월 · 18회 · 미달 · 예상 0원"으로 표시된다
  - 검증: 2026-09 행은 표시되지 않는다
- AC-2 [S][P0]: 누적 요약 레이아웃
  - EARS: **While** 지난달 기록이 1개월 이상 있는 동안, `data-testid="history-summary"` Card에 누적 예상 환급액과 달성 현황을 표시한다.
  - 전제: AC-1과 같은 데이터
  - 검증: history-summary 안에 SummaryHero(CountUp) "6,900원"과 문구 "지난 12개월 기록 기반 예상 환급액 · 달성 1/2개월"이 있다
- AC-3 [S][P1]: (빈 상태) 지난 기록 없음
  - EARS: **While** 이번 달 외의 기록이 없는 동안, 빈 상태 안내를 표시하고 요약 카드를 렌더하지 않는다.
  - 검증: Asset.ContentIcon과 "아직 지난달 기록이 없어요. 이번 달이 끝나면 여기에 쌓여요"가 표시된다
  - 검증: history-summary는 렌더되지 않는다
- AC-4 [W][P1]: (엣지 케이스) 스냅샷 누락 시 대체 계산
  - EARS: **If** 기록이 있는 달의 스냅샷이 없으면, **then** 현재 설정으로 금액을 계산하고 대체 계산임을 표시한다.
  - 전제: 2026-08 기록 23회, `monthMeta.months["2026-08"]` 없음, 현재 설정 general/1500
  - 검증: 2026-08 금액은 "예상 6,900원"으로 표시된다
  - 검증: 행 보조 문구에 "현재 설정 기준"이 붙는다
- AC-5 [W][P1]: (에러) 손상된 monthMeta
  - EARS: **If** `kpass:monthMeta`가 JSON으로 파싱되지 않으면, **then** 화면은 크래시하지 않고 모든 달을 AC-4 규칙으로 표시한다.
  - 전제: `kpass:monthMeta` = `"{broken"`
  - 검증: 모든 month-row에 "현재 설정 기준"이 붙는다
  - 검증: `console.error`는 0회 호출된다
- AC-6 [U][P2]: 금액 표기의 정직성
  - EARS: **Always** `/history`의 모든 금액은 추정치임을 표기한다.
  - 검증: 모든 금액 표기에 "예상"이 포함된다
  - 검증: 화면 하단에 Paragraph.Text "실제 환급액은 카드사 정산 결과와 다를 수 있어요"가 표시된다
- AC-7 [W][P2]: (엣지 케이스) 고아 스냅샷 무시
  - EARS: **If** 어떤 달에 스냅샷은 있는데 탑승 기록이 없으면, **then** 그 달은 목록·요약·달성 집계에서 빠진다.
  - 전제: 2026-09-22. `monthMeta.months["2026-06"]`은 있고, `days`에 `2026-06-` 키는 없다. 그 밖의 데이터는 AC-1과 같다
  - 검증: month-row는 2개이고 "2026년 6월" 행은 없다
  - 검증: 요약 문구는 "달성 1/2개월" 그대로이다

### F8. 앱 셸·광고 배너·검수 준수

- Description: FloatingTabBar(홈·분석·지난 기록)로 화면을 오가는 앱 셸을 만들고, 배너 광고를 콘텐츠 뒤에 배치한다. 토스 검수 반려 항목은 자동으로 검증할 수 있는 규칙으로 고정한다.
- Data: 없음
- API: 없음
- Requirements:
- AC-1 [U][P0]: 탭 네비게이션
  - EARS: **Always** FloatingTabBar는 탭 3개를 제공하고 현재 경로의 탭을 선택 상태로 표시한다.
  - 검증: "홈"(`/`), "분석"(`/insight`), "지난 기록"(`/history`) 탭 3개가 있다
  - 검증: 현재 경로의 탭이 선택 상태로 표시된다
  - 검증: 각 탭의 터치 영역은 44px 이상이다
- AC-2 [S][P1]: 배너 위치
  - EARS: **While** 현재 경로가 `/` 또는 `/history`인 동안, 배너는 콘텐츠 아래, 탭바 위에 1개만 렌더된다.
  - 검증: `<AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID} />`는 모든 콘텐츠 Card 아래, FloatingTabBar 위에 1개만 렌더된다
  - 검증: 배너는 콘텐츠·버튼과 겹치지 않는다
  - 검증: 배너가 노출되면 `logImpression('banner_ad')`가 호출된다
- AC-3 [W][P1]: (에러) 광고 ID 미설정 빌드
  - EARS: **If** `VITE_TOSS_AD_GROUP_ID`가 빈 값인 채로 빌드되면, **then** 배너 영역은 공간을 차지하지 않고 에러 없이 나머지 화면이 동작한다.
  - 검증: AdSlot 영역 높이는 0이다
  - 검증: `console.error`는 0회 호출되고 나머지 화면은 그대로 동작한다
- AC-4 [W][P1]: (엣지 케이스) 알 수 없는 경로
  - EARS: **If** 정의되지 않은 경로(예: `/unknown`)에 진입하면, **then** `/`로 replace 리다이렉트한다.
  - 검증: 최종 `location.pathname` = `/`
- AC-5 [U][P0]: 외부 도메인 이탈·앱 설치 유도 금지
  - EARS: **Always** `src/`에는 외부 이탈이나 앱 설치 유도 코드·문구가 없다.
  - 검증: `src/` 안에 `window.open(`, `window.location.href =`, "앱을 설치", "다운로드" 문자열이 0건이다
- AC-6 [U][P0]: 외부 로깅·HEX 색상 금지
  - EARS: **Always** `src/`에는 외부 분석 SDK와 HEX 색상 리터럴이 없다.
  - 검증: `src/` 안에 `gtag`, `amplitude`, `mixpanel` import가 0건이다
  - 검증: `.ts/.tsx/.css` 파일에 `#[0-9a-fA-F]{3,8}\b` 색상 리터럴이 0건이다
- AC-7 [U][P0]: 콘솔 에러 0개·구형 기기 호환
  - EARS: **Always** 빌드 결과물은 콘솔 에러 없이 동작하고 구형 기기에서 쓸 수 없는 API를 쓰지 않는다.
  - 검증: `vite build` 결과물로 5개 화면을 모두 돌아도 `console.error`는 0회 호출된다
  - 검증: `src/`에 `structuredClone`, `.at(`, `Object.hasOwn`, `Intl.Segmenter` 사용이 0건이다(Android 7+, iOS 16+ 호환)
- AC-8 [S][P1]: (로딩 상태) 초기 렌더
  - EARS: **While** 앱이 첫 렌더 중인 동안, localStorage를 동기로 읽어 첫 페인트에 실제 값을 그린다.
  - 검증: 스피너는 0개이다
  - 검증: SummaryHero의 CountUp만 0에서 실제 값까지 애니메이션된다

## Screen Definitions

### S1. 온보딩 `/onboarding` · 설정 `/settings` (같은 컴포넌트, `mode` prop으로 구분)

- **골격**: ScreenScaffold, TDS `Top`: "K-패스 유형을 알려주세요"(설정 모드는 "설정").
- **렌더 조건**: 설정 모드(`/settings`)는 `loadSettings()`가 `null`이 아닐 때만 렌더한다. `null`이면 `/onboarding`으로 replace 리다이렉트되어 온보딩 모드로 렌더된다(F3 AC-2). 그래서 설정 모드 폼의 초기값은 항상 저장된 설정(유형·요금·정기권 가격)이다.
- **TDS 컴포넌트**
  - 유형 선택: `ListRow` 3개(일반·청년·저소득). 단일 선택이며 선택된 행 우측에 체크 표시. 행 높이 56px 이상.
  - 요금 입력: `TextField` "1회 평균 요금"(suffix "원", `inputMode="numeric"`, placeholder "예: 1500").
  - 도움말: `Paragraph.Text` "교통카드 1회 결제 금액을 넣어주세요".
  - 제출: `SubmitFooter` "시작하기" / "저장"(`display="block"`).
  - 알림: `Toast`.
  - 설정 모드 전용: `TextField` "월 정기권 가격"(선택 입력, suffix "원", `inputMode="numeric"`, placeholder "예: 55000").
    - 초기값은 저장된 `passPrice`이고, `null`이면 빈 값이다.
    - 빈 값으로 저장하면 `null`로 저장한다.
    - 1,000~500,000 범위 밖이면 에러를 표시한다(F3 AC-9, AC-10, AC-11).
- **상태**
  - 로딩: 없음(동기 읽기)
  - 빈 상태: F3 AC-5
  - 에러: F3 AC-3, AC-4, AC-8, AC-11
- **키보드**
  - 포커스를 받으면 `scrollIntoView({ block: 'center' })`로 필드를 화면 중앙에 둔다.
  - SubmitFooter는 키보드 위에 고정된다.
  - 입력 영역 바깥을 탭하면 blur된다.
- **Navigation state contract**
  - Incoming: 없음(`location.state`를 쓰지 않음)
  - Outgoing (온보딩): "시작하기" 저장 성공 → `navigate('/', { replace: true })`
  - Outgoing (설정): "저장" 저장 성공 → `navigate(-1)`
  - 저장에 실패하면 이동하지 않는다(F3 AC-8)
- **계측**: "시작하기" → `logClick('onboarding_start')`

### S2. 홈 `/`

- **골격**: ScreenScaffold, `Top` "이번 달 K-패스". 우측에 설정 아이콘 버튼(44×44px).
- **데이터 조회**: 이번 달 누적 = `monthIndex.byMonth[이번 달] ?? 0`, 오늘 횟수 = `days[오늘] ?? 0`.
- **TDS 컴포넌트 (위에서 아래 순서)**
  1. `Card` `data-testid="progress-card"`: SummaryHero(CountUp, `data-testid="month-count"`), "/ 21회", MiniBar, `Paragraph.Text` "21회까지 {remaining}회 남았어요" 또는 "환급 조건 달성"
  2. `Card` `data-testid="risk-card"`: 아래 문구 표의 상태 문구와 Badge
  3. `Card` `data-testid="refund-card"`: "예상 환급액", 금액(t2), 유형 라벨(예: "일반 20%"), 아래 표의 보조 문구
  4. `Paragraph.Text` `data-testid="today-count"`
  5. `Button` `data-testid="record-button"` "탑승 +1"(`display="block"`, `size="xlarge"`, 높이 56px 이상)
  6. `Button` `data-testid="undo-button"` "−1"(`variant="weak"`) → `decrementToday()`
  7. `ListRow` "이번 달 기록 수정"
  8. `ListRow` "정기권과 비교하기"
  9. `AdSlot`
- **risk-card 문구 표** (`calcRisk` 결과 기준, r = remainingDays, N = remaining, P = projection)

| status | 1줄 문구 | 2줄 문구 | Badge |
|---|---|---|---|
| `achieved` | "이번 달 환급 조건 21회를 채웠어요" | 없음 | "달성" |
| `danger` (count 0 포함) | "남은 {r}일 동안 {N}회를 채우기 어려워요" | 없음 | "위험" |
| `not_started` | "오늘 첫 탑승을 기록해 보세요" | 없음 | 없음 |
| `on_track` | "지금 속도면 {P}회로 21회를 넘겨요" | "남은 {r}일 동안 {N}회 더 타면 돼요" | "순항" |
| `warning` | "지금 속도면 {P}회로 {21−P}회 모자라요" | "남은 {r}일 동안 {N}회 더 타야 해요" | "주의" |

- **refund-card 문구 표** (이번 달 누적 count 기준)

| count | 금액(t2) | 보조 문구 |
|---|---|---|
| 0 | "0원" | "21회를 채우면 환급이 시작돼요" |
| 1~20 | "0원" | "21회까지 {21−count}회 남았어요 · 달성하면 예상 {calcRefund(21, fare, type)}원부터 받아요" |
| ≥ 21 | `calcRefund(count, fare, type)` | 없음 |

- **상태**
  - 로딩: 없음(F8 AC-8)
  - 빈 상태: F4 AC-5, AC-11, AC-13
  - 에러: F4 AC-6, AC-7, AC-12, AC-14
- **Navigation state contract**
  - Incoming: 없음
  - Outgoing: "이번 달 기록 수정" → `navigate('/records')`
  - Outgoing: "정기권과 비교하기" → `navigate('/insight', { state: { rideCount: number } })`, rideCount = `min(max(projection, count), 120)`. 항상 0~120 범위 안이다(F6 AC-9)
  - Outgoing: 설정 아이콘 → `navigate('/settings')`
  - Outgoing: 기록·되돌리기가 `NO_SETTINGS`를 반환하면 → `navigate('/onboarding', { replace: true })`(F4 AC-14)
- **계측**
  - "탑승 +1" → `logClick('record_ride')`
  - "정기권과 비교하기" → `logClick('go_insight')`
  - AdSlot → `logImpression('banner_ad')`
- **레이아웃 AC**: F4 AC-3, AC-9

### S3. 이번 달 기록 `/records`

- **골격**: ScreenScaffold, `Top` "9월 기록 · 합계 N회"(뒤로가기 포함). N = `monthIndex.byMonth[이번 달] ?? 0`.
- **TDS 컴포넌트**
  - `ListRow` × (1일~오늘, 최대 31개): 좌측 날짜, 우측 "−" / "N회" / "+" 버튼(각 44×44px 이상). 행 값 = `days[날짜] ?? 0`
  - `Toast`
- **스크롤**: 최대 31행이라 일반 스크롤을 쓴다. 가상 스크롤은 쓰지 않는다.
- **상태**
  - 로딩: 없음
  - 빈 상태: F5 AC-5
  - 에러: F5 AC-4, AC-6, AC-8
- **Navigation state contract**
  - Incoming: 없음
  - Outgoing: 뒤로 → `navigate(-1)`
  - Outgoing: ± 저장이 `NO_SETTINGS`를 반환하면 → `navigate('/onboarding', { replace: true })`(F5 AC-8)
- **계측**: 없음(전환 지점이 아님)

### S4. 분석 `/insight` (핵심 결과 화면, 리워드 게이트 위치)

- **골격**: ScreenScaffold, `Top` "K-패스 vs 정기권".
- **입력**
  - `TextField` "예상 월 탑승 횟수"(suffix "회", numeric). 필수, 0~120 정수
  - `TextField` "월 정기권 가격"(suffix "원", numeric). 필수, 1,000~500,000 정수. 초기값은 저장된 `passPrice`이고 `null`이면 빈 값
  - `SubmitFooter` "비교하기"
- **무료 층** (`data-testid="free-tier"`, `<TossRewardAd>` 바깥): 핵심 답이며, 이 층만으로 앱의 목적이 달성된다.
  - SummaryHero(CountUp): 이번 달 예상 환급액
  - `Card` `data-testid="verdict-card"`: 승자 문구(t2), Badge, 비용 비교 ListRow 2개
    - 유효한 두 입력으로 계산한 `comparePass` 결과가 있을 때만 판정을 그린다. 결과가 없으면(가격 미입력 상태) F6 AC-4 안내를 표시한다.
    - 판정 문구·Badge 표

| winner | 승자 문구 | Badge |
|---|---|---|
| `'kpass'` | "K-패스가 월 {diff}원 이득이에요" | "K-패스 이득" |
| `'pass'` | "정기권이 월 {diff}원 이득이에요" | "정기권 이득" |
| `'even'` (유효 입력에서 diff = 0일 때만) | "K-패스와 정기권 비용이 같아요" | "동일" |

  - `Button` "결과 공유하기"(`variant="weak"`, `display="block"`)
- **잠금 층** (`data-testid="locked-tier"`, `<TossRewardAd slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}>`의 유일한 자식)
  - `Card` `data-testid="scenario-card"` × 3: 유형별 환급액과 실부담. 실부담은 MiniBar로 비교
  - `Paragraph.Text` `data-testid="break-even"`
  - Sparkline `data-testid="trend-sparkline"`: `monthIndex.byMonth` 기반 6개월 추이(기록 없는 달은 0), 21회 기준선 포함
- **코드 구조 규칙** (테스트가 아니라 리뷰로 지킨다): 무료 층은 게이트 바깥에 두고, 잠금 층만 게이트 안에 둔다. 화면 전체를 감싸지 않는다.
- **"비교하기" 처리 순서**: 검증 → `comparePass`로 판정 갱신 → `saveSettings` → `QUOTA`면 Toast. 검증에 실패하면 판정·저장 모두 하지 않는다(F6 Description, AC-10, AC-11).
- **상태**
  - 로딩: 광고를 불러오는 동안 locked-tier 자리에 TossRewardAd 기본 잠금 UI만 표시한다. free-tier는 바로 표시한다.
  - 빈 상태: F6 AC-4, AC-7
  - 에러: F6 AC-5, AC-6, AC-10, AC-11
  - 광고 실패: 게이트가 자동으로 열린다(F6 AC-1).
- **키보드**: 숫자 키패드를 쓴다. 제출하면 blur한 뒤 verdict-card로 스크롤한다. SubmitFooter는 키보드 위에 고정한다.
- **Navigation state contract**
  - Incoming: `location.state = { rideCount: number } | null`.
    - null이면 F6 AC-8 규칙(`min(max(projection, count), 120)`)으로 초기값을 정한다.
    - 전달된 rideCount도 `min(max(rideCount, 0), 120)`으로 한 번 더 clamp해 채운다. 그래서 초기값이 F6 AC-5 에러를 일으키지 않는다(F6 AC-9).
  - Outgoing: 없음
- **계측**
  - "비교하기" → `logClick('compare_pass')`
  - verdict-card → `logImpression('insight_verdict')`
  - 공유 → `shareApp()` + `logClick('share_insight')`
  - 결과가 표시된 뒤 → `requestReviewOnce()`
- **레이아웃 AC**: F6 AC-1, AC-2

### S5. 지난 기록 `/history`

- **골격**: ScreenScaffold, `Top` "지난 환급 기록".
- **데이터 조회**: 행 목록 = `monthIndex.monthsDesc`에서 이번 달을 뺀 월. 횟수 = `monthIndex.byMonth[월]`. 계산 기준 = `months[월]`(없으면 현재 설정, "현재 설정 기준").
- **TDS 컴포넌트**
  - `Card` `data-testid="history-summary"`: SummaryHero(CountUp)
  - `ListRow` `data-testid="month-row"` × 최대 12개: 월, 횟수, 달성 Badge, 금액. 탑승 기록이 있는 달만 표시하고 고아 스냅샷은 제외한다
  - `Paragraph.Text`: 고지 문구
  - `AdSlot`: 목록 아래
- **스크롤**: 최대 12행이라 일반 스크롤을 쓴다.
- **상태**
  - 로딩: 없음
  - 빈 상태: F7 AC-3
  - 에러: F7 AC-5
- **Navigation state contract**
  - Incoming: 없음
  - Outgoing: 없음
- **계측**: AdSlot → `logImpression('banner_ad')`
- **레이아웃 AC**: F7 AC-2

## Assumptions

- **A1.** 유형별 환급률은 일반 20%, 청년 30%, 저소득 53%로 둔다. PRD에 수치가 없어 가정한 값이다.
- **A2.** 환급 인정 상한은 월 60회로 둔다. PRD에 없는 값이다.
- **A3.** 환급액은 "횟수 × 사용자가 입력한 평균 요금 × 환급률"로 추정한다. 그래서 모든 금액에 "예상"을 표기한다.
- **A4.** 환급 조건 21회는 PRD 기준이며, 상수 `REQUIRED_RIDES`로 관리한다.
- **A5.** 정기권은 사용자가 입력한 월 가격으로만 비교한다. 노선과 횟수 제한은 반영하지 않는다.
- **A6.** 월말 미달 위험은 푸시가 아니라 홈의 risk-card로만 알린다. 판정 기준은 하루 최대 2회 탑승이다. 기록이 0회여도 이 기준으로 채울 수 없으면 `danger`로 판정한다.
- **A7.** 1회 탭을 탑승 1회로 본다. 환승인지는 사용자가 판단한다.
- **A8.** 데이터는 기기 로컬에만 저장한다. 기기를 바꾸거나 앱 데이터를 삭제하면 기록이 사라진다. MVP에는 앱 안의 데이터 초기화 기능이 없다.

## Open Questions

- **Q1.** 21회 조건, 유형별 환급률, 60회 상한이 현재 K-패스 정책과 맞는지 공식 자료로 확인해야 한다.
- **Q2.** 청년·저소득 자격 기준을 온보딩에서 안내할지 정해야 한다. 지금은 사용자가 스스로 선택한다.
- **Q3.** 지역별 정기권 가격 프리셋을 제공할지 정해야 한다. 지금은 사용자가 직접 입력한다.
- **Q4.** (설계 노트) 잠금 층을 여는 990원 일회성 IAP는 콘솔에서 SKU가 발급되기 전에는 구현하지 않는다. 계층을 여는 구독도 제외한다.
- **Q5.** 리워드 게이트 해제 상태를 얼마나 유지할지는 템플릿 TossRewardAd의 기본 동작을 따른다. 별도 저장 스키마는 추가하지 않는다.

---

## 이번 수정에서 바뀐 점 (DB 스키마 검증 반영)

1. **모든 엔티티에 `id`·`createdAt`·`updatedAt`**
   - `MonthSnapshot`에 `id` 필드(`'YYYY-MM'`, 소속 `months` 맵 키와 같은 값)를 추가했다. "명시적 예외"를 없앴고, 이제 4개 엔티티(T1~T4) 모두 세 필드를 가진다.
   - 쓰기 함수는 `id`를 맵 키로 저장한다. 로더는 `id`가 없거나 맵 키와 다르면 맵 키로 채우고, 손상으로 보지 않는다. F1 AC-22 [W]를 추가했다.
   - F1 AC-1, AC-7, AC-8, AC-11, AC-18, AC-20, F3 AC-6, F5 AC-2, F7 AC-1의 fixture와 검증에 스냅샷 `id`를 반영했다. F1 AC-6과 AC-14에 `kpass:monthMeta` 문서 수준 기본값 검증을 추가했다.
   - `RideLog.days`는 테이블이 아니라 `RideLog` 문서의 map 컬럼이라고 정의했다. 항목에 타임스탬프를 두지 않는 이유(요구사항 없음, 저장량 증가)를 적었다.
2. **참조 관계(FK)를 명시**
   - Data Models에 "스키마 요약" 섹션을 추가했다. 논리 테이블 4개와 PK·UNIQUE·CHECK 제약, 참조 관계, ON DELETE 동작을 표로 정리했다.
   - 모든 참조 대상이 정의된 테이블(T1~T3)임을 명시했다. `MonthSnapshot.userType`은 FK가 아니라 스냅샷 시점 값의 복사본(CHECK 도메인)이라고 바로잡았다. 검증 리포트의 "userType → UserSettings FK" 해석을 정정한 것이다.
   - 스냅샷 ↔ `days` 월 대응은 약한 참조(ON DELETE NO ACTION)이고, 쓰기 → `UserSettings`는 존재 선행 조건(`NO_SETTINGS`)이라고 분류했다.
3. **인덱스 추가**
   - 두 map의 키를 PK 조회 인덱스로 명시했다. 월 합계를 위한 메모리 파생 인덱스 `MonthIndex`와 순수 함수 `buildMonthIndex(days)`를 추가했다. `useRides`가 `days`가 바뀔 때만 다시 계산한다.
   - F1 AC-21 [U]를 추가했다. 고정 입출력, 비정상 입력 방어, 네 화면이 인덱스만 쓰는지 확인한다.
   - F4·F5·F6·F7과 S2·S3·S4·S5의 월 합계, 목록, 추이 조회를 `monthIndex` 기준으로 바꿨다. F1 AC-4와 F4 AC-8에 인덱스 값 검증을 추가했다.
4. **크기 재계산**: MonthMeta는 13 × 약 125B ≈ 1.7KB이다. 전체 저장량은 여전히 약 11KB 이하다.

---

**변경 요약**

- **`id`/`createdAt`/`updatedAt` 누락**: 실제로 빠져 있던 것은 `MonthSnapshot`의 `id` 하나였고, `'YYYY-MM'` 값으로 추가했습니다. 로더는 `id`가 없거나 월 키와 다르면 월 키로 채웁니다(F1 AC-22 신규). `RideLog.days`는 테이블로 바꾸지 않고 문서 안의 map 컬럼으로 정의했습니다. 항목마다 타임스탬프를 두면 약 24KB가 더 들고, 이를 요구하는 기능도 없기 때문입니다.
- **FK**: 검증 리포트의 `MonthSnapshot.userType → UserSettings` FK 해석은 설계 의도와 맞지 않아 바로잡았습니다. 스냅샷은 과거 설정 값을 복사해 둔 것이라, FK로 묶으면 설정을 바꿀 때 지난달 금액도 같이 바뀝니다. SPEC에서는 이 필드를 CHECK 제약으로만 두었고, 나머지 참조 관계는 모두 정의된 테이블을 가리키도록 정리했습니다.
- **인덱스**: localStorage에는 DB 인덱스가 없습니다. 그래서 월 합계를 미리 묶어 두는 메모리 인덱스 `MonthIndex`를 추가했습니다(F1 AC-21 신규). 네 화면은 월 합계와 목록을 모두 여기서 읽습니다.