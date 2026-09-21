import type {
  MonthIndex,
  MonthMeta,
  MonthSnapshot,
  RideLog,
  UserSettings,
  UserType,
} from '@/lib/types';
import { DAILY_MAX } from '@/lib/kpassPolicy';
import { getMonthKey } from '@/lib/dateKeys';

const USER_TYPES: readonly UserType[] = ['general', 'youth', 'lowIncome'];

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === '') return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isIntIn(v: unknown, min: number, max: number): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
}

function isUserType(v: unknown): v is UserType {
  return typeof v === 'string' && (USER_TYPES as readonly string[]).includes(v);
}

function validTimes(o: Record<string, unknown>): boolean {
  const { createdAt, updatedAt } = o;
  if (typeof createdAt !== 'string' || typeof updatedAt !== 'string') return false;
  const c = Date.parse(createdAt);
  const u = Date.parse(updatedAt);
  return !Number.isNaN(c) && !Number.isNaN(u) && c <= u;
}

/** 설정 로드. 없거나 손상이면 null (저장소는 건드리지 않는다) */
export function loadSettings(_now: Date = new Date()): UserSettings | null {
  const v = readJson('kpass:settings');
  if (!isRecord(v)) return null;
  if (v.id !== 'settings' || v.version !== 1) return null;
  if (!isUserType(v.userType)) return null;
  if (!isIntIn(v.avgFare, 100, 10000)) return null;
  if (v.passPrice !== null && !isIntIn(v.passPrice, 1000, 500000)) return null;
  if (!validTimes(v)) return null;
  return v as unknown as UserSettings;
}

/** 탑승 기록 로드. 없거나 손상이면 null */
export function loadRides(_now: Date = new Date()): RideLog | null {
  const v = readJson('kpass:rides');
  if (!isRecord(v)) return null;
  if (v.id !== 'rides' || v.version !== 1) return null;
  if (!isRecord(v.days)) return null;
  if (!validTimes(v)) return null;
  for (const [k, n] of Object.entries(v.days)) {
    if (!getMonthKey(k) || !isIntIn(n, 1, DAILY_MAX)) return null;
  }
  return v as unknown as RideLog;
}

/** 월 스냅샷 로드. 각 스냅샷의 id는 months 맵 키로 덮어쓴다 */
export function loadMonthMeta(_now: Date = new Date()): MonthMeta | null {
  const v = readJson('kpass:monthMeta');
  if (!isRecord(v)) return null;
  if (v.id !== 'monthMeta' || v.version !== 1) return null;
  if (!isRecord(v.months)) return null;
  if (!validTimes(v)) return null;
  const months: Record<string, MonthSnapshot> = {};
  for (const [key, s] of Object.entries(v.months)) {
    if (!isRecord(s)) return null;
    if (!isUserType(s.userType) || !isIntIn(s.avgFare, 100, 10000) || !validTimes(s)) {
      return null;
    }
    months[key] = { ...(s as unknown as MonthSnapshot), id: key };
  }
  return { ...(v as unknown as MonthMeta), months };
}

/** days 맵 → 월별 합계와 최신순 월 목록. 잘못된 입력은 빈 인덱스 */
export function buildMonthIndex(days: unknown): MonthIndex {
  const byMonth: Record<string, number> = {};
  if (!isRecord(days)) return { byMonth, monthsDesc: [] };
  for (const [key, n] of Object.entries(days)) {
    const month = getMonthKey(key);
    if (!month) continue;
    byMonth[month] = (byMonth[month] ?? 0) + (typeof n === 'number' && Number.isFinite(n) ? n : 0);
  }
  return { byMonth, monthsDesc: Object.keys(byMonth).sort().reverse() };
}
