/**
 * Packet 0010 — S2 Home page (one-tap record + navigation)
 *
 * 계약(코더가 맞출 것):
 *  - src/pages/Home.tsx: default export, KpassProvider(@/hooks/kpass) 안에서 렌더된다
 *  - 기록 버튼 "+1 탔어요"(data-testid="record-button"), 되돌리기 "−1"(data-testid="undo-button")
 *  - 오늘 횟수 data-testid="today-count" 텍스트 "오늘 N회", 이번 달 누적 data-testid="month-count" 텍스트 "N"
 *  - "정기권과 비교하기" 버튼 → navigate('/insight', { state: { rideCount: calcInsightInitialRides(count, today) } })
 *  - 실패 Toast 는 이유별 문구(DAILY_MAX → "하루 최대 20회까지 기록할 수 있어요"), TDS Toast 또는 useToast().openToast
 *  - 상한 실패 시 generateHapticFeedback({ type: 'tickStrong' })
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, fireEvent } from "@testing-library/react";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual<typeof import("react-router-dom")>("react-router-dom")),
  useNavigate: () => mockNavigate,
}));

const mockHaptic = vi.fn();
vi.mock("@apps-in-toss/web-framework", () => ({
  generateHapticFeedback: (...a: unknown[]) => mockHaptic(...a),
  Analytics: { screen: vi.fn(), impression: vi.fn(), click: vi.fn() },
  TossAds: { initialize: { isSupported: () => false }, attachBanner: { isSupported: () => false } },
}));

vi.mock("@/components/AdSlot", () => ({ AdSlot: () => null, default: () => null }));

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
    Top: Object.assign(
      ({ title, right, children }: any) => R.createElement("nav", null, title, right, children),
      { TitleParagraph: ({ children }: any) => R.createElement("h1", null, children) },
    ),
    Toast: ({ open, text }: any) => (open ? R.createElement("div", { role: "status" }, text) : null),
    useToast: () => ({
      openToast: (msg: string) => {
        const el = document.createElement("div");
        el.setAttribute("role", "status");
        el.textContent = msg;
        document.body.appendChild(el);
      },
    }),
  };
});

import Home from "@/pages/Home";
import { KpassProvider } from "@/hooks/kpass";
import { saveSettings } from "@/lib/kpassStore";
import { calcInsightInitialRides } from "@/lib/calc/risk";

const NOW = new Date("2026-09-22T12:00:00+09:00");
const TODAY = "2026-09-22";

function seedRides(days: Record<string, number>) {
  const t = NOW.toISOString();
  localStorage.setItem(
    "kpass:rides",
    JSON.stringify({ id: "rides", version: 1, days, createdAt: t, updatedAt: t }),
  );
}

function renderHome() {
  return render(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(KpassProvider, null, React.createElement(Home)),
    ),
  );
}

const days = () => JSON.parse(localStorage.getItem("kpass:rides") as string).days as Record<string, number>;
const todayCount = () => screen.getByTestId("today-count").textContent;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  mockNavigate.mockClear();
  mockHaptic.mockClear();
  document.body.innerHTML = "";
  saveSettings({ userType: "general", avgFare: 1500, passPrice: null });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("S2 Home page (one-tap record + navigation)", () => {
  it("AC-1[P0]: '+1 탔어요' 탭 → 오늘·이번 달 횟수가 1 늘고 days[오늘]이 1 증가해 저장된다", () => {
    seedRides({ "2026-09-01": 12, [TODAY]: 1 });
    renderHome();
    expect(todayCount()).toBe("오늘 1회");
    expect(screen.getByTestId("month-count").textContent).toContain("13");
    fireEvent.click(screen.getByRole("button", { name: /\+1 탔어요/ }));
    expect(todayCount()).toBe("오늘 2회");
    expect(screen.getByTestId("month-count").textContent).toContain("14");
    expect(days()[TODAY]).toBe(2);
    expect(days()["2026-09-01"]).toBe(12);
  });

  it("AC-1[P0]: 기록이 없는 날 첫 탭 → days[오늘] = 1 로 새로 생긴다", () => {
    renderHome();
    expect(todayCount()).toBe("오늘 0회");
    fireEvent.click(screen.getByRole("button", { name: /\+1 탔어요/ }));
    expect(todayCount()).toBe("오늘 1회");
    expect(days()[TODAY]).toBe(1);
  });

  it("AC-1[P1]: −1 탭 → 오늘 횟수와 저장값이 1 줄어든다", () => {
    seedRides({ [TODAY]: 3 });
    renderHome();
    fireEvent.click(screen.getByTestId("undo-button"));
    expect(todayCount()).toBe("오늘 2회");
    expect(days()[TODAY]).toBe(2);
  });

  it("AC-2[P0]: 오늘 20회에서 +1 → DAILY_MAX Toast, 횟수 유지, tickStrong 햅틱", () => {
    seedRides({ [TODAY]: 20 });
    const before = localStorage.getItem("kpass:rides");
    renderHome();
    fireEvent.click(screen.getByRole("button", { name: /\+1 탔어요/ }));
    expect(screen.getByText("하루 최대 20회까지 기록할 수 있어요")).toBeInTheDocument();
    expect(todayCount()).toBe("오늘 20회");
    expect(days()[TODAY]).toBe(20);
    expect(localStorage.getItem("kpass:rides")).toBe(before);
    expect(mockHaptic).toHaveBeenCalledWith({ type: "tickStrong" });
  });

  it("AC-2[P0]: QUOTA 실패 → 이유별 Toast, 수치 유지", () => {
    seedRides({ [TODAY]: 2 });
    renderHome();
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    fireEvent.click(screen.getByRole("button", { name: /\+1 탔어요/ }));
    spy.mockRestore();
    expect(screen.getByText("저장 공간이 부족해 기록하지 못했어요")).toBeInTheDocument();
    expect(todayCount()).toBe("오늘 2회");
    expect(days()[TODAY]).toBe(2);
  });

  it("AC-3[P0]: '정기권과 비교하기' → /insight, state.rideCount = calcInsightInitialRides(count, today)", () => {
    seedRides({ "2026-09-01": 9, "2026-09-10": 5 });
    renderHome();
    fireEvent.click(screen.getByRole("button", { name: /정기권과 비교하기/ }));
    const expected = calcInsightInitialRides(14, NOW);
    expect(expected).toBe(19);
    expect(mockNavigate).toHaveBeenCalledWith("/insight", { state: { rideCount: expected } });
  });

  it("AC-3[P0]: 기록이 0회여도 rideCount 는 calcInsightInitialRides(0, today) 값이다", () => {
    renderHome();
    fireEvent.click(screen.getByRole("button", { name: /정기권과 비교하기/ }));
    expect(mockNavigate).toHaveBeenCalledWith("/insight", {
      state: { rideCount: calcInsightInitialRides(0, NOW) },
    });
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it("네비게이션: '이번 달 기록' 행 → /records", () => {
    renderHome();
    fireEvent.click(screen.getByText("이번 달 기록"));
    expect(mockNavigate).toHaveBeenCalledWith("/records");
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });
});
