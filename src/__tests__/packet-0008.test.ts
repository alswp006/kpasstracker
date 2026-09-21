/**
 * Packet 0008 — S1 onboarding/settings shared form (SettingsForm)
 *
 * 계약(코더가 맞출 것):
 *  - src/pages/SettingsForm.tsx: default export, props { mode?: 'onboarding' | 'settings' } (기본 onboarding)
 *  - 유형 ListRow 3개(일반·청년·저소득), 선택된 행에 '✓' 표시(ListRow right 슬롯)
 *  - TextField 라벨 "1회 평균 요금" / 설정 모드 전용 "월 정기권 가격"
 *  - 에러 문구는 TextField `help`로 표시(hasError)
 *  - 제출 버튼 SubmitFooter "시작하기" / "저장"
 *  - 저장은 saveSettings(실제 localStorage 'kpass:settings')로, Toast는 TDS Toast 또는 useToast().openToast
 *  - KpassProvider(@/hooks/kpass) 안에서 렌더된다
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, fireEvent, within } from "@testing-library/react";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual<typeof import("react-router-dom")>("react-router-dom")),
  useNavigate: () => mockNavigate,
}));

vi.mock("@apps-in-toss/web-framework", () => ({
  generateHapticFeedback: vi.fn(),
  Analytics: { screen: vi.fn(), impression: vi.fn(), click: vi.fn() },
}));

// TDS 목 — ListRow right 슬롯과 Toast/useToast 를 둘 다 렌더한다
vi.mock("@toss/tds-mobile", () => {
  const R = React;
  const ListRow: any = Object.assign(
    ({ contents, right, children, onClick }: any) =>
      R.createElement("div", { role: "listitem", onClick }, contents, children, right),
    {
      Texts: ({ top, bottom }: any) =>
        R.createElement(R.Fragment, null, R.createElement("span", null, top), R.createElement("span", null, bottom)),
    },
  );
  const Field = R.forwardRef(({ label, help, hasError, suffix, variant, ...props }: any, ref: any) =>
    R.createElement(
      "label",
      null,
      R.createElement("span", null, label),
      R.createElement("input", { ref, ...props }),
      suffix,
      help ? R.createElement("span", { "data-error": hasError ? "true" : undefined }, help) : null,
    ),
  );
  const Btn = ({ children, onClick, disabled, loading, display, variant, ...props }: any) =>
    R.createElement("button", { onClick, disabled: disabled || loading || undefined, ...props }, children);
  return {
    Button: Btn,
    FixedBottomCTA: Btn,
    BottomCTA: Object.assign(Btn, { Double: ({ children }: any) => R.createElement("div", null, children) }),
    ListRow,
    TextField: Field,
    Spacing: () => R.createElement("div"),
    Border: () => R.createElement("hr"),
    Paragraph: { Text: ({ children }: any) => R.createElement("span", null, children) },
    Top: Object.assign(
      ({ title, children }: any) => R.createElement("nav", null, title, children),
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

import SettingsForm from "@/pages/SettingsForm";
import { KpassProvider } from "@/hooks/kpass";
import { saveSettings } from "@/lib/kpassStore";

function renderForm(mode: "onboarding" | "settings") {
  return render(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(KpassProvider, null, React.createElement(SettingsForm, { mode })),
    ),
  );
}

const fare = () => screen.getByLabelText(/1회 평균 요금/) as HTMLInputElement;
const pass = () => screen.getByLabelText(/월 정기권 가격/) as HTMLInputElement;
const stored = () => JSON.parse(localStorage.getItem("kpass:settings") as string);

beforeEach(() => {
  mockNavigate.mockClear();
  document.body.innerHTML = "";
});

describe("S1 onboarding/settings shared form (SettingsForm)", () => {
  it("AC-1[P1]: 첫 렌더 — '일반' 체크, 요금 '', '시작하기' 비활성", () => {
    renderForm("onboarding");
    const row = screen.getByText("일반").closest('[role="listitem"]') as HTMLElement;
    expect(row.textContent).toContain("✓");
    expect(screen.getByText("청년").closest('[role="listitem"]')!.textContent).not.toContain("✓");
    expect(screen.getByText("저소득").closest('[role="listitem"]')!.textContent).not.toContain("✓");
    expect(fare().value).toBe("");
    expect(screen.getByRole("button", { name: "시작하기" })).toBeDisabled();
    expect(screen.queryByLabelText(/월 정기권 가격/)).toBeNull();
  });

  it("AC-1[P1]: 요금 입력 후 시작하기 → 저장하고 홈으로 replace 이동", () => {
    renderForm("onboarding");
    fireEvent.click(screen.getByText("청년"));
    fireEvent.change(fare(), { target: { value: "1500" } });
    const btn = screen.getByRole("button", { name: "시작하기" });
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    const s = stored();
    expect(s.userType).toBe("youth");
    expect(s.avgFare).toBe(1500);
    expect(s.passPrice).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });

  it("AC-2[P0]: 요금 50 제출 → 범위 안내 문구, 저장 안 됨, 이동 없음", () => {
    renderForm("onboarding");
    fireEvent.change(fare(), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: "시작하기" }));
    expect(screen.getByText("100원에서 10,000원 사이로 입력해주세요")).toBeInTheDocument();
    expect(localStorage.getItem("kpass:settings")).toBeNull();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("AC-2[P0]: 요금 12000 도 같은 문구로 거부한다", () => {
    renderForm("onboarding");
    fireEvent.change(fare(), { target: { value: "12000" } });
    fireEvent.click(screen.getByRole("button", { name: "시작하기" }));
    expect(screen.getByText("100원에서 10,000원 사이로 입력해주세요")).toBeInTheDocument();
    expect(localStorage.getItem("kpass:settings")).toBeNull();
  });

  it("AC-3[P0]: 설정 모드 — 정기권 가격 비우고 저장 → passPrice null + Toast + navigate(-1)", () => {
    saveSettings({ userType: "general", avgFare: 1500, passPrice: 55000 });
    renderForm("settings");
    expect(pass().value).toBe("55000");
    expect(fare().value).toBe("1500");
    fireEvent.change(pass(), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(stored().passPrice).toBeNull();
    expect(stored().avgFare).toBe(1500);
    expect(screen.getByText("설정을 저장했어요")).toBeInTheDocument();
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it("AC-3[P0]: 설정 모드 — 정기권 가격 500 은 거부, 저장 안 됨", () => {
    saveSettings({ userType: "general", avgFare: 1500, passPrice: null });
    const before = localStorage.getItem("kpass:settings");
    renderForm("settings");
    fireEvent.change(pass(), { target: { value: "500" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(screen.getByText("1,000원에서 500,000원 사이로 입력해주세요")).toBeInTheDocument();
    expect(localStorage.getItem("kpass:settings")).toBe(before);
    expect(screen.queryByText("설정을 저장했어요")).toBeNull();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("QUOTA: 저장 실패 시 Toast 를 띄우고 이동하지 않는다", () => {
    renderForm("onboarding");
    fireEvent.change(fare(), { target: { value: "1500" } });
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    fireEvent.click(screen.getByRole("button", { name: "시작하기" }));
    spy.mockRestore();
    expect(screen.getByText("저장 공간이 부족해 저장하지 못했어요")).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(fare().value).toBe("1500");
  });
});
