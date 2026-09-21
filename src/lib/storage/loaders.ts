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

function fixTimes(o: Record<string, unknown>, now: Date): { createdAt: string; updatedAt: string } {
  const iso = now.toISOString();
  const created = typeof o.createdAt === 'string' && !Number.isNaN(Date.parse(o.createdAt)) ? o.createdAt : null;
  const updated = typeof o.updatedAt === 'string' && !Number.isNaN(Date.parse(o.updatedAt)) ? o.updatedAt : null;
  const c = created ?? updated ?? iso;
  const u = updated ?? c;
  return Date.parse(c) <= Date.parse(u) ? { createdAt: c, updatedAt: u } : { createdAt: c, updatedAt: c };
}

/** 설정 로드. 없거나 손상이면 null (저장소는 건드리지 않는다). passPrice만 범위 밖이면 null로 읽는다 */
export function loadSettings(now: Date = new Date()): UserSettings | null {
  const v = readJson('kpass:settings');
  if (!isRecord(v)) return null;
  if (v.id !== 'settings' || v.version !== 1) return null;
  if (!isUserType(v.userType)) return null;
  if (!isIntIn(v.avgFare, 100, 10000)) return null;
  const passPrice = isIntIn(v.passPrice, 1000, 500000) ? v.passPrice : null;
  return { ...(v as unknown as UserSettings), passPrice, ...fixTimes(v, now) };
}

/** 탑승 기록 로드. 없거나 문서가 손상이면 null. 이상 항목만 버리고 20 초과는 20으로 자른다 */
export function loadRides(now: Date = new Date()): RideLog | null {
  const v = readJson('kpass:rides');
  if (!isRecord(v)) return null;
  if (v.id !== 'rides' || v.version !== 1) return null;
  const days: Record<string, number> = {};
  if (isRecord(v.days)) {
    for (const [k, n] of Object.entries(v.days)) {
      if (!getMonthKey(k) || typeof n !== 'number' || !Number.isInteger(n) || n < 1) continue;
      days[k] = Math.min(n, DAILY_MAX);
    }
  }
  return { ...(v as unknown as RideLog), days, ...fixTimes(v, now) };
}

/** 월 스냅샷 로드. 각 스냅샷의 id는 months 맵 키로 덮어쓰고, 이상 스냅샷만 버린다 */
export function loadMonthMeta(now: Date = new Date()): MonthMeta | null {
  const v = readJson('kpass:monthMeta');
  if (!isRecord(v)) return null;
  if (v.id !== 'monthMeta' || v.version !== 1) return null;
  const months: Record<string, MonthSnapshot> = {};
  if (isRecord(v.months)) {
    for (const [key, s] of Object.entries(v.months)) {
      if (!isRecord(s) || !isUserType(s.userType) || !isIntIn(s.avgFare, 100, 10000)) continue;
      months[key] = { ...(s as unknown as MonthSnapshot), id: key, ...fixTimes(s, now) };
    }
  }
  return { ...(v as unknown as MonthMeta), months, ...fixTimes(v, now) };
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
