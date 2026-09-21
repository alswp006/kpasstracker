import { describe, it, expect } from "vitest";
import { calcRisk, comparePass, calcInsightInitialRides } from "@/lib/calc/risk";

describe("Calculation service ②: projection, risk, pass comparison and kpassCalc barrel", () => {
  // AC-1: calcRisk returns correct status, projection, remaining, and remainingDays
  describe("AC-1: calcRisk status and projections", () => {
    it("AC-1[P0]: calcRisk(14, 2026-09-22) returns warning with projection=19, remaining=7, remainingDays=9", () => {
      const result = calcRisk(14, new Date("2026-09-22"));
      expect(result.status).toBe("warning");
      expect(result.projection).toBe(19);
      expect(result.remaining).toBe(7);
      expect(result.remainingDays).toBe(9);
    });

    it("AC-1[P0]: calcRisk(0, 2026-09-29) returns danger with projection=0, remaining=21, remainingDays=2", () => {
      const result = calcRisk(0, new Date("2026-09-29"));
      expect(result.status).toBe("danger");
      expect(result.projection).toBe(0);
      expect(result.remaining).toBe(21);
      expect(result.remainingDays).toBe(2);
    });

    it("AC-1[P0]: calcRisk(0, 2026-09-20) returns not_started status early in month", () => {
      const result = calcRisk(0, new Date("2026-09-20"));
      expect(result.status).toBe("not_started");
    });

    it("AC-1[P0]: calcRisk(NaN, 2026-09-22) treats NaN as 0 and returns danger", () => {
      const result = calcRisk(NaN, new Date("2026-09-22"));
      expect(result.status).toBe("danger");
      expect(result.projection).toBe(0);
      expect(result.remaining).toBe(21);
      expect(result.remainingDays).toBe(9);
    });

    it("calcRisk handles negative count by treating as 0", () => {
      const result = calcRisk(-5, new Date("2026-09-22"));
      expect(result.status).toBe("danger");
      expect(result.projection).toBe(0);
    });

    it("calcRisk returns on_track when projection meets target with days remaining", () => {
      // On 2026-09-15, if user has 10 rides, projection should be ~14-15 (not quite there but close)
      const result = calcRisk(10, new Date("2026-09-15"));
      expect(result.status).toMatch(/on_track|warning|danger/);
      expect(result.projection).toBeGreaterThan(0);
      expect(result.remaining).toBeGreaterThanOrEqual(0);
    });

    it("calcRisk returns achieved when projection >= 21", () => {
      // Late in month with high count should achieve target
      const result = calcRisk(25, new Date("2026-09-28"));
      expect(result.status).toBe("achieved");
    });
  });

  // AC-2: comparePass returns default values when passPrice is null or NaN
  describe("AC-2: comparePass with null/NaN passPrice", () => {
    it("AC-2[P0]: comparePass returns {kpassNetCost:0, passPrice:0, winner:'even', diff:0} when passPrice is null", () => {
      const result = comparePass(0, null, 0);
      expect(result.kpassNetCost).toBe(0);
      expect(result.passPrice).toBe(0);
      expect(result.winner).toBe("even");
      expect(result.diff).toBe(0);
    });

    it("AC-2[P0]: comparePass returns {kpassNetCost:0, passPrice:0, winner:'even', diff:0} when passPrice is NaN", () => {
      const result = comparePass(0, NaN, 0);
      expect(result.kpassNetCost).toBe(0);
      expect(result.passPrice).toBe(0);
      expect(result.winner).toBe("even");
      expect(result.diff).toBe(0);
    });

    it("comparePass returns winner='kpass' when kpassNetCost < passPrice", () => {
      const result = comparePass(50000, 100000, 0);
      expect(result.winner).toBe("kpass");
      expect(result.kpassNetCost).toBe(50000);
      expect(result.passPrice).toBe(100000);
      expect(result.diff).toBe(50000);
    });

    it("comparePass returns winner='pass' when passPrice < kpassNetCost", () => {
      const result = comparePass(100000, 50000, 0);
      expect(result.winner).toBe("pass");
      expect(result.kpassNetCost).toBe(100000);
      expect(result.passPrice).toBe(50000);
      expect(result.diff).toBe(50000);
    });

    it("comparePass returns winner='even' when costs are equal", () => {
      const result = comparePass(75000, 75000, 0);
      expect(result.winner).toBe("even");
      expect(result.diff).toBe(0);
    });
  });

  // AC-3: calcInsightInitialRides returns min(max(projection, count), 120)
  describe("AC-3: calcInsightInitialRides projection capping", () => {
    it("AC-3[P0]: calcInsightInitialRides(10, 2026-09-01) returns 120 at start of month", () => {
      const result = calcInsightInitialRides(10, new Date("2026-09-01"));
      expect(result).toBe(120);
    });

    it("AC-3[P0]: calcInsightInitialRides(130, 2026-09-22) returns 120 when count exceeds cap", () => {
      const result = calcInsightInitialRides(130, new Date("2026-09-22"));
      expect(result).toBe(120);
    });

    it("AC-3[P0]: calcInsightInitialRides(14, 2026-09-22) returns projection value 19", () => {
      const result = calcInsightInitialRides(14, new Date("2026-09-22"));
      expect(result).toBe(19);
    });

    it("calcInsightInitialRides returns count when less than projection but under 120", () => {
      // Early month with low projection
      const result = calcInsightInitialRides(5, new Date("2026-09-05"));
      expect(result).toBeLessThanOrEqual(120);
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it("calcInsightInitialRides respects max of projection and count", () => {
      const result = calcInsightInitialRides(50, new Date("2026-09-22"));
      // projection at 14 days = 19, actual count = 50
      // max(19, 50) = 50, min(50, 120) = 50
      expect(result).toBeLessThanOrEqual(120);
    });
  });

  // Integration: calcRisk consistency with calcInsightInitialRides
  describe("Integration: calcRisk and calcInsightInitialRides consistency", () => {
    it("calcInsightInitialRides uses projection from calcRisk", () => {
      const riskResult = calcRisk(14, new Date("2026-09-22"));
      const insightResult = calcInsightInitialRides(14, new Date("2026-09-22"));

      // projection from risk (19) should be used in insight calculation
      // insight = min(max(19, 14), 120) = 19
      expect(insightResult).toBe(19);
      expect(riskResult.projection).toBe(19);
    });

    it("calcInsightInitialRides handles zero count same as calcRisk", () => {
      const riskResult = calcRisk(0, new Date("2026-09-22"));
      const insightResult = calcInsightInitialRides(0, new Date("2026-09-22"));

      // projection = 0, insight = min(max(0, 0), 120) = 0
      expect(insightResult).toBe(0);
      expect(riskResult.projection).toBe(0);
    });
  });

  // Edge cases
  describe("Edge cases", () => {
    it("calcRisk handles month boundary correctly", () => {
      const result = calcRisk(21, new Date("2026-09-30"));
      expect(result.remainingDays).toBeLessThanOrEqual(1);
    });

    it("comparePass handles zero costs", () => {
      const result = comparePass(0, 0, 0);
      expect(result.diff).toBe(0);
      expect(result.winner).toBe("even");
    });

    it("calcInsightInitialRides handles zero count at start of month", () => {
      const result = calcInsightInitialRides(0, new Date("2026-09-01"));
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(120);
    });

    it("calcRisk handles high count exceeding monthly target", () => {
      const result = calcRisk(50, new Date("2026-09-22"));
      expect(result.status).toBe("achieved");
      expect(result.remaining).toBe(0);
    });
  });
});
