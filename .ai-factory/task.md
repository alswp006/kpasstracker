# TASK — KPassTracker

> 공통 테스트 규칙
> - 날짜가 들어가는 테스트는 모두 `vi.useFakeTimers()`와 `vi.setSystemTime(new Date(2026, 8, 22, 12))`처럼 **기기 로컬 시각**으로 고정합니다.
> - 테스트마다 `localStorage.clear()`를 실행합니다.
> - 모든 패킷이 끝나면 `npx tsc --noEmit`와 `npx vitest run`이 통과해야 합니다. 앱은 항상 컴파일되는 상태를 유지합니다.
>
> 파일 소유 규칙
> - **한 파일은 한 태스크만 만들고 수정합니다.**
> - 뒤 태스크는 앞 태스크의 파일을 import만 합니다.
> - 여러 모듈을 한 경로로 모으는 barrel 파일(`kpassCalc.ts`, `kpassStore.ts`, 페이지 파일)은 필요한 모듈이 모두 생긴 뒤 **마지막 태스크에서 한 번만** 만듭니다.

---

## Epic 1. Data Layer

**Risk**
- Complexity: High
- 위험 요소
  - 타입 이름이나 reason 리터럴이 SPEC과 다르면 이후 패킷들이 서로 다른 계약으로 구현됩니다.
  - 날짜 키를 UTC로 만들면 KST 00~09시에 날짜가 하루씩 어긋납니다.
  - 두 키 쓰기의 롤백 순서가 틀리면 `monthMeta`만 바뀐 채로 남습니다.
  - 검사 순서(`NO_SETTINGS` → `INVALID_DATE` → `DAILY_MAX`/`BELOW_ZERO`)가 틀리면 여러 AC가 한꺼번에 실패합니다.
  - 로더가 실수로 `setItem`을 호출하면 "raw 불변" 검증이 깨집니다.
  - 지난달 날짜 쓰기에서 스냅샷을 만들면 F7 금액이 바뀝니다.
  - 쓰기가 성공하기 전에 메모리 state를 바꾸면 QUOTA 상황에서 화면 수치가 틀어집니다.
  - 저장량은 약 11KB로 5MB 한도에 비해 여유가 크지만, QUOTA 처리는 mock으로 반드시 검증해야 합니다.
- 대응
  - 쌓는 순서: 타입(1.1) → 상수·날짜(1.2) → 계산(1.3~1.5) → 로더(1.6) → 설정 쓰기(1.7) → 날짜 쓰기(1.8) → 오늘 쓰기와 barrel(1.9) → 상태(1.10). 앞 단계의 테스트가 뒤 단계의 회귀를 막습니다.
  - 두 키 쓰기와 롤백은 `writePair` 하나로 모읍니다. 1.7에서 먼저 검증하고 1.8·1.9가 재사용합니다.
  - 날짜 유틸은 `getFullYear`/`getMonth`/`getDate`(로컬 시각)만 씁니다.

### Task 1.1 엔티티·파생 타입과 RouteState 정의
- Description:
  - `src/lib/types.ts`에 SPEC Data Models의 타입을 **그대로** 정의합니다: `UserType`, `UserSettings`, `RideLog`, `MonthSnapshot`, `MonthMeta`, `MonthIndex`, `RiskStatus`, `RiskResult`, `MonthSummary`, `PassComparison`, `StoreResult`, `SaveSettingsInput`, `SaveResult`.
  - RouteState 계약을 정의합니다. state를 받는 경로는 `/insight` 하나뿐입니다.
    ```ts
    export type InsightRouteState = { rideCount: number };
    export type RouteState = {
      "/": undefined;
      "/onboarding": undefined;
      "/settings": undefined;
      "/records": undefined;
      "/history": undefined;
      "/insight": InsightRouteState | null;
    };
    ```
  - state를 받는 쪽의 필수 패턴을 JSDoc으로 남깁니다.
    - `const state = (useLocation().state as RouteState["/insight"]) ?? null;`
    - 이어서 `typeof state?.rideCount === 'number' && Number.isFinite(state.rideCount)`를 확인합니다.
    - `as`는 컴파일 시점의 주장일 뿐이라는 점도 주석에 적습니다.
  - 런타임 코드는 넣지 않습니다. type과 interface만 둡니다.
- DoD:
  - `tsc --noEmit`가 통과합니다.
  - `StoreResult`의 reason 리터럴 5종(`NO_SETTINGS | INVALID_DATE | DAILY_MAX | BELOW_ZERO | QUOTA`)이 SPEC과 같습니다.
  - `MonthSnapshot`에 `id`, `createdAt`, `updatedAt`이 있습니다.
  - 파일에 `export const`와 `function`이 0건입니다.
- Covers: [] (기반 타입입니다. 이 타입 위에서 모든 AC를 검증하지만, 이 태스크가 직접 검증하는 AC는 없습니다.)
- Files: [src/lib/types.ts]
- Depends on: none

### Task 1.2 정책 상수와 날짜 키 유틸
- Description:
  - `src/lib/kpassPolicy.ts`는 SPEC 상수 6개를 정의하는 유일한 파일입니다.
    - `REQUIRED_RIDES = 21`
    - `REFUND_MAX_RIDES = 60`
    - `REFUND_RATE = { general: 0.20, youth: 0.30, lowIncome: 0.53 }`
    - `DAILY_MAX_RIDES = 20`
    - `RETENTION_MONTHS = 13`
    - `INSIGHT_MAX_RIDES = 120`
    - `USER_TYPE_LABEL = { general: "일반", youth: "청년", lowIncome: "저소득" }`도 여기에 둡니다.
  - `src/lib/dateKeys.ts`에는 순수 함수만 둡니다. 모두 로컬 시각 기준입니다.
    - `toDateKey(d)`, `toMonthKey(d)`
    - `isRealDateKey(s)`: `"2026-02-30"`, `"2026-9-5"`, `"abc"`, `""`이면 false
    - `isMonthKey(s)`: 월이 01~12일 때만 true
    - `cutoffMonth(today)`: 현재 월에서 12개월 전
    - `daysInMonth(today)`
    - `isValidRecordDate(dateKey, today)`: 실제 있는 날짜이고, 오늘보다 뒤가 아니고, cutoff 월보다 앞서지 않을 때만 true
    - `formatDayLabel(dateKey)`: `"9월 22일 (화)"`
    - `formatMonthLabel(monthKey)`: `"2026년 8월"`
    - `recentMonthKeys(today, n)`: 이번 달을 포함해 오래된 달부터 순서대로
- DoD: 단위 테스트가 모두 통과합니다.
  - `cutoffMonth(2026-09-22)` = `"2025-09"`
  - `isValidRecordDate`: `"2026-09-22"`와 `"2025-09-01"`은 true, `"2026-09-23"`·`"2025-08-31"`·`"2026-02-30"`은 false
  - `formatDayLabel("2026-09-22")` = `"9월 22일 (화)"`
  - 로컬 시각 2026-09-22 00:30에서 `toDateKey` = `"2026-09-22"`
- Covers: [] (날짜 판정의 기반입니다. F1-AC-7과 F1-AC-19는 Task 1.8에서 최종 검증합니다.)
- Files: [src/lib/kpassPolicy.ts, src/lib/dateKeys.ts, src/lib/__tests__/dateKeys.test.ts]
- Depends on: Task 1.1

