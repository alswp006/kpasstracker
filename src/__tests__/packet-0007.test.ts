import { describe, it, expect } from "vitest";
import {
  riskCopy,
  refundCopy,
  typeRateLabel,
  verdictCopy,
  formatWon,
} from "@/lib/kpassCopy";

describe("Copy service: kpassCopy (display text and amount format)", () => {
  // ============================================================================
  // AC-1: riskCopy for (14 rides, 2026-09-22) returns risk card text and badge
  // ============================================================================
  describe("riskCopy", () => {
    it("AC-1 [P0]: should return warning risk copy with correct line1, line2, and badge for 14 rides on 2026-09-22", () => {
      const date = new Date("2026-09-22");
      const result = riskCopy(14, date);

      expect(result.line1).toBe("지금 속도면 19회로 2회 모자라요");
      expect(result.line2).toBe("남은 9일 동안 7회 더 타야 해요");
      expect(result.badge).toBe("주의");
    });

    it("should return danger risk copy when rides = 5 on 2026-09-28", () => {
      const date = new Date("2026-09-28");
      const result = riskCopy(5, date);

      expect(result.line1).toBe("남은 3일 동안 16회를 채우기 어려워요");
      expect(result.badge).toBe("위험");
    });

    it("should return achieved risk copy when rides >= 21", () => {
      const date = new Date("2026-09-10");
      const result = riskCopy(21, date);

      expect(result.line1).toBe("이번 달 환급 조건 21회를 채웠어요");
      expect(result.badge).toBe("달성");
    });

    it("should return on_track risk copy when projection >= 21", () => {
      const date = new Date("2026-09-10");
      const result = riskCopy(12, date);

      expect(result.line1).toBe("지금 속도면 36회로 21회를 넘겨요");
      expect(result.line2).toBe("남은 21일 동안 9회 더 타면 돼요");
      expect(result.badge).toBe("순항");
    });

    it("should return not_started status when rides = 0 and sufficient remaining days", () => {
      const date = new Date("2026-09-02");
      const result = riskCopy(0, date);

      expect(result.line1).toBe("오늘 첫 탑승을 기록해 보세요");
      expect(result.badge).toBe("");
    });
  });

  // ============================================================================
  // AC-2: refundCopy returns correct format for different ride counts
  // ============================================================================
  describe("refundCopy", () => {
    it("AC-2a [P0]: should return progress copy when rides = 14 (1-20 rides)", () => {
      const result = refundCopy(14, 1500, "general");

      expect(result.sub).toBe(
        "21회까지 7회 남았어요 · 달성하면 예상 6,300원부터 받아요"
      );
      expect(result.amount).toBe("0원");
    });

    it("AC-2b [P0]: should return initial state copy when rides = 0", () => {
      const result = refundCopy(0, 1500, "general");

      expect(result.sub).toBe("21회를 채우면 환급이 시작돼요");
      expect(result.amount).toBe("0원");
    });

    it("AC-2c [P0]: should return refund amount when rides >= 21", () => {
      const result = refundCopy(22, 1500, "general");

      expect(result.amount).toBe("6,600원");
      expect(result.sub).toBe("");
    });

    it("should handle youth type with correct rate (30%)", () => {
      const result = refundCopy(14, 1500, "youth");

      // calcRefund(21, 1500, 'youth') = floor(21 * 1500 * 0.30 / 10) * 10 = floor(945) * 10 = 9450
      expect(result.sub).toBe(
        "21회까지 7회 남았어요 · 달성하면 예상 9,450원부터 받아요"
      );
    });

    it("should handle lowIncome type with correct rate (53%)", () => {
      const result = refundCopy(14, 1500, "lowIncome");

      // calcRefund(21, 1500, 'lowIncome') = floor(21 * 1500 * 53 / 1000) * 10 = floor(1669.5) * 10 = 16690
      expect(result.sub).toBe(
        "21회까지 7회 남았어요 · 달성하면 예상 16,690원부터 받아요"
      );
    });

    it("should show no sub text when rides >= 21", () => {
      const result = refundCopy(30, 1500, "general");

      expect(result.sub).toBe("");
      expect(result.amount).not.toBe("0원");
    });

    it("should return correct amount for rides = 60 (cap)", () => {
      const result = refundCopy(60, 1500, "general");

      // calcRefund(60, 1500, 'general') with cap at 60 rides
      // = floor(min(60, 60) * 1500 * 0.20 / 10) * 10
      // = floor(1800) * 10 = 18000
      expect(result.amount).toBe("18,000원");
    });
  });

  // ============================================================================
  // AC-3a: typeRateLabel returns formatted type label with rate
  // ============================================================================
  describe("typeRateLabel", () => {
    it("AC-3a [P0]: should return '일반 20%' for general type", () => {
      const result = typeRateLabel("general");

      expect(result).toBe("일반 20%");
    });

    it("should return '청년 30%' for youth type", () => {
      const result = typeRateLabel("youth");

      expect(result).toBe("청년 30%");
    });

    it("should return '저소득 53%' for lowIncome type", () => {
      const result = typeRateLabel("lowIncome");

      expect(result).toBe("저소득 53%");
    });
  });

  // ============================================================================
  // AC-3b: verdictCopy returns text and badge matching SPEC S4 table exactly
  // ============================================================================
  describe("verdictCopy", () => {
    it("AC-3b [P0]: should return kpass verdict with correct text and badge", () => {
      const result = verdictCopy("kpass", 19000);

      expect(result.text).toBe("K-패스가 월 19,000원 이득이에요");
      expect(result.badge).toBe("K-패스 이득");
    });

    it("should return pass verdict with correct text and badge", () => {
      const result = verdictCopy("pass", 5000);

      expect(result.text).toBe("정기권이 월 5,000원 이득이에요");
      expect(result.badge).toBe("정기권 이득");
    });

    it("should return even verdict with correct text and badge", () => {
      const result = verdictCopy("even", 0);

      expect(result.text).toBe("K-패스와 정기권 비용이 같아요");
      expect(result.badge).toBe("동일");
    });

    it("should format large diff amounts with comma separator in kpass verdict", () => {
      const result = verdictCopy("kpass", 150000);

      expect(result.text).toBe("K-패스가 월 150,000원 이득이에요");
    });

    it("should format large diff amounts with comma separator in pass verdict", () => {
      const result = verdictCopy("pass", 123456);

      expect(result.text).toBe("정기권이 월 123,456원 이득이에요");
    });
  });

  // ============================================================================
  // formatWon: Format amount to KRW currency string
  // ============================================================================
  describe("formatWon", () => {
    it("should format 6,300 as '6,300원'", () => {
      const result = formatWon(6300);

      expect(result).toBe("6,300원");
    });

    it("should format 0 as '0원'", () => {
      const result = formatWon(0);

      expect(result).toBe("0원");
    });

    it("should add comma separators for large amounts", () => {
      const result = formatWon(1234567);

      expect(result).toBe("1,234,567원");
    });

    it("should format 18000 as '18,000원'", () => {
      const result = formatWon(18000);

      expect(result).toBe("18,000원");
    });

    it("should format 150000 as '150,000원'", () => {
      const result = formatWon(150000);

      expect(result).toBe("150,000원");
    });

    it("should format single digit amounts", () => {
      const result = formatWon(5);

      expect(result).toBe("5원");
    });

    it("should format three-digit amounts without comma", () => {
      const result = formatWon(999);

      expect(result).toBe("999원");
    });
  });
});
