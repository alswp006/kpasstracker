import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { KpassProvider } from "@/hooks/kpass";
import Records from "@/pages/Records";

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
    Toast: ({ open, text }: any) => (open ? h("div", { role: "status", "data-testid": "records-toast" }, text) : null),
    Asset: { Icon: () => null, ContentIcon: () => null },
  };
});

const iso = "2026-09-01T00:00:00.000Z";
function seed(days: Record<string, number>) {
  localStorage.setItem(
    "kpass:settings",
    JSON.stringify({ id: "settings", version: 1, userType: "general", avgFare: 1500, passPrice: null, createdAt: iso, updatedAt: iso }),
  );
  localStorage.setItem("kpass:rides", JSON.stringify({ id: "rides", version: 1, days, createdAt: iso, updatedAt: iso }));
}
const renderPage = () =>
  render(
    React.createElement(
      MemoryRouter,
      { initialEntries: ["/records"] },
      React.createElement(KpassProvider, null, React.createElement(Records)),
    ),
  );
const storedDays = () => JSON.parse(localStorage.getItem("kpass:rides") ?? "{}").days as Record<string, number>;

describe("[부가] S3 this month's records edit screen (/records)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 8, 22, 12, 0, 0));
  });
  afterEach(() => vi.useRealTimers());

  it("AC-1: 9월 1일~22일 22개 행이 렌더되고 첫 행은 '9월 22일 (화)'", () => {
    seed({});
    renderPage();
    const rows = screen.getAllByTestId("day-row");
    expect(rows).toHaveLength(22);
    expect(within(rows[0]).getByText("9월 22일 (화)")).toBeTruthy();
    expect(within(rows[21]).getByText("9월 1일 (화)")).toBeTruthy();
  });

  it("AC-1: 상단 월 합계가 MonthIndex 합계를 보여준다", () => {
    seed({ "2026-09-22": 3, "2026-09-10": 4, "2026-08-31": 9 });
    renderPage();
    expect(screen.getByTestId("month-total").textContent).toMatch(/7/);
    expect(screen.getByTestId("month-total").textContent).not.toMatch(/16/);
  });

  it("AC-2: 20회 행에서 +를 누르면 DAILY_MAX 토스트가 뜨고 값은 20 유지", () => {
    seed({ "2026-09-20": 20 });
    renderPage();
    expect(screen.queryByTestId("records-toast")).toBeNull();
    fireEvent.click(screen.getByTestId("day-plus-2026-09-20"));
    const toast = screen.getByTestId("records-toast");
    expect(toast.textContent?.length).toBeGreaterThan(0);
    expect(storedDays()["2026-09-20"]).toBe(20);
    expect(screen.getByTestId("day-count-2026-09-20").textContent).toContain("20");
  });

  it("AC-2: 정상 범위에서 +는 저장소 값을 1 올리고 토스트가 없다", () => {
    seed({ "2026-09-20": 5 });
    renderPage();
    fireEvent.click(screen.getByTestId("day-plus-2026-09-20"));
    expect(storedDays()["2026-09-20"]).toBe(6);
    expect(screen.queryByTestId("records-toast")).toBeNull();
  });

  it("AC-3: 1회 행에서 -를 누르면 days에서 날짜 키가 삭제되고 상단 합계가 1 줄어든다", () => {
    seed({ "2026-09-10": 1, "2026-09-11": 2 });
    renderPage();
    expect(screen.getByTestId("month-total").textContent).toMatch(/3/);
    fireEvent.click(screen.getByTestId("day-minus-2026-09-10"));
    expect(Object.keys(storedDays())).not.toContain("2026-09-10");
    expect(storedDays()["2026-09-11"]).toBe(2);
    expect(screen.getByTestId("month-total").textContent).toMatch(/2/);
    expect(screen.getByTestId("month-total").textContent).not.toMatch(/3/);
  });

  it("AC-3: 0회 행에서 -를 눌러도 저장소에 음수가 생기지 않는다", () => {
    seed({ "2026-09-11": 2 });
    renderPage();
    fireEvent.click(screen.getByTestId("day-minus-2026-09-05"));
    expect(storedDays()).toEqual({ "2026-09-11": 2 });
    expect(screen.getByTestId("day-count-2026-09-05").textContent).toContain("0");
  });
});