### Task 1.3 계산 엔진 ① 환급액·실부담·손익분기
- Description:
  - `src/lib/calc/refund.ts`에 `calcRefund`, `calcKpassNetCost`, `calcBreakEven`을 구현합니다.
  - 입력 검사는 `src/lib/calc/guards.ts`의 `isValidCount`, `isValidPositive`, `isValidType`으로 합니다.
    - NaN, ±Infinity, number가 아닌 값은 모두 비정상입니다.
    - rides는 0 이상, fare와 passPrice는 0보다 커야 합니다.
  - 식: `floor(min(rides, 60) × fare × rate / 10) × 10`
  - 예외를 던지지 않습니다. 상수는 `kpassPolicy.ts`에서만 가져옵니다.
- DoD:
  - `calcRefund` 값
    - `(22, 1500, 'general')` = 6600
    - `(30, 1500, 'youth')` = 13500
    - `(21, 1500, 'lowIncome')` = 16690
    - `(20, 1500, 'lowIncome')` = 0
    - `(0, 1500, 'general')` = 0
    - `(75, 1500, 'general')` = 18000
  - `calcBreakEven` 값
    - `(1500, 'general', 55000)` = 46
    - `(1500, 'general', 500000)` = null
  - F2 AC-8, AC-10, AC-13의 비정상 입력 예시는 모두 0 또는 null을 반환하고, 예외는 0건입니다.
- Covers: [F2-AC-1, F2-AC-2, F2-AC-3, F2-AC-7, F2-AC-8, F2-AC-10, F2-AC-13]
- Files: [src/lib/calc/guards.ts, src/lib/calc/refund.ts, src/lib/__tests__/calcRefund.test.ts]
- Depends on: Task 1.2

### Task 1.4 계산 엔진 ② 예측·위험도·정기권 비교와 `kpassCalc.ts` barrel
- Description:
  - `src/lib/calc/risk.ts`에 아래 함수를 구현합니다.
    - `calcProjection(count, today)`: count가 비정상이면 0
    - `calcRisk(count, today)`
      - 판정 순서: achieved → danger → not_started → on_track → warning
      - r = D − 오늘 + 1, remaining = max(0, 21 − count)
      - count가 비정상이면 0으로 보고 판정합니다.
    - `comparePass(...)`: 인자 중 하나라도 비정상이면 `{ kpassNetCost:0, passPrice:0, winner:'even', diff:0 }`
    - `calcInsightInitialRides(count, today)`: `min(max(projection, count), 120)`
  - SPEC이 정한 공개 경로 `src/lib/kpassCalc.ts`를 barrel로 만들어 `refund.ts`와 `risk.ts`를 re-export합니다. 화면은 이 경로로만 import합니다.
- DoD:
  - `calcRisk` 값
    - `(14, 09-22)` = `{ warning, 19, 7, 9 }`
    - `(5, 09-28)`: danger, remaining 16, remainingDays 3
    - `(21, 09-10)`: achieved, remaining 0
    - `(12, 09-10)` = `{ on_track, 36, 9, 21 }`
    - `(0, 09-02)`: not_started, remaining 21, remainingDays 29
    - `(0, 09-20)`: not_started
    - `(0, 09-29)` = `{ danger, 0, 21, 2 }`
    - `(0, 09-21)`: danger
    - `(-3, 09-02)`: not_started
    - `(NaN, 09-22)` = `{ danger, 0, 21, 9 }`
  - `calcProjection` 값: `(0, 09-02)` = 0, `(-3, ·)` = 0, `(NaN, ·)` = 0
  - `comparePass`: 정상 예시 3개와 비정상 예시 7개(null 포함)가 SPEC 값과 같습니다.
  - `calcInsightInitialRides` 값: `(10, 2026-09-01)` = 120, `(130, 2026-09-22)` = 120, `(14, 2026-09-22)` = 19
- Covers: [F2-AC-4, F2-AC-5, F2-AC-6, F2-AC-9, F2-AC-11, F2-AC-12]
- Files: [src/lib/calc/risk.ts, src/lib/kpassCalc.ts, src/lib/__tests__/calcRisk.test.ts]
- Depends on: Task 1.3

### Task 1.5 화면 문구·금액 포맷 순수 모듈
- Description:
  - `src/lib/kpassCopy.ts`에 SPEC 문구 표를 순수 함수로 옮깁니다. 페이지 안에서는 문구를 조립하지 않습니다.
    - `formatWon(n)`: `toLocaleString('ko-KR')` + "원"
    - `riskCopy(risk)`: `{ line1, line2?, badge? }`, S2 risk-card 표 5행
    - `refundCopy(count, fare, type)`: `{ amount, sub? }`, S2 refund-card 표 3행. 금액은 `calcRefund`로만 계산합니다.
    - `typeRateLabel(type)`: 예 `"일반 20%"`
    - `verdictCopy(cmp)`: `{ text, badge }`, S4 판정 표
- DoD:
  - `riskCopy(calcRisk(14, 09-22))`는 `"지금 속도면 19회로 2회 모자라요"`, `"남은 9일 동안 7회 더 타야 해요"`, `"주의"`입니다.
  - 아래 경우의 문구가 SPEC과 글자 하나까지 같습니다.
    - danger: 5회, 09-28
    - danger: 0회, 09-29
    - on_track: 12회, 09-10
    - achieved: 22회
    - not_started: badge 없음
  - `refundCopy` 값
    - `(14, 1500, 'general').sub` = `"21회까지 7회 남았어요 · 달성하면 예상 6,300원부터 받아요"`
    - `(20, …).sub` = `"21회까지 1회 남았어요 · …6,300원부터 받아요"`
    - `(0, …).sub` = `"21회를 채우면 환급이 시작돼요"`
    - `(22, …).amount` = `"6,600원"`
  - `verdictCopy`의 3종 문구와 Badge가 SPEC과 같습니다.
- Covers: [F4-AC-4, F4-AC-9, F4-AC-10, F4-AC-11] (문구 생성 부분입니다. 화면 검증은 Task 3.3에서 합니다.)
- Files: [src/lib/kpassCopy.ts, src/lib/__tests__/kpassCopy.test.ts]
- Depends on: Task 1.4

### Task 1.6 저장소 ① 로더 3종과 `buildMonthIndex`
- Description:
  - `src/lib/storage/loaders.ts`에 `loadSettings`, `loadRides`, `loadMonthMeta`, `buildMonthIndex`를 구현합니다.
  - 로더는 `try { JSON.parse }`로 읽기만 합니다. `setItem`, `removeItem`, `console.error`는 0건입니다.
  - settings
    - 아래 중 하나라도 해당하면 null을 반환합니다: `version≠1`, userType이 3종이 아님, avgFare가 100~10,000 정수가 아님.
    - passPrice만 규칙에 맞지 않으면 그 필드만 null로 읽습니다.
  - rides
    - `days`에서 실제로 없는 날짜 키는 버립니다.
    - 정수가 아니거나 1 미만인 값은 버리고, 20을 넘는 값은 20으로 clamp합니다.
    - cutoff 월보다 앞선 키는 결과에서 뺍니다.
  - monthMeta
    - 문서가 손상이면 빈 months를 반환합니다.
    - 항목마다 월 키, userType, avgFare를 검증합니다.
    - `id`는 맵 키로 채우고, 빠진 타임스탬프는 보충하고, cutoff 월보다 앞선 키는 뺍니다.
  - 문서에 `id`나 타임스탬프가 없으면 고정 id와 현재 시각(ISO 문자열)으로 채웁니다.
  - `buildMonthIndex(days)`
    - 입력이 객체가 아니거나 배열이면 빈 인덱스를 반환합니다.
    - `monthsDesc`는 최신 월부터 정렬하고, 합계가 1 이상인 달만 넣습니다.
