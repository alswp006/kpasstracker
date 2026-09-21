import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import App from "@/App";

const mockHaptic = vi.fn();
vi.mock("@apps-in-toss/web-framework", () => ({
  generateHapticFeedback: (...a: unknown[]) => mockHaptic(...a),
  Analytics: { screen: vi.fn(), impression: vi.fn(), click: vi.fn() },
}));
vi.mock("@toss/tds-mobile", () => {
  const h = React.createElement;
  const Pass = ({ children }: any) => h("div", null, children);
  return {
    Button: ({ children, onClick }: any) => h("button", { onClick }, children),
    Spacing: () => null,
    Top: ({ title }: any) => h("div", null, title),
    Paragraph: { Text: Pass },
    Asset: { Icon: () => null, ContentIcon: () => null },
  };
});

// 화면은 스텁 — 이 패킷은 라우팅·가드·탭바 배선만 본다
vi.mock("@/pages/Home", () => ({ default: () => React.createElement("div", { "data-testid": "page-home" }) }));
vi.mock("@/pages/SettingsForm", () => ({
  default: ({ mode }: any) => React.createElement("div", { "data-testid": "page-settings", "data-mode": mode ?? "onboarding" }),
}));
vi.mock("@/pages/Insight", () => ({ default: () => React.createElement("div", { "data-testid": "page-insight" }) }));
vi.mock("@/pages/Records", () => ({ default: () => React.createElement("div", { "data-testid": "page-records" }) }));
vi.mock("@/pages/History", () => ({ default: () => React.createElement("div", { "data-testid": "page-history" }) }));

function seedSettings() {
  const now = "2026-09-22T00:00:00.000Z";
  localStorage.setItem(
    "kpass:settings",
    JSON.stringify({
      id: "settings",
      version: 1,
      userType: "general",
      avgFare: 1500,
      passPrice: null,
      createdAt: now,
      updatedAt: now,
    }),
  );
}

function Where() {
  const loc = useLocation();
  return React.createElement("div", { "data-testid": "where" }, loc.pathname);
}

function renderAt(path: string) {
  return render(
    React.createElement(MemoryRouter, { initialEntries: [path] }, React.createElement(App), React.createElement(Where)),
  );
}

describe("Routing, settings guard, Provider, FloatingTabBar wiring (App.tsx)", () => {
  beforeEach(() => {
    mockHaptic.mockClear();
  });

  it("AC-1[P0]: no settings → / redirects to /onboarding", () => {
    renderAt("/");
    expect(screen.getByTestId("where").textContent).toBe("/onboarding");
    expect(screen.getByTestId("page-settings").getAttribute("data-mode")).toBe("onboarding");
    expect(screen.queryByTestId("page-home")).toBeNull();
  });

  it("AC-1[P0]: no settings → guarded routes (/insight, /records, /history) also go to /onboarding", () => {
    for (const path of ["/insight", "/records", "/history"]) {
      const { unmount } = renderAt(path);
      expect(screen.getByTestId("where").textContent).toBe("/onboarding");
      expect(screen.queryByTestId("page-" + path.slice(1))).toBeNull();
      unmount();
    }
  });

  it("AC-1[P0]: with settings → / renders Home and stays on /", () => {
    seedSettings();
    renderAt("/");
    expect(screen.getByTestId("where").textContent).toBe("/");
    expect(screen.getByTestId("page-home")).toBeTruthy();
  });

  it("AC-2[P0]: /unknown renders Home at /", () => {
    seedSettings();
    renderAt("/unknown");
    expect(screen.getByTestId("where").textContent).toBe("/");
    expect(screen.getByTestId("page-home")).toBeTruthy();
  });

  it("AC-2[P0]: /unknown without settings ends on /onboarding", () => {
    renderAt("/unknown");
    expect(screen.getByTestId("where").textContent).toBe("/onboarding");
    expect(screen.getByTestId("page-settings")).toBeTruthy();
  });

  it("AC-3[P0]: FloatingTabBar shows 홈/분석/지난 기록 on /insight", () => {
    seedSettings();
    renderAt("/insight");
    expect(screen.getByTestId("page-insight")).toBeTruthy();
    expect(screen.getByRole("tablist")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "홈" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "분석" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "지난 기록" })).toBeTruthy();
  });

  it("AC-3[P0]: FloatingTabBar shows on / and /history", () => {
    seedSettings();
    const a = renderAt("/");
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    a.unmount();
    renderAt("/history");
    expect(screen.getAllByRole("tab")).toHaveLength(3);
  });

  it("AC-3[P0]: FloatingTabBar is absent on /records and /settings", () => {
    seedSettings();
    const a = renderAt("/records");
    expect(screen.getByTestId("page-records")).toBeTruthy();
    expect(screen.queryByRole("tablist")).toBeNull();
    a.unmount();
    renderAt("/settings");
    expect(screen.getByTestId("page-settings").getAttribute("data-mode")).toBe("settings");
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("AC-3: switching tabs navigates and fires tickWeak haptic", () => {
    seedSettings();
    renderAt("/insight");
    fireEvent.click(screen.getByRole("tab", { name: "지난 기록" }));
    expect(screen.getByTestId("where").textContent).toBe("/history");
    expect(screen.getByTestId("page-history")).toBeTruthy();
    expect(mockHaptic).toHaveBeenCalledWith({ type: "tickWeak" });
  });
});
