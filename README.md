🇺🇸 [한국어](./README.ko.md)

# KPassTracker — Korean Transit Pass Analyzer

KPassTracker is a mini-app for the Toss ecosystem that helps Korean transit users track their K-Pass usage, calculate refund eligibility, and compare the financial benefits of K-Pass versus monthly subscription passes.

## Features

- 📊 **Daily Ride Recording** — Log and undo rides with haptic feedback; view monthly totals
- 💰 **Refund Calculation** — Automatically calculate K-Pass refunds based on rides, fare, and user type (general/youth/low-income)
- 🎯 **Risk Status Tracking** — See real-time progress toward the 21-ride refund threshold with intelligent status indicators
- 📈 **Pass Comparison** — Compare K-Pass net cost vs. subscription pass prices; identify break-even points
- 📅 **Monthly Records** — Edit daily ride counts with inline validation and error messages
- 📊 **Usage History** — View and analyze ride trends over the past 12 months
- 🎬 **Reward Gate** — Premium analytics (scenarios, break-even calculations, historical trends) behind an optional ad gate
- 🎨 **Native Experience** — Toss Design System (TDS) components with dark mode support and safe-area handling

## Tech Stack

- **Framework**: React 18 + Vite (CSR, no SSR)
- **UI**: Toss Design System (`@toss/tds-mobile`)
- **Routing**: React Router DOM v7
- **Platform**: Apps-in-Toss mini-app framework
- **Data**: Browser localStorage (no backend)
- **Styling**: CSS-in-JS (Emotion) + TDS theme system
- **Type Safety**: TypeScript 5.8

## Getting Started

### Install dependencies
```bash
npm install
```

### Build for production
```bash
npx vite build
```

Outputs to `dist/`. Run `npm run gate` to verify compliance (type safety, no console errors, policy checks).

### Deploy to Toss mini-app platform
```bash
npx ait build
npx ait deploy --api-key <YOUR_API_KEY>
```

(The Toss developer console completes the review and release flow.)

### Development workflow (reference only)
```bash
npx tsc --noEmit          # TypeScript check
npx vitest run            # Unit tests
npm run test:visual       # Visual smoke tests (Playwright)
```

> **Note:** The dev server (`npm run dev`) cannot be used to verify changes. Use the three commands above instead. The Toss WebView and visual smoke tests provide the only reliable preview.

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `VITE_SHARE_OG_URL` | Share preview image URL (KakaoTalk, SMS) | No |
| `VITE_TOSS_AD_GROUP_ID` | Banner ad group ID (Toss console) | No |
| `VITE_TOSS_AD_SLOT_ID` | Reward/interstitial ad slot ID (Toss console) | No |
| `VITE_TOSS_IAP_SKU` | In-app purchase SKU (future use) | No |
| `VITE_TOSS_PROMOTION_CODE` | User reward promotion code (future use) | No |

Copy `.env.example` to `.env` and fill in values from the Toss developer console. Missing values gracefully degrade (features are skipped, not errored).

## Project Structure

```
src/
├── pages/              # Screen components (Home, Insight, Records, History, SettingsForm)
├── components/         # Pre-built UI blocks (ScreenScaffold, Card, SummaryHero, etc.)
├── hooks/              # Custom hooks (useSettings, useRides, useInsightInputs, KpassProvider)
├── lib/                # Business logic & utilities
│   ├── calc/           # Calculation engines (refund, comparison, risk status)
│   ├── dateKeys.ts     # Date key formatting (YYYY-MM-DD, YYYY-MM)
│   ├── storage.ts      # localStorage helpers
│   ├── analytics.ts    # Toss Analytics wrapper
│   ├── share.ts        # Share functionality
│   ├── review.ts       # App store review request
│   └── types.ts        # TypeScript type definitions
├── __tests__/          # Vitest + Playwright specs
└── App.tsx             # Root router and layout

.ai-factory/
├── spec.md             # Full feature specification (AC, calculations, data model)
├── prd.md              # Product requirements document
└── task.md             # Implementation packet breakdown
```

## Key Features Explained

### Refund Calculation
The app calculates K-Pass refunds based on three user types:
- **General**: 20% refund (max 60 rides)
- **Youth**: 30% refund (max 60 rides)
- **Low-income**: 53% refund (max 60 rides)

Refund formula: `floor(min(rides, 60) × fare × rate / 10) × 10` (10-won rounding)

### Risk Status
Progress toward the 21-ride monthly threshold is tracked in real time:
- **`not_started`** — No rides yet
- **`danger`** — Not enough remaining days to reach 21 rides
- **`on_track`** — Current pace projects to 21+ rides by month end
- **`warning`** — Behind pace but still possible
- **`achieved`** — Already have 21+ rides

### Pass Comparison
On the **Insight** screen, users input a monthly pass price to see:
- Whether K-Pass or monthly pass is cheaper
- Dollar difference
- Break-even ride count (e.g., "need 35 rides for K-Pass to break even")

Premium analysis (behind reward ad gate):
- 3 scenarios (low/medium/high usage)
- 6-month historical trends
- Seasonal patterns

## Data Storage

All data persists in browser localStorage:
- `kpass_settings` — User type, average fare
- `kpass_rides` — Daily ride counts (last 13 months)
- `kpass_month_index` — Aggregated monthly totals (performance optimization)

Data is retained for 13 months (current month + 12 prior months).

## Testing

### Unit & integration tests
```bash
npx vitest run
```
Test files: `src/__tests__/packet-*.test.ts`

### Visual regression tests
```bash
npm run test:visual
```
Captures desktop-size screenshots to `e2e/__shots__/` using Playwright.

## Deployment & Quality Gates

1. **TypeScript check**: `npx tsc --noEmit` must pass
2. **Tests**: `npx vitest run` must pass
3. **Visual smoke**: `npm run test:visual` captures screenshots; verify no broken layouts
4. **Policy scan**: `npm run gate` checks for console errors, console logging, external links, and hardcoded test keys
5. **Bundle size**: Must stay under 100 MB

Build pipeline automatically:
1. Runs all checks above
2. Bundles to `dist/`
3. Uploads to Toss CDN
4. Notifies Toss review team for store listing approval

## Project Information

- **App Name**: kpasstracker (registered on Toss console)
- **Version**: 0.1.0
- **License**: MIT
- **Minimum OS**: Android 7+ / iOS 16+
- **Age Requirement**: 19+ years old (per Toss review policy)

## License

MIT
