import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

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

// ── AC-1: BannerArea ──
describe("BannerArea", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    cleanup();
  });

  it("AC-1[P0]: renders nothing when VITE_TOSS_AD_GROUP_ID is missing", async () => {
    vi.stubEnv("VITE_TOSS_AD_GROUP_ID", "");
    const { BannerArea } = await import("@/components/BannerArea");
    let container!: HTMLElement;
    expect(() => {
      ({ container } = render(React.createElement(BannerArea)));
    }).not.toThrow();
    expect(container.innerHTML).toBe("");
    expect(container.querySelector("[data-ad-group-id]")).toBeNull();
  });

  it("AC-1[P0]: with an ad group ID it renders the AdSlot and survives SDK throwing outside the WebView", async () => {
    vi.stubEnv("VITE_TOSS_AD_GROUP_ID", "group-from-console-123");
    const { BannerArea } = await import("@/components/BannerArea");
    let container!: HTMLElement;
    expect(() => {
      ({ container } = render(React.createElement(BannerArea)));
    }).not.toThrow();
    const slot = container.querySelector("[data-ad-group-id]");
    expect(slot).not.toBeNull();
    expect(slot?.getAttribute("data-ad-group-id")).toBe("group-from-console-123");
  });
});

// ── AC-2: compliance static scan ──
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "__tests__") continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

const SRC = join(process.cwd(), "src");
const files = walk(SRC).filter((f) => !f.endsWith("__TdsGallery.tsx"));
const tsxFiles = files.filter((f) => f.endsWith(".tsx"));

function offenders(list: string[], re: RegExp): string[] {
  return list.filter((f) => re.test(readFileSync(f, "utf8")));
}

describe("compliance static scan (src)", () => {
  it("AC-2[P0]: scan actually covers source files", () => {
    expect(tsxFiles.length).toBeGreaterThan(10);
    expect(tsxFiles.some((f) => f.endsWith("components/BannerArea.tsx"))).toBe(true);
  });

  it("AC-2[P0]: no hardcoded HEX colors in src/**/*.tsx", () => {
    expect(offenders(tsxFiles, /#[0-9a-fA-F]{3,6}\b/)).toEqual([]);
  });

  it("AC-2[P0]: no banned UI libraries or external payment/ad SDK imports", () => {
    const banned = /(?:from\s+|import\s*\(\s*|require\(\s*)['"](?:@mui|antd|stripe|@stripe|[^'"]*admob[^'"]*)/i;
    expect(offenders(files, banned)).toEqual([]);
    expect(offenders(files, /from\s+['"](?:@react-oauth|firebase\/auth|kakao|react-ga|@amplitude)/i)).toEqual([]);
  });

  it("AC-2[P1]: no install-prompt copy or '취소' button copy", () => {
    expect(offenders(tsxFiles, /앱\s*설치|설치하기|앱을?\s*설치|다운로드\s*받/)).toEqual([]);
    expect(offenders(tsxFiles, />\s*취소\s*</)).toEqual([]);
  });
});

// ── AC-3: smoke — onboarding → home +1 ──
describe("smoke: onboarding → home", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 8, 22, 12, 0, 0));
  });
  afterEach(() => cleanup());

  it("AC-3[P0]: onboarding submit lands on home; +1 tap shows 오늘 1회 and stores days['2026-09-22']===1", async () => {
    const { default: App } = await import("@/App");
    render(React.createElement(MemoryRouter, { initialEntries: ["/onboarding"] }, React.createElement(App)));

    fireEvent.change(screen.getByLabelText("1회 평균 요금"), { target: { value: "1500" } });
    fireEvent.click(screen.getByText("시작하기"));

    const settings = JSON.parse(localStorage.getItem("kpass:settings") ?? "null");
    expect(settings.avgFare).toBe(1500);
    expect(settings.userType).toBe("general");

    expect(screen.getByTestId("today-count").textContent).toBe("오늘 0회");
    fireEvent.click(screen.getByTestId("record-button"));

    expect(screen.getByTestId("today-count").textContent).toBe("오늘 1회");
    const rides = JSON.parse(localStorage.getItem("kpass:rides") ?? "null");
    expect(rides.days["2026-09-22"]).toBe(1);
  });

  it("AC-3[P0]: without onboarding, the home route never records (redirects to /onboarding)", async () => {
    const { default: App } = await import("@/App");
    render(React.createElement(MemoryRouter, { initialEntries: ["/"] }, React.createElement(App)));
    expect(screen.queryByTestId("record-button")).toBeNull();
    expect(localStorage.getItem("kpass:rides")).toBeNull();
  });
});
