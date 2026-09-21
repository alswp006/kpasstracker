# Sprint Contract — Routing, Settings Guard, Provider, FloatingTabBar Wiring

## Deliverables

| File | Changes |
|------|---------|
| `src/App.tsx` | Wrap with KpassProvider; define Routes (/, /onboarding, /insight, /history, /records, /* → /); wrap in RequireSettings; conditional FloatingTabBar on /, /insight, /history |
| `src/components/RequireSettings.tsx` | Guard: if no UserSettings in AppState, `navigate('/onboarding', { replace: true })` |
| `src/__tests__/App.test.tsx` | AC: RequireSettings redirects when no settings; AC: FloatingTabBar shows on tab routes only; AC: tab switch triggers tickWeak haptic |

## Types (import from `@/lib/types`)
- `UserSettings` — detect existence in AppState
- Tab route list: `['/', '/insight', '/history']` (hardcoded)

## Validation
- `npx tsc --noEmit` — zero errors
- `npx vitest run` — all tests pass
- `npm run test:visual` — no white screen, FloatingTabBar visible on /, /insight, /history only

## CRITICAL — Do NOT
- Modify `src/main.tsx` (@AI:ANCHOR)
- Modify `src/lib/types.ts` (use as-is)
- Use `window.location` or `window.open` (use `navigate()`)
- Hardcode HEX colors (use TDS theme)
