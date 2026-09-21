# KPassTracker

앱인토스 (Vite + React + TDS) 이번 달 대중교통 몇 번 탔지? K-패스 환급 조건(월 21회) 채우는 중인지 매일 확인 K-패스는 월 21회 이상 대중교통을 이용해야 환급을 받는다. 지금 몇 회인지, 이번 달 예상 환급액이 얼마인지 알려면 카드사 앱을 따로 열어야 하고, 회차가 모자란 달은 미리 알기 어렵다.

## Tech Stack

- React 18.0.0
- TypeScript
- Vitest

## Routes

| Path | Description |
|------|-------------|
| `/History` | History |
| `/Home` | Home |
| `/Insight` | Insight |
| `/Records` | Records |
| `/SettingsForm` | SettingsForm |

## Getting Started

```bash
pnpm install
pnpm dev
```

## Development

```bash
pnpm typecheck    # Type checking
pnpm test         # Run tests
pnpm build        # Production build
```

## Design Documents

See `.ai-factory/` directory for full design artifacts:
- `prd.md` — Product Requirements Document
- `spec.md` — Technical Specification
- `task.md` — Epic/Task Breakdown

---
Built with [AI Factory](https://github.com/alswp006/ai-factory) · Last synced: 2026-09-21
