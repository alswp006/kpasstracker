🇰🇷 [English](./README.md)

# KPassTracker — 한국 대중교통 카드 분석기

KPassTracker는 토스 생태계의 미니앱으로, 한국 대중교통 이용자들이 K-Pass 사용을 추적하고 환급 자격을 계산하며, K-Pass와 월정액 정기권의 금전적 이점을 비교할 수 있도록 도와줍니다.

## 주요 기능

- 📊 **일일 탑승 기록** — 햅틱 피드백과 함께 탑승을 기록하고 취소하며, 월별 총합 확인
- 💰 **환급금 계산** — 탑승 횟수, 운임료, 사용자 유형(일반/청소년/저소득)을 기반으로 K-Pass 환급금 자동 계산
- 🎯 **위험 상태 추적** — 21회 환급 기준까지의 실시간 진행 상황을 지능형 상태 표시기로 확인
- 📈 **정기권 비교** — K-Pass 순비용과 월정액 정기권 가격 비교, 손익분기점 파악
- 📅 **월별 기록** — 인라인 검증 및 오류 메시지를 통한 일일 탑승 횟수 수정
- 📊 **사용 이력** — 지난 12개월간의 탑승 추이 확인 및 분석
- 🎬 **보상 게이트** — 선택적 광고 게이트 뒤의 프리미엄 분석(시나리오, 손익분기점 계산, 과거 추세)
- 🎨 **네이티브 경험** — Toss Design System(TDS) 컴포넌트로 다크모드 지원 및 safe-area 처리

## 기술 스택

- **프레임워크**: React 18 + Vite (CSR, SSR 없음)
- **UI**: Toss Design System (`@toss/tds-mobile`)
- **라우팅**: React Router DOM v7
- **플랫폼**: Apps-in-Toss 미니앱 프레임워크
- **데이터**: 브라우저 localStorage (백엔드 없음)
- **스타일링**: CSS-in-JS (Emotion) + TDS 테마 시스템
- **타입 안정성**: TypeScript 5.8

## 시작하기

### 의존성 설치
```bash
npm install
```

### 프로덕션 빌드
```bash
npx vite build
```

`dist/` 디렉토리로 출력됩니다. `npm run gate`를 실행하여 규정 준수 확인(타입 안정성, 콘솔 에러 없음, 정책 검사)을 할 수 있습니다.

### 토스 미니앱 플랫폼에 배포
```bash
npx ait build
npx ait deploy --api-key <YOUR_API_KEY>
```

(토스 개발자 콘솔이 리뷰 및 릴리스 흐름을 완료합니다.)

### 개발 워크플로우 (참고용)
```bash
npx tsc --noEmit          # TypeScript 검사
npx vitest run            # 단위 테스트
npm run test:visual       # 비주얼 스모크 테스트 (Playwright)
```

> **참고:** dev server(`npm run dev`)는 변경사항을 확인하는 데 사용할 수 없습니다. 위의 세 명령어를 대신 사용하세요. Toss WebView와 비주얼 스모크 테스트만이 신뢰할 수 있는 미리보기를 제공합니다.

## 환경 변수

| 변수 | 설명 | 필수 여부 |
|---|---|---|
| `VITE_SHARE_OG_URL` | 공유 미리보기 이미지 URL (카카오톡, SMS) | 아니오 |
| `VITE_TOSS_AD_GROUP_ID` | 배너 광고 그룹 ID (토스 콘솔) | 아니오 |
| `VITE_TOSS_AD_SLOT_ID` | 보상/전면 광고 슬롯 ID (토스 콘솔) | 아니오 |
| `VITE_TOSS_IAP_SKU` | 인앱 결제 SKU (향후 사용) | 아니오 |
| `VITE_TOSS_PROMOTION_CODE` | 사용자 보상 프로모션 코드 (향후 사용) | 아니오 |

`.env.example`을 `.env`로 복사하고 토스 개발자 콘솔의 값을 채워 넣으세요. 누락된 값은 우아하게 저하됩니다 (기능을 건너뛰고, 오류가 발생하지 않습니다).

## 프로젝트 구조