- DoD:
  - 아래 AC의 로더 검증 항목이 모두 테스트로 통과합니다: F1 AC-5, 6, 14, 16, 17, 18, 21, 22.
  - 모든 로더 호출 전후로 세 키의 raw 문자열이 같습니다.
  - `console.error` spy 호출은 0회입니다.
- Covers: [F1-AC-5, F1-AC-6, F1-AC-14, F1-AC-16, F1-AC-17, F1-AC-18, F1-AC-21, F1-AC-22]
- Files: [src/lib/storage/loaders.ts, src/lib/__tests__/loaders.test.ts]
- Depends on: Task 1.2

### Task 1.7 저장소 ② 두 키 원자적 쓰기와 `saveSettings`
- Description:
  - `src/lib/storage/writePair.ts`의 `writePair(first, second): boolean`
    1. 두 키의 이전 raw 문자열을 보관합니다.
    2. first를 `setItem`합니다. 실패하면 false를 반환합니다.
    3. second를 `setItem`합니다. 실패하면 first를 이전 raw로 되돌린 뒤 false를 반환합니다. 이전 값이 null이었다면 `removeItem`합니다.
    4. 롤백 쓰기 자체가 실패해도 예외를 삼킵니다.
  - `src/lib/storage/snapshot.ts`
    - `pruneMonthMeta(meta, today)`: cutoff 월보다 앞선 월 키를 지웁니다.
    - `upsertCurrentSnapshot(meta, settings, now)`: 이번 달 키만 다룹니다. `createdAt`은 유지하고, `id`는 맵 키로 저장합니다.
  - `src/lib/storage/settingsWriter.ts`의 `saveSettings(input): SaveResult`
    - 순서: monthMeta 정리 → 이번 달 스냅샷 갱신 → `writePair(kpass:monthMeta → kpass:settings)`
    - 기존 설정이 있으면 `createdAt`을 유지합니다. 기존 설정이 null이면(손상 포함) 새 문서로 만듭니다.
    - `kpass:rides`는 건드리지 않습니다.
- DoD:
  - F1 AC-11: 두 번째 저장에서도 `createdAt`은 그대로이고 `updatedAt`만 바뀝니다. `months["2026-09"].id`는 `'2026-09'`입니다.
  - F1 AC-12: `kpass:settings` 쓰기만 예외를 던지는 mock에서 QUOTA를 반환하고, monthMeta raw는 M0과 같고, settings 키는 없습니다.
  - F1 AC-13: 저장 전후로 `kpass:rides` raw가 같습니다.
- Covers: [F1-AC-11, F1-AC-12, F1-AC-13]
- Files: [src/lib/storage/writePair.ts, src/lib/storage/snapshot.ts, src/lib/storage/settingsWriter.ts, src/lib/__tests__/settingsWriter.test.ts]
- Depends on: Task 1.6

### Task 1.8 저장소 ③ `setDayCount`, 검사 순서, 보존 기간 정리
- Description:
  - `src/lib/storage/rideWriter.ts`의 `commitDay(dateKey, n, today): StoreResult`
    - n = 0이면 해당 날짜 키를 지웁니다.
    - rides와 monthMeta를 모두 cutoff 월 기준으로 정리합니다.
    - dateKey가 **이번 달일 때만** 이번 달 스냅샷을 upsert합니다. 지난달이면 months 값은 그대로 두고, 정리 결과와 문서 `updatedAt`만 반영합니다.
    - 쓰기는 `writePair(monthMeta → rides)`로 합니다. rides 문서의 `createdAt`은 유지하고, 없으면 지금 시각으로 채웁니다.
  - `setDayCount(date, n)` 검사 순서
    1. 설정이 없으면 `NO_SETTINGS`
    2. 유효한 기록 날짜가 아니면 `INVALID_DATE`
    3. n > 20이면 `DAILY_MAX`, n < 0이거나 정수가 아니면 `BELOW_ZERO`
    4. 모두 통과하면 `commitDay`
  - 검사에 실패하면 `setItem` 호출은 0회입니다.
- DoD:
  - F1 AC-2가 통과합니다.
  - AC-3: `setDayCount(…, 21)`이 `DAILY_MAX`를 반환합니다.
  - AC-9: `setDayCount(…, -1)`이 `BELOW_ZERO`를 반환합니다.
  - AC-7: `setDayCount`로 쓸 때도 두 키가 정리되고, `setItem`은 2회입니다.
  - AC-15: `setDayCount` 예시 3개와 손상 설정(`"{oops"`)에서 모두 `NO_SETTINGS`를 반환합니다.
  - AC-19: 모든 예시와 경계값이 통과합니다.
  - AC-20: 지난달 스냅샷이 deep equal로 그대로이고, `"2026-09"`와 `"2026-07"` 키는 없으며, 호출마다 `setItem`이 2회입니다.
- Covers: [F1-AC-2, F1-AC-3, F1-AC-7, F1-AC-9, F1-AC-15, F1-AC-19, F1-AC-20]
- Files: [src/lib/storage/rideWriter.ts, src/lib/__tests__/rideWriter.test.ts]
- Depends on: Task 1.7

### Task 1.9 저장소 ④ `incrementToday`·`decrementToday`와 `kpassStore.ts` barrel
- Description:
  - `src/lib/storage/todayWriter.ts`
    - `incrementToday()`: `NO_SETTINGS`를 먼저 검사합니다. 오늘 값이 20이면 `DAILY_MAX`, 아니면 `commitDay(today, n+1)`을 호출합니다.
    - `decrementToday()`: `NO_SETTINGS`를 먼저 검사합니다. 오늘 값이 0이면 `BELOW_ZERO`, 아니면 `commitDay(today, n−1)`을 호출합니다.
    - 두 함수 모두 `INVALID_DATE`를 반환하지 않습니다.
  - SPEC이 정한 공개 경로 `src/lib/storage/kpassStore.ts`를 barrel로 만듭니다. 아래 8개 함수만 re-export합니다.
    - `loadSettings`, `loadRides`, `loadMonthMeta`, `buildMonthIndex`
    - `saveSettings`, `incrementToday`, `decrementToday`, `setDayCount`
- DoD:
  - F1 AC-1: 오늘 값이 2가 되고, `createdAt`이 유지되고, 스냅샷이 갱신됩니다.
  - F1 AC-3: 오늘 20회일 때 raw 문자열이 그대로입니다.
  - F1 AC-4: 모든 `setItem`이 `DOMException('QuotaExceededError')`를 던지면 QUOTA를 반환하고 raw가 그대로입니다.
  - F1 AC-8: 2 → 1 → 키 삭제 순서로 바뀌고, 두 번째 호출의 count는 0입니다.
  - F1 AC-9: 오늘 0회에서 `decrementToday`가 `BELOW_ZERO`를 반환합니다.
  - F1 AC-10: rides 쓰기만 실패하면 monthMeta가 M0과 바이트 단위로 같습니다. M0이 null이었다면 키가 없습니다.
  - F1 AC-14 후속: `incrementToday` 뒤 저장된 rides에 `id`와 `createdAt`이 있습니다.
  - F1 AC-15: `incrementToday`와 `decrementToday`는 오늘 20회여도 `NO_SETTINGS`를 반환합니다.
  - F1 AC-17 후속: 저장된 days 값이 SPEC과 같습니다.
  - F1 AC-22 후속: 스냅샷 id 3개가 맞습니다.
  - barrel에서 8개 함수를 import할 수 있습니다.
