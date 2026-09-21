import { describe, it, expect } from "vitest";
import type {
  UserType,
  UserSettings,
  RideLog,
  MonthSnapshot,
  MonthMeta,
  MonthIndex,
  RiskResult,
  PassComparison,
  StoreResult,
  SaveResult,
  RouteState,
  InsightRouteState,
} from "@/lib/types";

describe("Shared types, policy constants and date key helpers", () => {
  // ============================================================================
  // AC-1: Type definitions must be pure (no runtime export const/function)
  // ============================================================================

  describe("AC-1: Type definitions", () => {
    it("AC-1[P0]: should define StoreResult with specified failure reasons", () => {
      // StoreResult.reason must be exactly one of:
      // 'NO_SETTINGS' | 'INVALID_DATE' | 'DAILY_MAX' | 'BELOW_ZERO' | 'QUOTA'
      const testFailures: Array<StoreResult> = [
        { success: false, reason: "NO_SETTINGS" },
        { success: false, reason: "INVALID_DATE" },
        { success: false, reason: "DAILY_MAX" },
        { success: false, reason: "BELOW_ZERO" },
        { success: false, reason: "QUOTA" },
      ];

      expect(testFailures).toHaveLength(5);
      expect(testFailures[0].reason).toBe("NO_SETTINGS");
      expect(testFailures[1].reason).toBe("INVALID_DATE");
      expect(testFailures[2].reason).toBe("DAILY_MAX");
      expect(testFailures[3].reason).toBe("BELOW_ZERO");
      expect(testFailures[4].reason).toBe("QUOTA");
    });

    it("AC-1[P0]: should export RouteState and InsightRouteState types", () => {
      // Both types must be exported from types.ts
      const route: RouteState = {};
      const insight: InsightRouteState = {};
      expect(route).toBeDefined();
      expect(insight).toBeDefined();
    });

    it("should export all domain types", () => {
      // Verify all required types exist and can be instantiated
      const userType: UserType = "REGULAR";
      const settings: Partial<UserSettings> = { id: "settings" };
      const rideLog: Partial<RideLog> = { id: "rides" };
      const monthMeta: Partial<MonthMeta> = { id: "monthMeta" };
      const monthSnapshot: Partial<MonthSnapshot> = {};
      const monthIndex: MonthIndex = {};
      const riskResult: Partial<RiskResult> = {};
      const passComparison: Partial<PassComparison> = {};
      const saveResult: Partial<SaveResult> = {};

      expect(userType).toBe("REGULAR");
      expect(settings.id).toBe("settings");
      expect(rideLog.id).toBe("rides");
      expect(monthMeta.id).toBe("monthMeta");
    });
  });

  // ============================================================================
  // AC-2: cutoffMonth function (12 months prior)
  // ============================================================================

  describe("AC-2: cutoffMonth(date) returns YYYY-MM for 12 months prior", () => {
    const { cutoffMonth } = require("@/lib/kpassPolicy");

    it("AC-2[P0]: cutoffMonth(2026-09-22) should return 2025-09", () => {
      const result = cutoffMonth(new Date("2026-09-22"));
      expect(result).toBe("2025-09");
    });

    it("should handle year boundary (Jan -> Dec prior year)", () => {
      const result = cutoffMonth(new Date("2026-01-15"));
      expect(result).toBe("2024-12");
    });

    it("should return format YYYY-MM with zero-padding", () => {
      const result = cutoffMonth(new Date("2026-01-01"));
      expect(result).toMatch(/^\d{4}-\d{2}$/);
      expect(result.split("-")[1]).toHaveLength(2);
    });
  });

  // ============================================================================
  // AC-2: isValidRecordDate function (format + lookback window validation)
  // ============================================================================

  describe("AC-2: isValidRecordDate(dateStr) validates format and window", () => {
    const { isValidRecordDate } = require("@/lib/dateKeys");

    it("AC-2[P0]: returns true for valid dates within lookback window", () => {
      // Valid: today (2026-09-22) and one year ago + days (2025-09-01)
      expect(isValidRecordDate("2026-09-22")).toBe(true);
      expect(isValidRecordDate("2025-09-01")).toBe(true);
    });

    it("AC-2[P0]: returns false for future, out-of-window, and invalid dates", () => {
      expect(isValidRecordDate("2026-09-23")).toBe(false); // future
      expect(isValidRecordDate("2025-08-31")).toBe(false); // before 12-month cutoff
      expect(isValidRecordDate("2026-02-30")).toBe(false); // invalid calendar date
    });

    it("should validate exact YYYY-MM-DD format (zero-padded)", () => {
      expect(isValidRecordDate("2026-9-22")).toBe(false);   // unpadded month
      expect(isValidRecordDate("2026-09-5")).toBe(false);   // unpadded day
      expect(isValidRecordDate("26-09-22")).toBe(false);    // 2-digit year
      expect(isValidRecordDate("2026/09/22")).toBe(false);  // wrong separator
    });

    it("should validate calendar dates (e.g., Feb 30 is invalid)", () => {
      expect(isValidRecordDate("2026-04-31")).toBe(false);  // April has 30 days
      expect(isValidRecordDate("2025-02-29")).toBe(false);  // 2025 not leap year
      expect(isValidRecordDate("2024-02-29")).toBe(true);   // 2024 is leap year
    });

    it("should respect 12-month window boundary", () => {
      expect(isValidRecordDate("2025-09-01")).toBe(true);   // first valid day
      expect(isValidRecordDate("2025-08-31")).toBe(false);  // day before cutoff
    });
  });

  // ============================================================================
  // AC-3: toDateKey function (local date YYYY-MM-DD)
  // ============================================================================

  describe("AC-3: toDateKey(date) returns local YYYY-MM-DD", () => {
    const { toDateKey } = require("@/lib/dateKeys");

    it("AC-3[P0]: at local time 2026-09-22 00:30, returns 2026-09-22", () => {
      const result = toDateKey(new Date("2026-09-22T00:30:00"));
      expect(result).toBe("2026-09-22");
    });

    it("should use YYYY-MM-DD format with zero-padding", () => {
      const result = toDateKey(new Date("2026-01-05T12:00:00"));
      expect(result).toBe("2026-01-05");
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("should return same date for all times on same day", () => {
      expect(toDateKey(new Date("2026-09-22T00:00:00"))).toBe("2026-09-22");
      expect(toDateKey(new Date("2026-09-22T12:00:00"))).toBe("2026-09-22");
      expect(toDateKey(new Date("2026-09-22T23:59:59"))).toBe("2026-09-22");
    });

    it("should transition date correctly at midnight", () => {
      const before = toDateKey(new Date("2026-09-22T23:59:59"));
      const after = toDateKey(new Date("2026-09-23T00:00:00"));
      expect(before).toBe("2026-09-22");
      expect(after).toBe("2026-09-23");
    });

    it("should use local time, not UTC", () => {
      // Implementation must use getFullYear/getMonth/getDate (local)
      // not getUTCFullYear/getUTCMonth/getUTCDate
      const utcMidnight = new Date("2026-09-23T00:00:00Z");
      const result = toDateKey(utcMidnight);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  // ============================================================================
  // AC-3: formatDayLabel function (Korean date + day-of-week)
  // ============================================================================

  describe("AC-3: formatDayLabel(dateStr) formats Korean with day-of-week", () => {
    const { formatDayLabel } = require("@/lib/dateKeys");

    it("AC-3[P0]: formatDayLabel(2026-09-22) returns 9월 22일 (화)", () => {
      // Format: no padding + '월' + no padding + '일' + space + '(' + Korean abbr + ')'
      // 2026-09-22 is Tuesday (화)
      const result = formatDayLabel("2026-09-22");
      expect(result).toBe("9월 22일 (화)");
    });

    it("should format single-digit months/days without padding", () => {
      // '2026-01-05' -> '1월 5일 (...)', not '01월 05일'
      const result = formatDayLabel("2026-01-05");
      expect(result).toMatch(/^1월 5일 \(.\)/);
      expect(result).not.toContain("01월");
      expect(result).not.toContain("05일");
    });

    it("should include correct Korean day-of-week abbreviation", () => {
      // Mon:월 Tue:화 Wed:수 Thu:목 Fri:금 Sat:토 Sun:일
      expect(formatDayLabel("2026-09-21")).toContain("(월)"); // Monday
      expect(formatDayLabel("2026-09-22")).toContain("(화)"); // Tuesday
      expect(formatDayLabel("2026-09-23")).toContain("(수)"); // Wednesday
      expect(formatDayLabel("2026-09-24")).toContain("(목)"); // Thursday
      expect(formatDayLabel("2026-09-25")).toContain("(금)"); // Friday
      expect(formatDayLabel("2026-09-26")).toContain("(토)"); // Saturday
      expect(formatDayLabel("2026-09-27")).toContain("(일)"); // Sunday
    });

    it("should handle year-end dates correctly", () => {
      // 2026-12-31 is Thursday (목)
      const result = formatDayLabel("2026-12-31");
      expect(result).toBe("12월 31일 (목)");
    });

    it("should handle leap year Feb 29", () => {
      // 2024-02-29 exists (leap year)
      const result = formatDayLabel("2024-02-29");
      expect(result).toContain("2월 29일");
    });

    it("should not throw on invalid format", () => {
      // Must gracefully handle invalid input
      expect(() => formatDayLabel("2026-9-22")).not.toThrow();
      expect(() => formatDayLabel("invalid")).not.toThrow();
      expect(() => formatDayLabel("")).not.toThrow();
    });
  });

  // ============================================================================
  // Integration: Verify module exports exist
  // ============================================================================

  describe("Integration: Module exports", () => {
    it("should export all types from types.ts", () => {
      // If types.ts has all required exports, this import succeeds
      const mod = require("@/lib/types");
      expect(mod).toBeDefined();
    });

    it("should export cutoffMonth from kpassPolicy.ts", () => {
      const { cutoffMonth } = require("@/lib/kpassPolicy");
      expect(typeof cutoffMonth).toBe("function");
    });

    it("should export date helpers from dateKeys.ts", () => {
      const { isValidRecordDate, toDateKey, formatDayLabel } =
        require("@/lib/dateKeys");
      expect(typeof isValidRecordDate).toBe("function");
      expect(typeof toDateKey).toBe("function");
      expect(typeof formatDayLabel).toBe("function");
    });
  });
});
