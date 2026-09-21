import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import App from "@/App";

// SDK는 WebView 밖에서 throw한다 — 실제 환경과 같은 조건으로 전체 여정을 돈다
vi.mock("@apps-in-toss/web-framework", () => {
  const unsupported = () => {
    throw new Error("not in WebView");
  };
  const attachBanner = Object.assign(unsupported, { isSupported: unsupported });
  const initialize = Object.assign(unsupported, { isSupported: unsupported });
  return {
    generateHapticFeedback: vi.fn(),
    Analytics: { screen: vi.fn(), impression: vi.fn(), click: vi.fn() },
    TossAds: { attachBanner, initialize },
  };
});

vi.mock("@toss/tds-mobile", () => {
  const h = React.createElement;
  const Pass = ({ children }: any) => h("div", null, children);
  const Text = ({ children, typography, ...p }: any) => h("span", p, children);
  return {
    Button: ({ children, onClick, display, variant, size, ...p }: any) => h("button", { onClick, ...p }, children),
    FixedBottomCTA: ({ children, onClick, disabled, loading, ...p }: any) =>
      h("button", { onClick, disabled: disabled || loading || undefined, ...p }, children),
    ListRow: Object.assign(
      ({ contents, right, onClick }: any) => h("div", { role: "listitem", onClick }, contents, right),
      { Texts: ({ top, bottom }: any) => h("span", null, top, bottom) },
    ),
    Spacing: () => null,
    Paragraph: { Text },
    Badge: Pass,
    Skeleton: () => h("div"),
    Toast: ({ open, text }: any) => (open ? h("div", { role: "status" }, text) : null),
    useToast: () => ({ openToast: vi.fn() }),
    Top: Object.assign(({ title }: any) => h("nav", null, title), { TitleParagraph: Pass }),
    TextField: ({ label, help, hasError, variant, suffix, enterKeyHint, ...p }: any) =>
      h("div", null, h("label", null, label), h("input", { "aria-label": label, ...p })),
    Asset: { Icon: () => null, ContentIcon: () => null },
  };
});

function Where() {
  return React.createElement("div", { "data-testid": "where" }, useLocation().pathname);
}

function renderAt(path: string) {
  return render(
    React.createElement(MemoryRouter, { initialEntries: [path] }, React.createElement(App), React.createElement(Where)),
  );
}

describe("smoke: onboarding → home → +1", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 8, 22, 12, 0, 0));
    vi.stubEnv("VITE_TOSS_AD_GROUP_ID", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    cleanup();
  });

  it("onboarding submit saves settings and lands on home", () => {
    renderAt("/onboarding");
    fireEvent.change(screen.getByLabelText("1회 평균 요금"), { target: { value: "1500" } });
    fireEvent.click(screen.getByText("시작하기"));

    expect(screen.getByTestId("where").textContent).toBe("/");
    const settings = JSON.parse(localStorage.getItem("kpass:settings") ?? "null");
    expect(settings).toMatchObject({ userType: "general", avgFare: 1500 });
    expect(screen.getByTestId("today-count").textContent).toBe("오늘 0회");
  });

  it("+1 on home records today as days['2026-09-22'] === 1", () => {
    renderAt("/onboarding");
    fireEvent.change(screen.getByLabelText("1회 평균 요금"), { target: { value: "1500" } });
    fireEvent.click(screen.getByText("시작하기"));
    fireEvent.click(screen.getByTestId("record-button"));

    expect(screen.getByTestId("today-count").textContent).toBe("오늘 1회");
    const rides = JSON.parse(localStorage.getItem("kpass:rides") ?? "null");
    expect(rides.days["2026-09-22"]).toBe(1);
  });

  it("home without settings redirects to onboarding and records nothing", () => {
    renderAt("/");
    expect(screen.getByTestId("where").textContent).toBe("/onboarding");
    expect(screen.queryByTestId("record-button")).toBeNull();
    expect(localStorage.getItem("kpass:rides")).toBeNull();
  });

  it("home renders with the banner ID set even though the ad SDK throws", () => {
    vi.stubEnv("VITE_TOSS_AD_GROUP_ID", "group-from-console-123");
    renderAt("/onboarding");
    fireEvent.change(screen.getByLabelText("1회 평균 요금"), { target: { value: "1500" } });
    fireEvent.click(screen.getByText("시작하기"));
    expect(screen.getByTestId("record-button")).toBeInTheDocument();
    expect(document.querySelector("[data-ad-group-id]")).not.toBeNull();
  });
});