- Covers: [F1-AC-1, F1-AC-3, F1-AC-4, F1-AC-8, F1-AC-9, F1-AC-10, F1-AC-14, F1-AC-15, F1-AC-17, F1-AC-22]
- Files: [src/lib/storage/todayWriter.ts, src/lib/storage/kpassStore.ts, src/lib/__tests__/todayWriter.test.ts]
- Depends on: Task 1.8

### Task 1.10 상태 관리: `KpassProvider`, `useSettings`, `useRides`, `useMonthMeta`
- Description:
  - `src/state/KpassProvider.tsx`에 React Context를 만듭니다.
  - 초기값은 `useState(() => loadSettings())`처럼 **동기 lazy init**으로 읽습니다. 스피너는 없습니다.
  - `today` state
    - 마운트할 때와, `visibilitychange`에서 `visibilityState === 'visible'`일 때 갱신합니다.
    - 갱신할 때 settings, rides, monthMeta도 다시 읽습니다.
  - `monthIndex = useMemo(() => buildMonthIndex(rides.days), [rides.days])`
  - 제공하는 훅
    - `useSettings()` → `{ settings, save }`
    - `useRides()` → `{ rides, monthIndex, today, todayKey, monthKey, increment, decrement, setDay }`
    - `useMonthMeta()` → monthMeta
  - 저장 함수를 호출한 뒤 **`ok:true`일 때만** state를 다시 읽습니다. 실패하면 state는 그대로 두고 결과만 반환합니다.
  - `src/main.tsx`의 루트를 Provider로 감쌉니다.
- DoD: `renderHook` 테스트가 통과합니다.
  - QUOTA mock에서 `increment()`를 호출해도 오늘 값과 `monthIndex.byMonth["2026-09"]`가 이전과 같습니다.
  - `save()`가 QUOTA를 반환하면 settings는 null로 남습니다.
  - 시각을 2026-10-01로 바꾸고 `visibilitychange`를 발생시키면 이번 달 합계는 0이고 `byMonth["2026-09"]`는 30입니다.
  - days가 바뀌지 않으면 `monthIndex`의 참조가 같습니다.
- Covers: [F1-AC-4, F1-AC-10, F1-AC-12, F4-AC-8, F8-AC-8]
- Files: [src/state/KpassProvider.tsx, src/main.tsx, src/state/__tests__/KpassProvider.test.tsx]
- Depends on: Task 1.9

---

## Epic 2. API Routes

**해당 없음.** SPEC Common Principles에 따라 서버가 없고 외부 API도 호출하지 않습니다. 모든 데이터는 Epic 1의 localStorage 계층이 처리합니다.

**Risk**
- Complexity: Low
- 위험 요소: 구현 중에 서버 코드나 외부 fetch가 섞여 들어올 수 있습니다.
- 대응: Task 4.3의 정적 스캔으로 외부 분석 SDK import 0건, 외부 이탈 코드 0건을 강제합니다.

---

## Epic 3. UI Pages

**Risk**
- Complexity: Medium
- 위험 요소
  - TDS 여백을 인라인 스타일로 덮어쓰면 검수에서 반려됩니다.
  - `/insight`의 `location.state`가 없거나 형식이 잘못되면 크래시할 수 있습니다.
  - TossRewardAd로 화면 전체를 감싸면 무료 층이 사라집니다.
  - 저장에 실패했는데 수치가 바뀔 수 있습니다.
  - Toast 문구가 한 글자만 달라도 AC가 실패합니다.
- 대응
  - 화면은 계산하지 않습니다. `kpassCalc`, `kpassCopy`, 훅만 호출합니다.
  - 각 화면은 `MemoryRouter`와 `KpassProvider`로 단독 테스트합니다.
  - 간격은 `Spacing size`로만, 색은 `var(--tds-color-*)`로만 지정합니다. 커스텀 CSS는 flex 배치에만 씁니다.
  - 한 화면을 여러 태스크가 만들 때는 앞 태스크가 하위 컴포넌트를 만들고, 마지막 태스크가 페이지 파일을 한 번만 만듭니다.

### Task 3.1 S1 공용 폼과 온보딩 모드
- Description:
  - `src/components/setup/SetupForm.tsx`
    - 유형 `ListRow` 3개: 단일 선택, 선택된 행 우측에 체크, 기본값 "일반"
    - `TextField` "1회 평균 요금": suffix "원", `inputMode="numeric"`, placeholder "예: 1500"
    - 도움말 `Paragraph.Text` "교통카드 1회 결제 금액을 넣어주세요"
    - 추가 필드 슬롯 `extraFields`
    - `SubmitFooter`(`display="block"`, label은 prop)
    - 입력 검증
      - 빈 값이면 "평균 요금을 입력해주세요"
      - 100 미만 또는 10,000 초과면 "100원에서 10,000원 사이로 입력해주세요"
    - 요금이 비어 있으면 제출 버튼은 disabled입니다.
    - Enter나 완료 키도 제출과 같습니다.
    - 입력에 포커스가 가면 `scrollIntoView({ block:'center' })`합니다.
  - `src/components/setup/OnboardingMode.tsx`
    - `Top` "K-패스 유형을 알려주세요", 버튼 "시작하기"
    - 제출하면 `logClick('onboarding_start')`를 호출하고 `save({ userType, avgFare, passPrice:null })`를 실행합니다.
      - 성공: `navigate('/', { replace:true })`
      - QUOTA: Toast "저장 공간이 부족해 저장하지 못했어요"를 띄우고, 이동하지 않고, 입력값을 유지합니다.
- DoD: `OnboardingMode`를 렌더한 RTL 테스트가 통과합니다.
  - F3 AC-1: 저장된 JSON과 `navigate` 인자가 SPEC과 같습니다.
  - F3 AC-3, AC-4: 에러 문구가 뜨고 settings raw는 그대로입니다.
  - F3 AC-5: 처음에 "일반"이 체크되어 있고, 요금 value는 `""`이고, 버튼은 disabled입니다.
  - F3 AC-7: `inputMode="numeric"`이고 Enter로 제출됩니다.
  - F3 AC-8: 온보딩 모드에서 QUOTA면 이동하지 않습니다.
  - "월 정기권 가격" 필드는 0개입니다.
- Covers: [F3-AC-1, F3-AC-3, F3-AC-4, F3-AC-5, F3-AC-7, F3-AC-8]
- Files: [src/components/setup/SetupForm.tsx, src/components/setup/OnboardingMode.tsx, src/components/__tests__/OnboardingMode.test.tsx]
- Depends on: Task 1.10

### Task 3.2 S1 설정 모드와 `SetupPage`
- Description:
  - `src/components/setup/SettingsMode.tsx`
    - `Top` "설정"(뒤로가기 포함), 버튼 "저장"
    - 폼 초기값은 저장된 설정입니다. passPrice가 null이면 `""`입니다.
    - `extraFields`에 `TextField` "월 정기권 가격"을 넣습니다: suffix "원", numeric, placeholder "예: 55000".
    - 가격 검증
      - 빈 값이면 null로 저장합니다.
      - 1,000 미만 또는 500,000 초과면 "1,000원에서 500,000원 사이로 입력해주세요"를 띄우고 **아무것도 저장하지 않습니다**. Toast도 띄우지 않습니다.
    - 저장 결과
      - 성공: Toast "설정을 저장했어요"를 띄우고 `navigate(-1)`을 호출합니다.
      - QUOTA: 실패 Toast를 띄우고 이 화면에 머뭅니다.
    - 방어 코드: settings가 null이면 `<Navigate to="/onboarding" replace />`를 반환합니다.
  - `src/pages/SetupPage.tsx`
    - ScreenScaffold 안에서 `mode` prop에 따라 `OnboardingMode` 또는 `SettingsMode`를 렌더합니다.
