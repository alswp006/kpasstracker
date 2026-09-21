/**
 * TDD Tests for Storage Loaders (packet-0002)
 *
 * Tests for loadSettings, loadRides, loadMonthMeta, and buildMonthIndex
 * These tests SHOULD FAIL until the implementation is complete.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type {
  UserSettings,
  RideLog,
  MonthMeta,
  MonthSnapshot,
  MonthIndex,
} from "@/lib/types";

// ============================================================================
// AC-1: loadSettings(date) handles corrupt JSON gracefully
// ============================================================================

describe("loadSettings()", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("AC-1[P0]: returns null when kpass:settings contains corrupt JSON", () => {
    // Arrange: Store invalid JSON directly
    localStorage.setItem("kpass:settings", "{invalid json}{{{");

    // Mock setItem to verify it's not called during load
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    // Act
    const loadSettings = require("@/lib/storage/loaders").loadSettings;
    const result = loadSettings(new Date());

    // Assert
    expect(result).toBeNull();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem("kpass:settings")).toBe("{invalid json}{{{");

    setItemSpy.mockRestore();
  });

  it("AC-1[P0]: returns null when kpass:settings does not exist", () => {
    // Arrange: settings key is absent
    expect(localStorage.getItem("kpass:settings")).toBeNull();

    // Act
    const loadSettings = require("@/lib/storage/loaders").loadSettings;
    const result = loadSettings(new Date());

    // Assert
    expect(result).toBeNull();
  });

  it("should return valid UserSettings when JSON is correct", () => {
    // Arrange: Store valid settings JSON
    const validSettings: UserSettings = {
      id: "settings",
      version: 1,
      userType: "general",
      avgFare: 2500,
      passPrice: 65000,
      createdAt: "2026-09-22T10:00:00Z",
      updatedAt: "2026-09-22T10:00:00Z",
    };
    localStorage.setItem("kpass:settings", JSON.stringify(validSettings));

    // Act
    const loadSettings = require("@/lib/storage/loaders").loadSettings;
    const result = loadSettings(new Date());

    // Assert
    expect(result).toEqual(validSettings);
    expect(result?.userType).toBe("general");
    expect(result?.avgFare).toBe(2500);
  });

  it("should handle empty string gracefully", () => {
    // Arrange
    localStorage.setItem("kpass:settings", "");

    // Act
    const loadSettings = require("@/lib/storage/loaders").loadSettings;
    const result = loadSettings(new Date());

    // Assert
    expect(result).toBeNull();
  });

  it("should handle null value in passPrice field", () => {
    // Arrange
    const settingsWithNullPass: UserSettings = {
      id: "settings",
      version: 1,
      userType: "youth",
      avgFare: 1250,
      passPrice: null,
      createdAt: "2026-09-22T10:00:00Z",
      updatedAt: "2026-09-22T10:00:00Z",
    };
    localStorage.setItem("kpass:settings", JSON.stringify(settingsWithNullPass));

    // Act
    const loadSettings = require("@/lib/storage/loaders").loadSettings;
    const result = loadSettings(new Date());

    // Assert
    expect(result).toEqual(settingsWithNullPass);
    expect(result?.passPrice).toBeNull();
  });
});

// ============================================================================
// loadRides() - load ride log from localStorage
// ============================================================================

describe("loadRides()", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should return null when kpass:rides does not exist", () => {
    // Act
    const loadRides = require("@/lib/storage/loaders").loadRides;
    const result = loadRides(new Date());

    // Assert
    expect(result).toBeNull();
  });

  it("should return valid RideLog when JSON is correct", () => {
    // Arrange
    const validRideLog: RideLog = {
      id: "rides",
      version: 1,
      days: {
        "2026-09-22": 2,
        "2026-09-21": 1,
        "2026-09-20": 3,
      },
      createdAt: "2026-09-20T10:00:00Z",
      updatedAt: "2026-09-22T15:30:00Z",
    };
    localStorage.setItem("kpass:rides", JSON.stringify(validRideLog));

    // Act
    const loadRides = require("@/lib/storage/loaders").loadRides;
    const result = loadRides(new Date());

    // Assert
    expect(result).toEqual(validRideLog);
    expect(result?.days["2026-09-22"]).toBe(2);
    expect(Object.keys(result?.days ?? {})).toHaveLength(3);
  });

  it("should return null when kpass:rides contains corrupt JSON", () => {
    // Arrange
    localStorage.setItem("kpass:rides", "not valid json at all");

    // Act
    const loadRides = require("@/lib/storage/loaders").loadRides;
    const result = loadRides(new Date());

    // Assert
    expect(result).toBeNull();
  });

  it("should handle empty days object", () => {
    // Arrange
    const rideLogWithEmptyDays: RideLog = {
      id: "rides",
      version: 1,
      days: {},
      createdAt: "2026-09-22T10:00:00Z",
      updatedAt: "2026-09-22T10:00:00Z",
    };
    localStorage.setItem("kpass:rides", JSON.stringify(rideLogWithEmptyDays));

    // Act
    const loadRides = require("@/lib/storage/loaders").loadRides;
    const result = loadRides(new Date());

    // Assert
    expect(result).toEqual(rideLogWithEmptyDays);
    expect(Object.keys(result?.days ?? {})).toHaveLength(0);
  });
});

// ============================================================================
// AC-2: loadMonthMeta() overwrites snapshot id with month key
// ============================================================================

describe("loadMonthMeta()", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("AC-2[P0]: returns snapshot with id overwritten to month key when months['2026-08'] exists", () => {
    // Arrange: Store monthMeta with a snapshot
    const monthMeta: MonthMeta = {
      id: "monthMeta",
      version: 1,
      months: {
        "2026-08": {
          id: "original-id-x",
          userType: "general",
          avgFare: 2500,
          createdAt: "2026-08-01T10:00:00Z",
          updatedAt: "2026-08-31T18:00:00Z",
        },
      },
      createdAt: "2026-08-01T10:00:00Z",
      updatedAt: "2026-08-31T18:00:00Z",
    };
    localStorage.setItem("kpass:monthMeta", JSON.stringify(monthMeta));

    // Act
    const loadMonthMeta = require("@/lib/storage/loaders").loadMonthMeta;
    const result = loadMonthMeta(new Date());

    // Assert: snapshot id should be overwritten to "2026-08"
    expect(result).toBeDefined();
    expect(result?.months["2026-08"]).toBeDefined();
    expect(result?.months["2026-08"].id).toBe("2026-08");
    expect(result?.months["2026-08"].userType).toBe("general");
    expect(result?.months["2026-08"].avgFare).toBe(2500);
  });

  it("AC-2[P0]: returns full monthMeta with multiple months, each with id overwritten", () => {
    // Arrange: Store monthMeta with multiple snapshots
    const monthMeta: MonthMeta = {
      id: "monthMeta",
      version: 1,
      months: {
        "2026-09": {
          id: "snapshot-sep",
          userType: "youth",
          avgFare: 1250,
          createdAt: "2026-09-01T10:00:00Z",
          updatedAt: "2026-09-22T15:30:00Z",
        },
        "2026-08": {
          id: "snapshot-aug",
          userType: "general",
          avgFare: 2500,
          createdAt: "2026-08-01T10:00:00Z",
          updatedAt: "2026-08-31T18:00:00Z",
        },
      },
      createdAt: "2026-08-01T10:00:00Z",
      updatedAt: "2026-09-22T15:30:00Z",
    };
    localStorage.setItem("kpass:monthMeta", JSON.stringify(monthMeta));

    // Act
    const loadMonthMeta = require("@/lib/storage/loaders").loadMonthMeta;
    const result = loadMonthMeta(new Date());

    // Assert
    expect(result?.months["2026-09"].id).toBe("2026-09");
    expect(result?.months["2026-08"].id).toBe("2026-08");
    expect(result?.months["2026-09"].userType).toBe("youth");
    expect(result?.months["2026-08"].userType).toBe("general");
  });

  it("should return null when kpass:monthMeta does not exist", () => {
    // Act
    const loadMonthMeta = require("@/lib/storage/loaders").loadMonthMeta;
    const result = loadMonthMeta(new Date());

    // Assert
    expect(result).toBeNull();
  });

  it("should return null when kpass:monthMeta contains corrupt JSON", () => {
    // Arrange
    localStorage.setItem("kpass:monthMeta", "{not valid json");

    // Act
    const loadMonthMeta = require("@/lib/storage/loaders").loadMonthMeta;
    const result = loadMonthMeta(new Date());

    // Assert
    expect(result).toBeNull();
  });

  it("should handle monthMeta with empty months object", () => {
    // Arrange
    const emptyMonthMeta: MonthMeta = {
      id: "monthMeta",
      version: 1,
      months: {},
      createdAt: "2026-09-22T10:00:00Z",
      updatedAt: "2026-09-22T10:00:00Z",
    };
    localStorage.setItem("kpass:monthMeta", JSON.stringify(emptyMonthMeta));

    // Act
    const loadMonthMeta = require("@/lib/storage/loaders").loadMonthMeta;
    const result = loadMonthMeta(new Date());

    // Assert
    expect(result).toEqual(emptyMonthMeta);
    expect(Object.keys(result?.months ?? {})).toHaveLength(0);
  });
});

// ============================================================================
// AC-3: buildMonthIndex(input) extracts and sorts months descending
// ============================================================================

describe("buildMonthIndex()", () => {
  it("AC-3[P0]: returns {byMonth:{}, monthsDesc:[]} when input is invalid (e.g., string 'abc')", () => {
    // Act
    const buildMonthIndex = require("@/lib/storage/loaders").buildMonthIndex;
    const result = buildMonthIndex("abc");

    // Assert
    expect(result).toEqual({ byMonth: {}, monthsDesc: [] });
    expect(result.byMonth).toEqual({});
    expect(result.monthsDesc).toEqual([]);
  });

  it("AC-3[P0]: returns {byMonth:{}, monthsDesc:[]} when input is null", () => {
    // Act
    const buildMonthIndex = require("@/lib/storage/loaders").buildMonthIndex;
    const result = buildMonthIndex(null);

    // Assert
    expect(result).toEqual({ byMonth: {}, monthsDesc: [] });
  });

  it("AC-3[P0]: extracts months from date keys and sorts descending", () => {
    // Arrange: Input with date keys like "2026-09-01", "2026-08-03"
    const dateRideMap = {
      "2026-09-01": 2,
      "2026-08-03": 1,
    };

    // Act
    const buildMonthIndex = require("@/lib/storage/loaders").buildMonthIndex;
    const result = buildMonthIndex(dateRideMap);

    // Assert: monthsDesc should be ['2026-09', '2026-08']
    expect(result.monthsDesc).toEqual(["2026-09", "2026-08"]);
    expect(result.monthsDesc[0]).toBe("2026-09");
    expect(result.monthsDesc[1]).toBe("2026-08");
  });

  it("should extract unique months and deduplicate", () => {
    // Arrange: Multiple dates from same month
    const dateRideMap = {
      "2026-09-01": 2,
      "2026-09-05": 1,
      "2026-09-10": 3,
      "2026-08-20": 1,
      "2026-08-25": 2,
    };

    // Act
    const buildMonthIndex = require("@/lib/storage/loaders").buildMonthIndex;
    const result = buildMonthIndex(dateRideMap);

    // Assert
    expect(result.monthsDesc).toEqual(["2026-09", "2026-08"]);
    expect(result.monthsDesc).toHaveLength(2);
  });

  it("should sort months in descending order (newest first)", () => {
    // Arrange: Multiple months in random order
    const dateRideMap = {
      "2025-06-15": 1,
      "2026-03-10": 2,
      "2025-12-20": 3,
      "2026-09-22": 1,
    };

    // Act
    const buildMonthIndex = require("@/lib/storage/loaders").buildMonthIndex;
    const result = buildMonthIndex(dateRideMap);

    // Assert: Should be sorted descending
    expect(result.monthsDesc).toEqual(["2026-09", "2026-03", "2025-12", "2025-06"]);
    // Verify descending order
    for (let i = 0; i < result.monthsDesc.length - 1; i++) {
      expect(result.monthsDesc[i]).toBeGreaterThan(result.monthsDesc[i + 1]);
    }
  });

  it("should handle single month", () => {
    // Arrange
    const dateRideMap = {
      "2026-09-01": 2,
      "2026-09-05": 1,
    };

    // Act
    const buildMonthIndex = require("@/lib/storage/loaders").buildMonthIndex;
    const result = buildMonthIndex(dateRideMap);

    // Assert
    expect(result.monthsDesc).toEqual(["2026-09"]);
    expect(result.monthsDesc).toHaveLength(1);
  });

  it("should return {byMonth:{}, monthsDesc:[]} for empty record", () => {
    // Arrange
    const emptyMap = {};

    // Act
    const buildMonthIndex = require("@/lib/storage/loaders").buildMonthIndex;
    const result = buildMonthIndex(emptyMap);

    // Assert
    expect(result).toEqual({ byMonth: {}, monthsDesc: [] });
  });

  it("should handle invalid date format gracefully (skip malformed dates)", () => {
    // Arrange: Mixed valid and invalid date keys
    const mixedMap = {
      "2026-09-01": 2,
      "not-a-date": 1,
      "2026-08-03": 1,
    };

    // Act
    const buildMonthIndex = require("@/lib/storage/loaders").buildMonthIndex;
    const result = buildMonthIndex(mixedMap);

    // Assert: Should extract only valid YYYY-MM- dates
    // Either include only valid months or skip malformed
    expect(result.monthsDesc).toContain("2026-09");
    expect(result.monthsDesc).toContain("2026-08");
  });

  it("should populate byMonth record with month to some value mapping", () => {
    // Arrange
    const dateRideMap = {
      "2026-09-01": 5,
      "2026-08-03": 3,
    };

    // Act
    const buildMonthIndex = require("@/lib/storage/loaders").buildMonthIndex;
    const result = buildMonthIndex(dateRideMap);

    // Assert: byMonth should have entries for each unique month
    expect(result.byMonth).toBeDefined();
    expect(Object.keys(result.byMonth)).toHaveLength(2);
    // The exact values in byMonth are implementation-dependent
    // but it should have keys for "2026-09" and "2026-08"
    expect("2026-09" in result.byMonth).toBe(true);
    expect("2026-08" in result.byMonth).toBe(true);
  });
});

// ============================================================================
// Integration: Loaders work together without crashing
// ============================================================================

describe("Storage loaders integration", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should load all three data structures without errors", () => {
    // Arrange: Populate all three storage keys
    const settings: UserSettings = {
      id: "settings",
      version: 1,
      userType: "general",
      avgFare: 2500,
      passPrice: 65000,
      createdAt: "2026-09-22T10:00:00Z",
      updatedAt: "2026-09-22T10:00:00Z",
    };
    const rides: RideLog = {
      id: "rides",
      version: 1,
      days: { "2026-09-22": 2, "2026-09-21": 1 },
      createdAt: "2026-09-20T10:00:00Z",
      updatedAt: "2026-09-22T15:30:00Z",
    };
    const monthMeta: MonthMeta = {
      id: "monthMeta",
      version: 1,
      months: {
        "2026-09": {
          id: "temp",
          userType: "general",
          avgFare: 2500,
          createdAt: "2026-09-01T10:00:00Z",
          updatedAt: "2026-09-22T15:30:00Z",
        },
      },
      createdAt: "2026-09-01T10:00:00Z",
      updatedAt: "2026-09-22T15:30:00Z",
    };

    localStorage.setItem("kpass:settings", JSON.stringify(settings));
    localStorage.setItem("kpass:rides", JSON.stringify(rides));
    localStorage.setItem("kpass:monthMeta", JSON.stringify(monthMeta));

    // Act
    const { loadSettings, loadRides, loadMonthMeta, buildMonthIndex } = require("@/lib/storage/loaders");
    const loadedSettings = loadSettings(new Date());
    const loadedRides = loadRides(new Date());
    const loadedMonthMeta = loadMonthMeta(new Date());
    const index = buildMonthIndex(loadedRides?.days ?? {});

    // Assert
    expect(loadedSettings).toBeDefined();
    expect(loadedRides).toBeDefined();
    expect(loadedMonthMeta).toBeDefined();
    expect(index).toBeDefined();
    expect(index.monthsDesc).toEqual(["2026-09"]);
  });

  it("should handle partial data (some keys missing)", () => {
    // Arrange: Only settings and rides, no monthMeta
    const settings: UserSettings = {
      id: "settings",
      version: 1,
      userType: "youth",
      avgFare: 1250,
      passPrice: null,
      createdAt: "2026-09-22T10:00:00Z",
      updatedAt: "2026-09-22T10:00:00Z",
    };
    localStorage.setItem("kpass:settings", JSON.stringify(settings));

    // Act
    const { loadSettings, loadMonthMeta } = require("@/lib/storage/loaders");
    const loadedSettings = loadSettings(new Date());
    const loadedMonthMeta = loadMonthMeta(new Date());

    // Assert
    expect(loadedSettings).toBeDefined();
    expect(loadedMonthMeta).toBeNull();
  });
});
