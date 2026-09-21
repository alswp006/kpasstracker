import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockAll } from "@/__tests__/__helpers__/mocks";
import { HomeCards } from "@/components/home/HomeCards";
import { riskCopy, refundCopy, typeRateLabel } from "@/lib/kpassCopy";
import type { UserSettings } from "@/lib/types";

mockAll();

const settings: UserSettings = {
  id: "settings",
  version: 1,
  userType: "general",
  avgFare: 1500,
  passPrice: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};
const today = new Date(2026, 8, 22);

function renderCards(count: number) {
  return render(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(HomeCards, { count, settings, today }),
    ),
  );
}

describe("S2 home cards (progress, risk, refund)", () => {
  it("AC-1[P0]: count=14 on 2026-09-22 shows risk line1 and '주의' badge", () => {
    const copy = riskCopy(14, today);
    expect(copy.line1).toBe("지금 속도면 19회로 2회 모자라요");
    expect(copy.badge).toBe("주의");

    renderCards(14);
    expect(screen.getByText("지금 속도면 19회로 2회 모자라요")).toBeInTheDocument();
    expect(screen.getByText("주의")).toBeInTheDocument();
  });

  it("AC-1[P0]: risk line2 is rendered from riskCopy", () => {
    const { line2 } = riskCopy(14, today);
    expect(line2).not.toBe("");
    renderCards(14);
    expect(screen.getByText(line2)).toBeInTheDocument();
    expect(screen.queryByText("순항")).toBeNull();
  });

  it("AC-2[P0]: count=22 refund card shows '6,600원'", () => {
    expect(refundCopy(22, 1500, "general").amount).toBe("6,600원");
    renderCards(22);
    expect(screen.getByText("6,600원")).toBeInTheDocument();
    expect(screen.getByText(typeRateLabel("general"))).toBeInTheDocument();
  });

  it("AC-3[P0]: count=0 shows no risk badge and refund sub '21회를 채우면 환급이 시작돼요'", () => {
    renderCards(0);
    expect(screen.getByText("21회를 채우면 환급이 시작돼요")).toBeInTheDocument();
    for (const b of ["주의", "위험", "순항", "달성"]) {
      expect(screen.queryByText(b)).toBeNull();
    }
    expect(screen.getByText("오늘 첫 탑승을 기록해 보세요")).toBeInTheDocument();
  });

  it("progress hero: shows count out of 21 rides", () => {
    renderCards(14);
    expect(document.body.textContent).toContain("21");
    expect(screen.getByText(typeRateLabel("general"))).toBeInTheDocument();
  });
});
