/**
 * Packet 0011 — S4 insight ① input-state hook and free tier
 *
 * 계약(코더가 맞출 것):
 *  - useInsightInputs(): { rideCount: string; passPrice: string; setRideCount(v: string): void; setPassPrice(v: string): void }
 *    · 입력칸 문자열 상태. rideCount 초기값 = 검증된 location.state.rideCount(숫자, 0~120 clamp),
 *      아니면 String(calcInsightInitialRides(이번 달 횟수, new Date())).
 *    · passPrice 초기값 = useSettings().settings.passPrice (null이면 "").
 *    · 이번 달 횟수는 useRides().monthIndex.byMonth["YYYY-MM"] 에서 읽는다.
 *  - <InsightFree /> (props 없음): useInsightInputs + useSettings 를 내부에서 사용.
 *    · 텍스트 입력 2개(순서: 탑승 횟수, 정기권 가격), data-testid="free-tier" 안에 "이번 달 예상 환급액".
 *    · 탑승 횟수가 0~120 밖이면 help "0회에서 120회 사이로 입력해주세요" 표시 + verdict-card 미표시.
 *    · 정기권 가격이 null/빈 값이면 verdict-card 대신 "정기권 가격을 넣으면 어느 쪽이 이득인지 알려드려요".
 *    · 두 입력이 모두 유효할 때만 comparePass(@/lib/calc/risk) 호출.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, renderHook, screen, fireEvent, within } from "@testing-library/react";
import { mockAll } from "@/__tests__/__helpers__/mocks";

mockAll();

const h = vi.hoisted(() => ({
  settings: { current: null as any },
}));

vi.mock("@/hooks/kpass", () => ({
  useSettings: () => ({ settings: h.settings.current, save: vi.fn(() => ({ ok: true })) }),
  useRides: () => ({
    rides: null,
    days: { "2026-09-10": 14 },
    todayCount: 0,
    monthIndex: { byMonth: { "2026-09": 14 }, monthsDesc: ["2026-09"] },
    increment: vi.fn(),
    decrement: vi.fn(),
    setDay: vi.fn(),
  }),
  useMonthMeta: () => ({ monthMeta: null }),
}));

vi.mock("@/lib/calc/risk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/calc/risk")>();
  return { ...actual, comparePass: vi.fn(actual.comparePass) };
});

import { calcInsightInitialRides, comparePass } from "@/lib/calc/risk";
import { useInsightInputs } from "@/hooks/useInsightInputs";
import { InsightFree } from "@/components/insight/InsightFree";

const TODAY = new Date(2026, 8, 22);

function settingsWith(passPrice: number | null) {
  return {
    id: "settings",
    version: 1,
    userType: "general",
    avgFare: 1500,
    passPrice,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

function wrapperWith(state: unknown) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      MemoryRouter,
      { initialEntries: [{ pathname: "/insight", state }] },
      children,
    );
}

function renderFree(state: unknown) {
  return render(React.createElement(InsightFree), { wrapper: wrapperWith(state) });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TODAY);
  h.settings.current = settingsWith(55000);
  vi.mocked(comparePass).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("S4 insight ① input-state hook and free tier", () => {
  it("AC-1[P0]: state {rideCount:'abc'} falls back to calcInsightInitialRides(count, today)", () => {
    const expected = calcInsightInitialRides(14, TODAY);
    expect(expected).toBe(19);
    const { result } = renderHook(() => useInsightInputs(), {
      wrapper: wrapperWith({ rideCount: "abc" }),
    });
    expect(result.current.rideCount).toBe("19");
    expect(result.current.passPrice).toBe("55000");
  });

  it("AC-1[P0]: valid state rideCount wins, and out-of-range value is clamped to 120", () => {
    const ok = renderHook(() => useInsightInputs(), { wrapper: wrapperWith({ rideCount: 30 }) });
    expect(ok.result.current.rideCount).toBe("30");

    const big = renderHook(() => useInsightInputs(), { wrapper: wrapperWith({ rideCount: 500 }) });
    expect(big.result.current.rideCount).toBe("120");

    const none = renderHook(() => useInsightInputs(), { wrapper: wrapperWith(null) });
    expect(none.result.current.rideCount).toBe("19");
  });

  it("AC-1[P1]: pass price input starts empty when settings.passPrice is null", () => {
    h.settings.current = settingsWith(null);
    const { result } = renderHook(() => useInsightInputs(), { wrapper: wrapperWith(null) });
    expect(result.current.passPrice).toBe("");
    expect(result.current.rideCount).toBe("19");
  });

  it("AC-2[P0]: ride count 121 shows error help and hides the verdict", () => {
    renderFree({ rideCount: 30 });
    expect(screen.getByTestId("verdict-card")).toHaveTextContent("K-패스가 월 19,000원 이득이에요");
    vi.mocked(comparePass).mockClear();

    const [rideInput] = screen.getAllByRole("textbox");
    fireEvent.change(rideInput, { target: { value: "121" } });

    expect(screen.getByText("0회에서 120회 사이로 입력해주세요")).toBeInTheDocument();
    expect(screen.queryByTestId("verdict-card")).toBeNull();
    expect(comparePass).toHaveBeenCalledTimes(0);
  });

  it("AC-2[P0]: pass price null shows the price prompt and never calls comparePass", () => {
    h.settings.current = settingsWith(null);
    renderFree({ rideCount: 30 });

    expect(
      screen.getByText("정기권 가격을 넣으면 어느 쪽이 이득인지 알려드려요"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("verdict-card")).toBeNull();
    expect(comparePass).toHaveBeenCalledTimes(0);
    const free = screen.getByTestId("free-tier");
    expect(free).toHaveTextContent("이번 달 예상 환급액");
    expect(free.textContent).toMatch(/9,000/);
  });

  it("AC-3[P0]: valid input with diff=0 shows the '동일' verdict and Badge", () => {
    h.settings.current = settingsWith(36000);
    renderFree({ rideCount: 30 });

    const card = screen.getByTestId("verdict-card");
    expect(within(card).getByText("K-패스와 정기권 비용이 같아요")).toBeInTheDocument();
    expect(within(card).getByRole("status")).toHaveTextContent("동일");
    expect(comparePass).toHaveBeenCalledWith(36000, 36000, expect.anything());
    expect(screen.queryByText("정기권 가격을 넣으면 어느 쪽이 이득인지 알려드려요")).toBeNull();
  });

  it("AC-3[P1]: free tier shows refund and the kpass-wins verdict for 30 rides / 55,000원", () => {
    renderFree({ rideCount: 30 });
    const free = screen.getByTestId("free-tier");
    expect(free).toHaveTextContent("이번 달 예상 환급액");
    expect(free.textContent).toMatch(/9,000/);
    expect(within(screen.getByTestId("verdict-card")).getByRole("status")).toHaveTextContent(
      "K-패스 이득",
    );
    expect(comparePass).toHaveBeenCalledTimes(1);
  });
});