```
src/
├── pages/              # 화면 컴포넌트 (Home, Insight, Records, History, SettingsForm)
├── components/         # 사전 구축된 UI 블록 (ScreenScaffold, Card, SummaryHero, 등)
├── hooks/              # 커스텀 훅 (useSettings, useRides, useInsightInputs, KpassProvider)
├── lib/                # 비즈니스 로직 및 유틸리티
│   ├── calc/           # 계산 엔진 (환급금, 비교, 위험 상태)
│   ├── dateKeys.ts     # 날짜 키 포맷팅 (YYYY-MM-DD, YYYY-MM)
│   ├── storage.ts      # localStorage 헬퍼
│   ├── analytics.ts    # Toss Analytics 래퍼
│   ├── share.ts        # 공유 기능
│   ├── review.ts       # 앱 스토어 리뷰 요청
│   └── types.ts        # TypeScript 타입 정의
├── __tests__/          # Vitest + Playwright 스펙
└── App.tsx             # 루트 라우터 및 레이아웃

.ai-factory/
├── spec.md             # 전체 기능 명세서 (AC, 계산, 데이터 모델)
├── prd.md              # 제품 요구사항 문서
└── task.md             # 구현 패킷 분류
```

## 주요 기능 설명

### 환급금 계산
이 앱은 세 가지 사용자 유형을 기반으로 K-Pass 환급금을 계산합니다:
- **일반**: 20% 환급 (최대 60회)
- **청소년**: 30% 환급 (최대 60회)
- **저소득**: 53% 환급 (최대 60회)

환급금 공식: `floor(min(rides, 60) × fare × rate / 10) × 10` (10원 단위 반올림)

### 위험 상태
월별 21회 기준까지의 진행 상황을 실시간으로 추적합니다:
- **`not_started`** — 아직 탑승 없음
- **`danger`** — 월말까지 21회에 도달할 남은 날씨가 충분하지 않음
- **`on_track`** — 현재 속도로 월말까지 21회 이상에 도달할 수 있음
- **`warning`** — 속도에 뒤떨어졌으나 여전히 가능함
- **`achieved`** — 이미 21회 이상 탑승

### 정기권 비교
**Insight** 화면에서 사용자가 월정액 가격을 입력하면 다음을 확인할 수 있습니다:
- K-Pass 또는 월정액 중 어느 것이 더 저렴한지
- 금액 차이
- 손익분기점 탑승 횟수 (예: "K-Pass가 손익분기점이 되려면 35회 필요")

프리미엄 분석 (보상 광고 게이트 뒤):
- 3가지 시나리오 (낮음/중간/높음 사용량)
- 6개월 과거 추이
- 계절 패턴

## 데이터 저장

모든 데이터는 브라우저 localStorage에 유지됩니다:
- `kpass_settings` — 사용자 유형, 평균 운임료
- `kpass_rides` — 일일 탑승 횟수 (지난 13개월)
- `kpass_month_index` — 집계된 월별 총합 (성능 최적화)

데이터는 13개월(현재 월 + 지난 12개월)동안 유지됩니다.

## 테스트

### 단위 및 통합 테스트
```bash
npx vitest run
```
테스트 파일: `src/__tests__/packet-*.test.ts`

### 비주얼 회귀 테스트
```bash
npm run test:visual
```
Playwright를 사용하여 `e2e/__shots__/`에 데스크톱 크기 스크린샷을 캡처합니다.

## 배포 및 품질 게이트

1. **TypeScript 검사**: `npx tsc --noEmit` 통과 필수
2. **테스트**: `npx vitest run` 통과 필수
3. **비주얼 스모크**: `npm run test:visual` 스크린샷 캡처, 레이아웃 깨짐 없음 확인
4. **정책 스캔**: `npm run gate` 콘솔 에러, 콘솔 로깅, 외부 링크, 하드코딩된 테스트 키 검사
5. **번들 크기**: 100MB 이하여야 함

빌드 파이프라인 자동 실행:
1. 위의 모든 검사 실행
2. `dist/`로 번들링
3. Toss CDN에 업로드
4. Toss 리뷰 팀에 스토어 등록 승인 알림

## 프로젝트 정보

- **앱 이름**: kpasstracker (토스 콘솔 등록)
- **버전**: 0.1.0
- **라이선스**: MIT
- **최소 OS**: Android 7+ / iOS 16+
- **나이 요구사항**: 19세 이상 (토스 리뷰 정책 기준)

## 라이선스

MIT