- DoD:
  - F3 AC-6: userType과 이번 달 스냅샷이 `'lowIncome'`, 스냅샷 id는 `'2026-09'`입니다. `createdAt`은 그대로이고, Toast가 뜨고, `navigate(-1)`이 호출됩니다.
  - F3 AC-8: 설정 모드에서 QUOTA면 `navigate(-1)` 호출이 0회입니다.
  - F3 AC-9: `62000`이 number로 저장됩니다. 경계값 1000과 500000은 에러 없이 저장됩니다.
  - F3 AC-10: 초기값이 "55000"이고, 비우고 저장하면 null로 저장되며, 에러는 0개입니다.
  - F3 AC-11: "500"과 "600000"에서 settings와 monthMeta raw가 그대로이고, userType은 general, Toast는 0건입니다.
- Covers: [F3-AC-6, F3-AC-8, F3-AC-9, F3-AC-10, F3-AC-11]
- Files: [src/components/setup/SettingsMode.tsx, src/pages/SetupPage.tsx, src/pages/__tests__/SetupPage.settings.test.tsx]
- Depends on: Task 3.1

### Task 3.3 S2 홈 ① 진행·위험·환급 카드
- Description:
  - `src/components/home/ProgressCard.tsx` (`data-testid="progress-card"`)
    - SummaryHero(CountUp)에 `data-testid="month-count"`를 붙입니다.
    - "/ 21회"와 MiniBar를 표시합니다. MiniBar 비율은 `min(count/21, 1)`입니다.
    - 문구는 "21회까지 {remaining}회 남았어요" 또는 "환급 조건 달성"입니다.
  - `src/components/home/RiskCard.tsx` (`data-testid="risk-card"`): `riskCopy` 결과를 표시하고, badge 값이 있을 때만 Badge를 붙입니다.
  - `src/components/home/RefundCard.tsx` (`data-testid="refund-card"`): "예상 환급액", 금액(t2), `typeRateLabel`, `refundCopy.sub`
  - `src/components/home/HomeCards.tsx`
    - `count = monthIndex.byMonth[monthKey] ?? 0`, `risk = calcRisk(count, today)`
    - 카드 3개를 `Spacing`으로 띄워 배치합니다.
    - **`days`를 직접 순회하지 않습니다.**
- DoD: `HomeCards`를 렌더한 테스트가 통과합니다.
  - F4 AC-3: 22회에서 MiniBar 100%, "환급 조건 달성", "6,600원", "일반 20%"
  - F4 AC-4: 14회(09-22)와 5회(09-28)의 문구와 Badge
  - F4 AC-5: 0회(09-02)에서 Badge 0개, "0원"
  - F4 AC-8: 날짜를 10-01로 바꾸면 month-count가 "0"
  - F4 AC-9: 14회와 20회의 보조 문구
  - F4 AC-10: on_track과 achieved의 문구와 Badge
  - F4 AC-11: 0회(09-29)에서 danger 문구가 뜨고 첫 기록 유도 문구는 0건
- Covers: [F4-AC-3, F4-AC-4, F4-AC-5, F4-AC-8, F4-AC-9, F4-AC-10, F4-AC-11]
- Files: [src/components/home/ProgressCard.tsx, src/components/home/RiskCard.tsx, src/components/home/RefundCard.tsx, src/components/home/HomeCards.tsx, src/components/__tests__/HomeCards.test.tsx]
- Depends on: Task 1.5, Task 1.10

### Task 3.4 S2 홈 ② 기록 버튼과 `HomePage`
- Description:
  - `src/components/home/RecordActions.tsx`
    - `Paragraph.Text` `data-testid="today-count"`: "오늘 N회"
    - `Button` `data-testid="record-button"` "탑승 +1": `display="block"`, `size="xlarge"`
    - `Button` `data-testid="undo-button"` "−1": `variant="weak"`, 오늘 0회이면 disabled
    - 결과별 처리

| 결과 | 처리 |
|---|---|
| ok | +1이면 Toast "오늘 {n}번째 탑승을 기록했어요", −1이면 Toast 없음 |
| DAILY_MAX | Toast "하루 최대 20회까지 기록할 수 있어요" |
| QUOTA (+1) | Toast "저장 공간이 부족해 기록하지 못했어요" |
| QUOTA (−1) | Toast "저장 공간이 부족해 기록을 되돌리지 못했어요" |
| NO_SETTINGS | Toast 없이 `navigate('/onboarding', { replace:true })` |

    - "탑승 +1"을 누를 때마다 `logClick('record_ride')`를 1회 호출합니다.
  - `src/pages/HomePage.tsx`
    - ScreenScaffold, `Top` "이번 달 K-패스"
    - 우측 설정 아이콘(44×44px)은 `navigate('/settings')`로 연결합니다.
    - 배치 순서: `HomeCards` → `RecordActions` → 두 ListRow
      - `ListRow` "이번 달 기록 수정" → `navigate('/records')`
      - `ListRow` "정기권과 비교하기" → `logClick('go_insight')` 후 `navigate('/insight', { state: { rideCount: calcInsightInitialRides(count, today) } satisfies RouteState["/insight"] })`
    - 배너는 이 파일에 두지 않습니다. Task 4.2의 셸이 담당합니다.
- DoD: `HomePage`를 렌더한 테스트가 통과합니다.
  - F4 AC-1: "14", "오늘 2회", Toast 표시, logClick 1회
  - F4 AC-2: `decrementToday` 1회 호출, "오늘 1회", "13", 저장값 1
  - F4 AC-6, AC-7, AC-12: 화면 수치가 그대로입니다.
  - F4 AC-13: undo-button이 disabled이고 호출은 0회입니다.
  - F4 AC-14: 설정 키 `removeItem`과 `"{oops"` 두 경우 모두, +1과 −1 각각에서 navigate 1회, Toast 0건, raw 그대로입니다.
  - F6 AC-9(홈 쪽): 10회(09-01)에서 state `{ rideCount:120 }`으로 이동합니다.
- Covers: [F4-AC-1, F4-AC-2, F4-AC-6, F4-AC-7, F4-AC-12, F4-AC-13, F4-AC-14, F6-AC-9]
- Files: [src/components/home/RecordActions.tsx, src/pages/HomePage.tsx, src/pages/__tests__/HomePage.test.tsx]
- Depends on: Task 3.3

### Task 3.5 S3 이번 달 기록 수정 (`/records`)
- Description:
  - `src/pages/RecordsPage.tsx`
    - `Top` "{M}월 기록 · 합계 N회"(뒤로가기 포함). N = `monthIndex.byMonth[monthKey] ?? 0`
    - `ListRow` `data-testid="day-row"`: 1일부터 오늘까지, 최신 날짜부터
      - 좌측: `formatDayLabel`
      - 우측: "−", "N회", "+". 버튼은 각각 44×44px 이상이고 flex `gap` 8px 이상입니다.
    - 값이 0인 행: "0회"를 `var(--tds-color-grey-400)`로 표시하고 "−"를 disabled로 둡니다.
    - 합계가 0이면 목록 위에 Paragraph.Text "아직 이번 달 기록이 없어요. 탄 날에 +를 눌러주세요"를 표시합니다.
  - `setDay(date, v±1)` 결과 처리
    - DAILY_MAX: Toast "하루 최대 20회까지 기록할 수 있어요"
    - QUOTA: Toast "저장 공간이 부족해 기록하지 못했어요"
    - NO_SETTINGS: `navigate('/onboarding', { replace:true })`
