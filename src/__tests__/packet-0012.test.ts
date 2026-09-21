/**
 * Packet 0012 — S4 Insight page (locked tier + reward gate)
 *
 * 계약(코더가 맞출 것):
 *  - src/pages/Insight.tsx: default export, KpassProvider 안에서 렌더. InsightFree는 게이트 바깥,
 *    잠금 층(InsightLocked)만 <TossRewardAd slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}> 안
 *  - 잠금 층: data-testid="locked-tier" 안에
 *      · data-testid="scenario-card" × 3 (일반 / 청년 / 저소득 — 유형별 환급액·실부담)
 *      · data-testid="break-even" (있으면 "월 N회 이상 타면 정기권이 이득이에요",
 *        null이면 "이 가격에서는 K-패스가 항상 유리해요")
 *      · data-testid="trend-sparkline" (Sparkline, 최근 6개월)
 *  - TossRewardAd는 `@/components/TossRewardAd`의 named export `TossRewardAd`
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, within } from "@testing-library/react";

vi.mock("@apps-in-toss/web-framework", () => ({
  generateHapticFeedback: vi.fn(),
  Analytics: { screen: vi.fn(), impression: vi.fn(), click: vi.fn() },
  TossAds: { initialize: { isSupported: () => false }, attachBanner: { isSupported: () => false } },
  loadFullScreenAd: vi.fn(),
  showFullScreenAd: vi.fn(),
  requestReview: vi.fn(),
  share: vi.fn(),
  getTossShareLink: vi.fn(),
  Storage: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() },
}));

vi.mock("@/components/AdSlot", () => ({ AdSlot: () => null, default: () => null }));

// 실제 TossRewardAd(슬롯 ID 없으면 fail-open)를 감싸 DOM 상 게이트 경계를 표시한다.
vi.mock("@/components/TossRewardAd", async () => {
  const actual = await vi.importActual<typeof import("@/components/TossRewardAd")>(
    "@/components/TossRewardAd",
  );
  return {
    ...actual,
    TossRewardAd: (props: React.ComponentProps<typeof actual.TossRewardAd>) =>
      React.createElement(
        "div",
        { "data-testid": "reward-gate", "data-slot-id": props.slotId ?? "" },
        React.createElement(actual.TossRewardAd, props),
      ),
  };
});

vi.mock("@toss/tds-mobile", () => {
  const R = React;
  const Btn = ({ children, onClick, disabled, loading, display, variant, size, color, ...props }: any) =>
    R.createElement("button", { onClick, disabled: disabled || loading || undefined, ...props }, children);
  const ListRow: any = Object.assign(
    ({ contents, right, children, onClick }: any) =>
      R.createElement("div", { role: "listitem", onClick }, contents, children, right),
    {
      Texts: ({ top, bottom }: any) =>
        R.createElement(R.Fragment, null, R.createElement("span", null, top), R.createElement("span", null, bottom)),
    },
  );
  const Txt = ({ children, typography, color, ...p }: any) => R.createElement("span", p, children);
  return {
    Button: Btn,
    IconButton: Btn,
    FixedBottomCTA: Btn,
    BottomCTA: Object.assign(Btn, { Double: ({ children }: any) => R.createElement("div", null, children) }),
    ListRow,
    Spacing: () => R.createElement("div"),
    Border: () => R.createElement("hr"),
    Badge: ({ children }: any) => R.createElement("span", { "data-badge": "1" }, children),
    Skeleton: () => R.createElement("div"),
    Asset: { Icon: () => R.createElement("i"), ContentIcon: () => R.createElement("i") },
    Paragraph: { Text: Txt },
    TextField: ({ label, value, help, onChange, placeholder }: any) =>
      R.createElement(
        "label",
        null,
        label,
        R.createElement("input", { "aria-label": label, value, placeholder, onChange: (e: any) => onChange?.(e) }),
        help ? R.createElement("span", null, help) : null,
      ),
    Top: Object.assign(
      ({ title, right, children }: any) => R.createElement("nav", null, title, right, children),
      { TitleParagraph: ({ children }: any) => R.createElement("h1", null, children) },
    ),
    Toast: ({ open, text }: any) => (open ? R.createElement("div", { role: "status" }, text) : null),
    useToast: () => ({ openToast: vi.fn() }),
  };
});

import Insight from "@/pages/Insight";
import { KpassProvider } from "@/hooks/kpass";
import { saveSettings } from "@/lib/kpassStore";

const NOW = new Date("2026-09-22T12:00:00+09:00");

function seedRides(days: Record<string, number>) {
  const t = NOW.toISOString();
  localStorage.setItem(
    "kpass:rides",
    JSON.stringify({ id: "rides", version: 1, days, createdAt: t, updatedAt: t }),
  );
}

function renderInsight() {
  return render(
    React.createElement(
      MemoryRouter,
      { initialEntries: [{ pathname: "/insight", state: { rideCount: 30 } }] },
      React.createElement(KpassProvider, null, React.createElement(Insight)),
    ),
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.stubEnv("VITE_TOSS_AD_SLOT_ID", "");
  document.body.innerHTML = "";
  // 2개월 이상 기록 → 추이 그래프가 그려진다
  seedRides({ "2026-07-10": 10, "2026-08-05": 20, "2026-09-01": 12 });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("S4 Insight page (locked tier + reward gate)", () => {
  it("AC-1[P0]: 슬롯 ID가 없으면 게이트가 열려 시나리오 3행(일반/청년/저소득)이 값과 함께 보인다", () => {
    saveSettings({ userType: "general", avgFare: 1500, passPrice: 55000 });
    renderInsight();
    const locked = screen.getByTestId("locked-tier");
    const cards = within(locked).getAllByTestId("scenario-card");
    expect(cards).toHaveLength(3);
    expect(cards[0].textContent).toContain("일반");
    expect(cards[0].textContent).toContain("9,000원");
    expect(cards[0].textContent).toContain("36,000원");
    expect(cards[1].textContent).toContain("청년");
    expect(cards[1].textContent).toContain("13,500원");
    expect(cards[1].textContent).toContain("31,500원");
    expect(cards[2].textContent).toContain("저소득");
    expect(cards[2].textContent).toContain("23,850원");
    expect(cards[2].textContent).toContain("21,150원");
  });

  it("AC-1[P0]: 손익분기 '46회'(1500원·일반·55000원)와 6개월 Sparkline이 렌더된다", () => {
    saveSettings({ userType: "general", avgFare: 1500, passPrice: 55000 });
    renderInsight();
    const locked = screen.getByTestId("locked-tier");
    const be = within(locked).getByTestId("break-even");
    expect(be.textContent).toContain("46회");
    expect(be.textContent).toContain("월 46회 이상 타면 정기권이 이득이에요");
    const spark = within(locked).getByTestId("trend-sparkline");
    expect(spark.tagName.toLowerCase()).toBe("svg");
    expect(spark.getAttribute("role")).toBe("img");
  });

  it("AC-2[P0]: breakEven이 null이면(가격 500,000원) '이 가격에서는 K-패스가 항상 유리해요'가 보인다", () => {
    saveSettings({ userType: "general", avgFare: 1500, passPrice: 500000 });
    renderInsight();
    const be = screen.getByTestId("break-even");
    expect(be.textContent).toContain("이 가격에서는 K-패스가 항상 유리해요");
    expect(be.textContent).not.toContain("이상 타면");
  });

  it("AC-2[P1]: breakEven이 있을 때는 '항상 유리해요' 문구가 나오지 않는다", () => {
    saveSettings({ userType: "general", avgFare: 1500, passPrice: 55000 });
    renderInsight();
    expect(screen.queryByText(/이 가격에서는 K-패스가 항상 유리해요/)).toBeNull();
    expect(screen.getByTestId("break-even").textContent).toContain("46회");
  });

  it("AC-3[P0]: InsightFree의 예상 환급액·판정은 게이트 바깥, locked-tier만 게이트 안이다", () => {
    saveSettings({ userType: "general", avgFare: 1500, passPrice: 55000 });
    renderInsight();
    const gate = screen.getByTestId("reward-gate");
    const free = screen.getByTestId("free-tier");
    const refund = screen.getByTestId("insight-refund");
    const verdict = screen.getByTestId("verdict-card");
    expect(gate.contains(free)).toBe(false);
    expect(gate.contains(refund)).toBe(false);
    expect(gate.contains(verdict)).toBe(false);
    expect(refund.textContent).toContain("9,000원");
    expect(verdict.textContent).toContain("K-패스가 월 19,000원 이득이에요");
    expect(gate.contains(screen.getByTestId("locked-tier"))).toBe(true);
    expect(gate.getAttribute("data-slot-id")).toBe("");
  });

  it("AC-3[P1]: 게이트는 화면 전체가 아니라 하나뿐이고 free-tier와 locked-tier가 서로 포함하지 않는다", () => {
    saveSettings({ userType: "general", avgFare: 1500, passPrice: 55000 });
    renderInsight();
    expect(screen.getAllByTestId("reward-gate")).toHaveLength(1);
    expect(screen.getByTestId("free-tier").contains(screen.getByTestId("locked-tier"))).toBe(false);
    expect(screen.getByTestId("locked-tier").contains(screen.getByTestId("free-tier"))).toBe(false);
  });
});
