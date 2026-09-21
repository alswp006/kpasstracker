import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { KpassProvider } from "@/hooks/kpass";
import History from "@/pages/History";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual<typeof import("react-router-dom")>("react-router-dom")),
  useNavigate: () => mockNavigate,
}));
vi.mock("@apps-in-toss/web-framework", () => ({
  generateHapticFeedback: vi.fn(),
  Analytics: { screen: vi.fn(), impression: vi.fn(), click: vi.fn() },
}));
vi.mock("@toss/tds-mobile", () => {
  const h = React.createElement;
  const Pass = ({ children }: any) => h("div", null, children);
  const Btn = ({ children, onClick, ...p }: any) => h("button", { onClick, ...p }, children);
  const ListRow = Object.assign(
    ({ contents, right, children, ...p }: any) =>
      h("div", { role: "listitem", "data-testid": p["data-testid"] }, contents, children, right),
    {
      Texts: ({ top, bottom }: any) => h("div", null, h("span", null, top), h("span", null, bottom)),
      Text: Pass,
    },
  );
  return {
    Button: Btn,
    IconButton: Btn,
    FixedBottomCTA: Btn,
    ListRow,
    Spacing: () => null,
    Badge: Pass,
    Border: () => null,
    Top: Object.assign(({ title }: any) => h("div", null, title), { TitleParagraph: Pass }),
    Paragraph: { Text: Pass },
    Asset: { Icon: () => null, ContentIcon: () => null },
  };
});

const iso = "2026-09-01T00:00:00.000Z";
function monthDays(month: string, n: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (let d = 1; d <= n; d++) out[`${month}-${String(d).padStart(2, "0")}`] = 1;
  return out;
}
function seed(opts: { userType: "general" | "youth"; days: Record<string, number>; snapshots?: Record<string, unknown> }) {
  localStorage.setItem(
    "kpass:settings",
    JSON.stringify({ id: "settings", version: 1, userType: opts.userType, avgFare: 1500, passPrice: null, createdAt: iso, updatedAt: iso }),
  );
  localStorage.setItem("kpass:rides", JSON.stringify({ id: "rides", version: 1, days: opts.days, createdAt: iso, updatedAt: iso }));
  if (opts.snapshots) {
    localStorage.setItem(
      "kpass:monthMeta",
      JSON.stringify({ id: "monthMeta", version: 1, months: opts.snapshots, createdAt: iso, updatedAt: iso }),
    );
  }
}
const augSnapshot = {
  "2026-08": { id: "2026-08", userType: "general", avgFare: 1500, createdAt: iso, updatedAt: iso },
};
const renderPage = () =>
  render(
    React.createElement(
      MemoryRouter,
      { initialEntries: ["/history"] },
      React.createElement(KpassProvider, null, React.createElement(History)),
    ),
  );
/** 라벨 텍스트를 가진 요소에서 위로 올라가며 금액 텍스트까지 포함하는 가장 가까운 행 컨테이너 */
function rowTextOf(label: string): string {
  let el: HTMLElement | null = screen.getByText(label);
  while (el && !/원/.test(el.textContent ?? "")) el = el.parentElement;
  return el?.textContent ?? "";
}

describe("[부가] S5 past refund records (/history)", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 8, 22, 12, 0, 0));
  });
  afterEach(() => vi.useRealTimers());

  it("AC-1: 8월 22회 + 일반 1500 스냅샷이면 '2026년 8월' 행에 '6,600원'이 보인다", () => {
    seed({ userType: "general", days: { ...monthDays("2026-08", 22), "2026-09-03": 2 }, snapshots: augSnapshot });
    renderPage();
    const text = rowTextOf("2026년 8월");
    expect(text).toContain("6,600원");
    expect(text).toContain("2026년 8월");
  });

  it("AC-1: 이번 달(2026년 9월)은 목록에서 제외된다", () => {
    seed({ userType: "general", days: { ...monthDays("2026-08", 22), "2026-09-03": 2 }, snapshots: augSnapshot });
    renderPage();
    expect(screen.queryByText("2026년 9월")).toBeNull();
    expect(screen.getByText("2026년 8월")).toBeTruthy();
  });

  it("AC-2: 설정이 청년으로 바뀌어도 스냅샷이 있는 8월은 6,600원을 유지한다", () => {
    seed({ userType: "youth", days: monthDays("2026-08", 22), snapshots: augSnapshot });
    renderPage();
    const text = rowTextOf("2026년 8월");
    expect(text).toContain("6,600원");
    expect(text).not.toContain("9,900원");
  });

  it("AC-2: 스냅샷이 없는 7월은 현재 설정(청년 1500 → 21회 9,450원)으로 계산한다", () => {
    seed({ userType: "youth", days: { ...monthDays("2026-07", 21), ...monthDays("2026-08", 22) }, snapshots: augSnapshot });
    renderPage();
    expect(rowTextOf("2026년 7월")).toContain("9,450원");
    expect(rowTextOf("2026년 8월")).toContain("6,600원");
  });

  it("AC-3: 지난 기록이 없으면 빈 상태와 '홈으로 가기' 버튼이 보이고 월 행은 없다", () => {
    seed({ userType: "general", days: { "2026-09-03": 2 } });
    renderPage();
    const btn = screen.getByRole("button", { name: "홈으로 가기" });
    expect(btn.textContent).toBe("홈으로 가기");
    expect(screen.queryByText(/^\d{4}년 \d{1,2}월$/)).toBeNull();
    expect(screen.queryByText(/\d[\d,]*원/)).toBeNull();
  });

  it("AC-3: '홈으로 가기'를 누르면 '/'로 이동한다", () => {
    seed({ userType: "general", days: {} });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "홈으로 가기" }));
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate.mock.calls[0][0]).toBe("/");
  });
});