- DoD:
  - F5 AC-1: 행 22개, 첫 행 "9월 22일 (화)"
  - F5 AC-2: "+" 2번 → "2회", 합계 +2, 스냅샷 id "2026-09"
  - F5 AC-3: "−"가 disabled이고 호출 0회
  - F5 AC-4, AC-6: 값이 그대로입니다.
  - F5 AC-5: 회색 "0회"와 안내 문구
  - F5 AC-7: 버튼 44px 이상, gap 8px 이상
  - F5 AC-8: +와 − 모두 navigate 1회, Toast 0건, raw 그대로
  - 파일에 `days`를 순회하는 코드가 0건입니다.
- Covers: [F5-AC-1, F5-AC-2, F5-AC-3, F5-AC-4, F5-AC-5, F5-AC-6, F5-AC-7, F5-AC-8]
- Files: [src/pages/RecordsPage.tsx, src/pages/__tests__/RecordsPage.test.tsx]
- Depends on: Task 1.10

### Task 3.6 S4 분석 ① 입력 상태 훅과 무료 층
- Description:
  - `src/hooks/useInsightState.ts`
    - **RouteState 수신은 아래 패턴을 반드시 따릅니다.**
      ```ts
      const state = (useLocation().state as RouteState["/insight"]) ?? null;
      const initialRides =
        state && typeof state.rideCount === 'number' && Number.isFinite(state.rideCount)
          ? Math.min(Math.max(Math.round(state.rideCount), 0), 120)
          : calcInsightInitialRides(count, today);
      ```
    - 가격 필드 초기값은 저장된 passPrice이고, null이면 `""`입니다. passPrice가 유효하면 첫 comparison을 미리 계산합니다.
    - `submit()` 처리 순서
      1. `logClick('compare_pass')`
      2. 검증. 실패하면 여기서 멈춥니다.
         - 탑승 횟수가 0~120 정수가 아니면 "0회에서 120회 사이로 입력해주세요"
         - 가격이 비었으면 "정기권 가격을 입력해주세요"
         - 가격이 범위 밖이면 "1,000원에서 500,000원 사이로 입력해주세요"
      3. `setComparison(comparePass(...))`
      4. `save({ 현재 userType, avgFare, passPrice })`. QUOTA면 Toast "저장 공간이 부족해 저장하지 못했어요"를 띄우고 판정은 그대로 둡니다.
    - 반환값: `{ rides, price, errors, comparison, committedRides, submit, ... }`
  - `src/components/insight/VerdictCard.tsx` (`data-testid="verdict-card"`)
    - comparison이 있으면 `verdictCopy` 문구(t2), Badge, 비용 ListRow 2개를 표시합니다.
    - 없으면 `Asset.ContentIcon`과 "정기권 가격을 넣으면 어느 쪽이 이득인지 알려드려요"를 표시합니다.
    - 처음 렌더될 때 `logImpression('insight_verdict')`와 `requestReviewOnce()`를 1회씩 호출합니다. ref로 중복을 막습니다.
  - `src/components/insight/InsightFreeSection.tsx` (`data-testid="free-tier"`)
    - TextField 2개(numeric)
    - SummaryHero "이번 달 예상 환급액"
    - VerdictCard
    - `Button` "결과 공유하기"(`variant="weak"`) → `shareApp()`, `logClick('share_insight')`
    - `SubmitFooter` "비교하기"
    - 제출 후 blur하고 verdict-card로 스크롤합니다.
- DoD: 테스트 harness(`MemoryRouter` + Provider + 훅 + 섹션)로 통과합니다.
  - F6 AC-1: state `{ rideCount:30 }`이면 "9,000원"과 "K-패스가 월 19,000원 이득이에요"
  - F6 AC-3: 50/55000 → 정기권 이득, 55000 저장. 30/36000 → "동일"
  - F6 AC-4: 안내 문구
  - F6 AC-5, AC-6, AC-10: comparePass와 save 호출 0회, raw 그대로, 이전 판정 유지
  - F6 AC-8: state null, 14회 → "19". impression과 review 각 1회. 공유 버튼 동작
  - F6 AC-9: state 120과 null 모두 `"120"`, 에러 0건
  - F6 AC-11: Toast 표시, 판정 갱신, raw 그대로, passPrice null, 다시 들어오면 빈 값
  - **state가 없는 직접 진입, `{ rideCount:"abc" }`, `{}`에서도 크래시하지 않고 기본값으로 렌더합니다.**
- Covers: [F6-AC-1, F6-AC-3, F6-AC-4, F6-AC-5, F6-AC-6, F6-AC-8, F6-AC-9, F6-AC-10, F6-AC-11]
- Files: [src/hooks/useInsightState.ts, src/components/insight/VerdictCard.tsx, src/components/insight/InsightFreeSection.tsx, src/components/__tests__/InsightFreeSection.test.tsx]
- Depends on: Task 1.5, Task 1.10

### Task 3.7 S4 분석 ② 잠금 층과 `InsightPage`
- Description:
  - `src/components/insight/LockedTier.tsx` (`data-testid="locked-tier"`)
    - `scenario-card` × 3: 유형별 `calcRefund`와 `calcKpassNetCost`. 실부담은 MiniBar로 비교합니다.
    - `break-even`
      - 값이 있으면 "월 {n}회 이상 타면 정기권이 이득이에요"
      - null이면 "정기권 가격을 넣으면 손익분기를 알려드려요"
    - `trend-sparkline`
      - 값: `recentMonthKeys(today, 6).map(k => monthIndex.byMonth[k] ?? 0)`
      - 21회 기준선을 함께 그립니다.
      - `monthsDesc.length < 2`이면 Sparkline 대신 "추이를 보려면 2개월 이상 기록이 필요해요"를 표시합니다.
  - `src/pages/InsightPage.tsx`
    - ScreenScaffold, `Top` "K-패스 vs 정기권"
    - `useInsightState()` → `InsightFreeSection` 순서로 배치합니다. 무료 층은 게이트 **바깥**입니다.
    - 그 아래에 `<TossRewardAd slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}><LockedTier …/></TossRewardAd>`를 둡니다. LockedTier가 **유일한 자식**입니다.
- DoD: 슬롯 ID가 없어서 게이트가 자동으로 열리는 환경에서 테스트가 통과합니다.
  - F6 AC-1: free-tier가 게이트 바깥에 렌더됩니다.
  - F6 AC-2: 시나리오 값 9,000/36,000, 13,500/31,500, 23,850/21,150. "월 46회 이상…", sparkline 렌더
  - F6 AC-7: 기록한 달이 1개면 안내 문구가 나오고 sparkline은 0개
  - `TossRewardAd`의 children은 `LockedTier` 하나입니다.
- Covers: [F6-AC-1, F6-AC-2, F6-AC-7]
- Files: [src/components/insight/LockedTier.tsx, src/pages/InsightPage.tsx, src/pages/__tests__/InsightPage.test.tsx]
- Depends on: Task 3.6

