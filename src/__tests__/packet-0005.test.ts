import { describe, it, expect } from "vitest";
import { calcRefund, calcKpassNetCost, calcBreakEven } from "@/lib/calc/refund";

describe("Calculation service ①: refund, net cost and break-even [packet 0005]", () => {
  // AC-1: calcRefund returns specific values using formula floor(min(rides,60)×fare×rate/10)×10
  it("AC-1[P0]: calcRefund — five specific test cases with different categories and thresholds", () => {
    expect(calcRefund(22, 1500, "general")).toBe(6600);
    expect(calcRefund(30, 1500, "youth")).toBe(13500);
    expect(calcRefund(21, 1500, "lowIncome")).toBe(16690);
    expect(calcRefund(20, 1500, "lowIncome")).toBe(0); // below 21-ride threshold
    expect(calcRefund(75, 1500, "general")).toBe(18000); // capped at 60 rides
  });

  // AC-2: calcBreakEven returns specific values or null when limit exceeded
  it("AC-2[P0]: calcBreakEven — 46 rides to break even at 55000 cost, null at 500000 cost", () => {
    expect(calcBreakEven(1500, "general", 55000)).toBe(46);
    expect(calcBreakEven(1500, "general", 500000)).toBeNull();
  });

  // AC-3: Invalid inputs return 0 or null, never throw exceptions
  it("AC-3[P0]: calcRefund handles NaN, Infinity, negative, string, invalid type without throwing", () => {
    expect(() => calcRefund(NaN, 1500, "general")).not.toThrow();
    expect(calcRefund(NaN, 1500, "general")).toBe(0);

    expect(() => calcRefund(Infinity, 1500, "general")).not.toThrow();
    expect(calcRefund(Infinity, 1500, "general")).toBe(0);

    expect(() => calcRefund(-5, 1500, "general")).not.toThrow();
    expect(calcRefund(-5, 1500, "general")).toBe(0);

    expect(() => calcRefund("22" as any, 1500, "general")).not.toThrow();
    expect(calcRefund("22" as any, 1500, "general")).toBe(0);

    expect(() => calcRefund(22, 1500, "invalid" as any)).not.toThrow();
    expect(calcRefund(22, 1500, "invalid" as any)).toBe(0);
  });

  it("AC-3[P0]: calcBreakEven handles NaN, Infinity, negative, invalid category without throwing", () => {
    expect(() => calcBreakEven(NaN, "general", 55000)).not.toThrow();
    expect(calcBreakEven(NaN, "general", 55000)).toBeNull();

    expect(() => calcBreakEven(Infinity, "general", 55000)).not.toThrow();
    expect(calcBreakEven(Infinity, "general", 55000)).toBeNull();

    expect(() => calcBreakEven(1500, "invalid" as any, 55000)).not.toThrow();
    expect(calcBreakEven(1500, "invalid" as any, 55000)).toBeNull();

    expect(() => calcBreakEven(1500, "general", -5000)).not.toThrow();
    expect(calcBreakEven(1500, "general", -5000)).toBeNull();
  });

  it("AC-3[P0]: calcKpassNetCost handles invalid inputs returning 0, never throws", () => {
    expect(() => calcKpassNetCost(NaN, "general", 55000)).not.toThrow();
    expect(calcKpassNetCost(NaN, "general", 55000)).toBe(0);

    expect(() => calcKpassNetCost(-1500, "general", -5000)).not.toThrow();
    expect(calcKpassNetCost(-1500, "general", -5000)).toBe(0);

    expect(() => calcKpassNetCost(1500, "invalid" as any, 55000)).not.toThrow();
    expect(calcKpassNetCost(1500, "invalid" as any, 55000)).toBe(0);
  });

  // Edge case: rides cap at 60 verified by comparing 61+ to 60
  it("Boundary: rides capped at 60 — 61 rides gives same result as 60 rides", () => {
    const result60 = calcRefund(60, 1500, "general");
    const result61 = calcRefund(61, 1500, "general");
    expect(result61).toBe(result60);
    expect(result60).toBeGreaterThan(0);
  });
});