### Task 3.8 S5 지난 기록 (`/history`)
- Description:
  - `src/lib/history.ts`: `buildHistory(monthIndex, meta, settings, currentMonthKey)` → `{ rows: MonthSummary[], total, achievedCount }`
    - `monthsDesc`에서 이번 달을 빼고 최대 12개를 씁니다. 고아 스냅샷은 인덱스에 없으므로 자동으로 빠집니다.
    - 그 달의 스냅샷이 없으면 현재 설정으로 계산하고 `usedFallback:true`로 표시합니다.
  - `src/pages/HistoryPage.tsx`
    - `Top` "지난 환급 기록"
    - `history-summary` Card
      - SummaryHero(CountUp)로 누적 금액을 표시합니다.
      - 문구: "지난 12개월 기록 기반 예상 환급액 · 달성 {a}/{n}개월"
    - `month-row` ListRow: 예 "2026년 8월 · 23회 · 달성 · 예상 6,900원"
      - 달성 Badge를 붙입니다.
      - 대체 계산한 달은 보조 문구 "현재 설정 기준"을 붙입니다.
    - 빈 상태: `Asset.ContentIcon`과 "아직 지난달 기록이 없어요. 이번 달이 끝나면 여기에 쌓여요"를 표시하고, summary는 렌더하지 않습니다.
    - 하단 고지: "실제 환급액은 카드사 정산 결과와 다를 수 있어요"
    - 배너는 Task 4.2의 셸이 담당합니다.
- DoD:
  - F7 AC-1: 행 2개와 문구, 9월 행 없음
  - F7 AC-2: "6,900원", "달성 1/2개월"
  - F7 AC-3: 빈 상태 표시
  - F7 AC-4: 스냅샷 없는 8월 → "예상 6,900원"과 "현재 설정 기준"
  - F7 AC-5: `"{broken"`이면 모든 행에 "현재 설정 기준", `console.error` 0회
  - F7 AC-6: 모든 금액에 "예상"이 붙고 고지 문구가 있습니다.
  - F7 AC-7: 6월 행 없음
  - F1 AC-20(화면): `setDayCount("2026-08-10", 3)` 뒤 8월은 26회 "예상 7,800원", 7월 행에는 "현재 설정 기준"
- Covers: [F7-AC-1, F7-AC-2, F7-AC-3, F7-AC-4, F7-AC-5, F7-AC-6, F7-AC-7, F1-AC-20]
- Files: [src/lib/history.ts, src/pages/HistoryPage.tsx, src/lib/__tests__/history.test.ts, src/pages/__tests__/HistoryPage.test.tsx]
- Depends on: Task 1.5, Task 1.10

---

## Epic 4. Integration + Landing

**Risk**
- Complexity: Medium
- 위험 요소
  - 설정 가드가 빠지면 설정 없이 홈이 렌더되어 NaN이 표시됩니다.
  - 배너가 두 개 뜨거나 탭바와 겹칠 수 있습니다.
  - 광고 ID가 비어 있으면 빈 영역이 남을 수 있습니다.
  - HEX 색상, `window.open`, `.at(` 같은 코드가 섞여 검수에서 반려될 수 있습니다.
  - 광고 ID는 빌드 시점에 주입되므로, 콘솔에서 ID를 받은 뒤 재빌드를 빠뜨릴 수 있습니다.
- 대응
  - 배너(4.1) → 라우팅·셸(4.2) → 정적 스캔(4.3) 순서로 진행합니다.
  - 배너는 페이지 파일을 고치지 않고 셸 레이아웃 한 곳에서만 배치합니다.
  - 검수 규칙은 테스트로 고정합니다.
  - README 배포 체크리스트에 "ID가 바뀌면 재빌드"를 넣습니다.

### Task 4.1 배너 영역 컴포넌트
- Description:
  - `src/components/BannerArea.tsx`
    - `import.meta.env.VITE_TOSS_AD_GROUP_ID`가 빈 값이면 `null`을 반환합니다(높이 0).
    - 값이 있으면 `<AdSlot adGroupId={…} />`를 렌더하고, 마운트할 때 `logImpression('banner_ad')`를 호출합니다.
- DoD:
  - env가 빈 값이면 AdSlot 0개, `console.error` 0회
  - env가 있으면 AdSlot 1개, `logImpression('banner_ad')` 1회
- Covers: [F8-AC-3]
- Files: [src/components/BannerArea.tsx, src/components/__tests__/BannerArea.test.tsx]
- Depends on: Task 1.10

### Task 4.2 라우팅, 설정 가드, 탭 셸 레이아웃
- Description:
  - `src/components/RequireSettings.tsx`: settings가 null이면 `<Navigate to="/onboarding" replace />`, 아니면 `<Outlet />`
  - `src/components/ShellLayout.tsx`
    - 배치 순서: `<Outlet />` → (`/` 또는 `/history`일 때만) `BannerArea` → 탭바 높이만큼 `Spacing` → `FloatingTabBar`
    - FloatingTabBar 탭: "홈"(`/`), "분석"(`/insight`), "지난 기록"(`/history`)
    - 선택 상태는 `pathname`으로 정합니다. 터치 영역은 44px 이상입니다.
  - `src/App.tsx`의 Routes
    - `/onboarding` → `SetupPage mode="onboarding"`
    - `RequireSettings` 아래
      - `ShellLayout` 안: `/`, `/insight`, `/history`
      - 셸 밖: `/records`, `/settings`(`mode="settings"`)
    - `*` → `<Navigate to="/" replace />`
- DoD: `MemoryRouter` 통합 테스트가 통과합니다.
  - F3 AC-2: 설정이 없을 때와 `"{oops"`일 때 5개 경로 모두 `/onboarding`으로 가고, 히스토리 길이가 늘지 않습니다. `/settings`로 들어가면 온보딩 문구가 나오고 정기권 필드는 0개입니다.
  - F1 AC-16: 손상 설정 5종에서 `/` → `/onboarding`
  - F8 AC-1: 탭 3개와 선택 상태
  - F8 AC-2: `/`와 `/history`에서 AdSlot이 1개이고, DOM에서 마지막 콘텐츠 다음이자 탭바 앞에 있습니다. 다른 경로에서는 0개입니다.
  - F8 AC-4: `/unknown` → `/`
  - F8 AC-8: 첫 렌더에 스피너 0개이고 실제 값을 표시합니다.
- Covers: [F3-AC-2, F1-AC-16, F8-AC-1, F8-AC-2, F8-AC-4, F8-AC-8]
- Files: [src/components/RequireSettings.tsx, src/components/ShellLayout.tsx, src/App.tsx, src/__tests__/routing.test.tsx]
- Depends on: Task 3.2, Task 3.4, Task 3.5, Task 3.7, Task 3.8, Task 4.1

### Task 4.3 검수 준수 정적 스캔, 스모크 테스트, 배포 체크리스트
- Description:
  - `src/__tests__/compliance.test.ts`: `src/**/*.{ts,tsx,css}`를 재귀로 읽어 아래가 모두 0건인지 확인합니다. 자기 자신은 스캔에서 뺍니다.
    - `window.open(`, `window.location.href =`, "앱을 설치", "다운로드"
    - `gtag`, `amplitude`, `mixpanel` import
    - `#[0-9a-fA-F]{3,8}\b` 형태의 HEX 색상
    - `structuredClone`, `.at(`, `Object.hasOwn`, `Intl.Segmenter`
    - 아래 화면 파일 안의 `Object.keys(days)`와 `Object.entries(days)`
      - `HomeCards.tsx`, `HomePage.tsx`, `RecordsPage.tsx`
      - `useInsightState.ts`, `LockedTier.tsx`
      - `HistoryPage.tsx`, `history.ts`
  - `src/__tests__/smoke.test.tsx`: 5개 화면을 차례로 렌더하는 동안 `console.error` 호출이 0회인지 확인합니다.
  - `README.md` 배포 체크리스트
    - `VITE_TOSS_AD_GROUP_ID`와 `VITE_TOSS_AD_SLOT_ID`는 빌드 시점에 주입됩니다. 값이 바뀌면 재빌드하고 재배포해야 합니다.
    - `vite build` 뒤 5개 화면을 돌며 콘솔 에러가 0건인지 확인합니다.
- DoD:
  - `npx vitest run compliance smoke`가 통과합니다.
  - `npm run build`가 성공합니다.
  - README에 체크리스트가 있습니다.
- Covers: [F8-AC-5, F8-AC-6, F8-AC-7, F1-AC-21]
- Files: [src/__tests__/compliance.test.ts, src/__tests__/smoke.test.tsx, README.md]
- Depends on: Task 4.2

---

## 의존 그래프

```
1.1 → 1.2 ─┬→ 1.3 → 1.4 → 1.5 ──────────────────────────────┐
           └→ 1.6 → 1.7 → 1.8 → 1.9 → 1.10 ─────────────────┤
                                                            ├→ 3.1 → 3.2 ────────┐
                                                            ├→ 3.3 → 3.4 ────────┤
                                                            ├→ 3.5 ──────────────┤
                                                            ├→ 3.6 → 3.7 ────────┤
                                                            ├→ 3.8 ──────────────┤
                                                            └→ 4.1 ──────────────┴→ 4.2 → 4.3
```

- 태스크는 모두 19개이고, 각 태스크는 파일 1~5개를 다룹니다.
- **모든 파일은 정확히 한 태스크에서만 만들고 수정합니다.** 나머지 태스크는 import만 합니다.
- barrel 파일 `kpassCalc.ts`(1.4)와 `kpassStore.ts`(1.9), 그리고 각 페이지 파일(3.2, 3.4, 3.7)은 필요한 모듈이 다 생긴 태스크에서 한 번만 만듭니다.

**Route State 점검**
- state를 받는 화면은 `/insight` 하나뿐입니다.
- 수신은 `useInsightState`(Task 3.6)에서 `?? null` 가드와 `Number.isFinite` 검사로 합니다.
- state 없이 직접 들어오거나, `{ rideCount:"abc" }` 또는 `{}`가 들어와도 크래시 없이 기본값으로 렌더합니다. Task 3.6 DoD에서 검증합니다.
- 보내는 쪽은 Task 3.4 한 곳이며 `satisfies RouteState["/insight"]`로 타입을 맞춥니다.

---

## AC Coverage

- **SPEC의 전체 AC: 94개** (F1 22, F2 13, F3 11, F4 14, F5 8, F6 11, F7 7, F8 8)
- **태스크로 커버된 AC: 94개**
  - F1-AC-1: Task 1.9
  - F1-AC-2: Task 1.8
  - F1-AC-3: Task 1.8, Task 1.9
  - F1-AC-4: Task 1.9, Task 1.10
  - F1-AC-5: Task 1.6
  - F1-AC-6: Task 1.6
  - F1-AC-7: Task 1.8
  - F1-AC-8: Task 1.9
  - F1-AC-9: Task 1.8, Task 1.9
  - F1-AC-10: Task 1.9, Task 1.10
  - F1-AC-11: Task 1.7
  - F1-AC-12: Task 1.7, Task 1.10
  - F1-AC-13: Task 1.7
  - F1-AC-14: Task 1.6, Task 1.9
  - F1-AC-15: Task 1.8, Task 1.9
  - F1-AC-16: Task 1.6, Task 4.2
  - F1-AC-17: Task 1.6, Task 1.9
  - F1-AC-18: Task 1.6
  - F1-AC-19: Task 1.8
  - F1-AC-20: Task 1.8, Task 3.8
  - F1-AC-21: Task 1.6, Task 4.3
  - F1-AC-22: Task 1.6, Task 1.9
  - F2-AC-1: Task 1.3
  - F2-AC-2: Task 1.3
  - F2-AC-3: Task 1.3
  - F2-AC-4: Task 1.4
  - F2-AC-5: Task 1.4
  - F2-AC-6: Task 1.4
  - F2-AC-7: Task 1.3
  - F2-AC-8: Task 1.3
  - F2-AC-9: Task 1.4
  - F2-AC-10: Task 1.3
  - F2-AC-11: Task 1.4
  - F2-AC-12: Task 1.4
  - F2-AC-13: Task 1.3
  - F3-AC-1: Task 3.1
  - F3-AC-2: Task 4.2
  - F3-AC-3: Task 3.1
  - F3-AC-4: Task 3.1
  - F3-AC-5: Task 3.1
  - F3-AC-6: Task 3.2
  - F3-AC-7: Task 3.1
  - F3-AC-8: Task 3.1, Task 3.2
  - F3-AC-9: Task 3.2
  - F3-AC-10: Task 3.2
  - F3-AC-11: Task 3.2
  - F4-AC-1: Task 3.4
  - F4-AC-2: Task 3.4
  - F4-AC-3: Task 3.3
  - F4-AC-4: Task 1.5, Task 3.3
  - F4-AC-5: Task 3.3
  - F4-AC-6: Task 3.4
  - F4-AC-7: Task 3.4
  - F4-AC-8: Task 1.10, Task 3.3
  - F4-AC-9: Task 1.5, Task 3.3
  - F4-AC-10: Task 1.5, Task 3.3
  - F4-AC-11: Task 1.5, Task 3.3
  - F4-AC-12: Task 3.4
  - F4-AC-13: Task 3.4
  - F4-AC-14: Task 3.4
  - F5-AC-1: Task 3.5
  - F5-AC-2: Task 3.5
  - F5-AC-3: Task 3.5
  - F5-AC-4: Task 3.5
  - F5-AC-5: Task 3.5
  - F5-AC-6: Task 3.5
  - F5-AC-7: Task 3.5
  - F5-AC-8: Task 3.5
  - F6-AC-1: Task 3.6, Task 3.7
  - F6-AC-2: Task 3.7
  - F6-AC-3: Task 3.6
  - F6-AC-4: Task 3.6
  - F6-AC-5: Task 3.6
  - F6-AC-6: Task 3.6
  - F6-AC-7: Task 3.7
  - F6-AC-8: Task 3.6
  - F6-AC-9: Task 3.4, Task 3.6
  - F6-AC-10: Task 3.6
  - F6-AC-11: Task 3.6
  - F7-AC-1: Task 3.8
  - F7-AC-2: Task 3.8
  - F7-AC-3: Task 3.8
  - F7-AC-4: Task 3.8
  - F7-AC-5: Task 3.8
  - F7-AC-6: Task 3.8
  - F7-AC-7: Task 3.8
  - F8-AC-1: Task 4.2
  - F8-AC-2: Task 4.2
  - F8-AC-3: Task 4.1
  - F8-AC-4: Task 4.2
  - F8-AC-5: Task 4.3
  - F8-AC-6: Task 4.3
  - F8-AC-7: Task 4.3
  - F8-AC-8: Task 1.10, Task 4.2
- **커버되지 않은 AC: 0개** (없음)