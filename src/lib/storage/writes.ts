/**
 * Storage writes (packet 0003)
 * writePair / saveSettings / setDayCount / incrementToday / decrementToday
 */

import type {
  MonthMeta,
  RideLog,
  SaveResult,
  SaveSettingsInput,
  StoreResult,
  UserSettings,
} from '@/lib/types';
import { DAILY_MAX, cutoffMonth } from '@/lib/kpassPolicy';
import { getMonthKey, isValidRecordDate, toDateKey } from '@/lib/dateKeys';
import { loadMonthMeta, loadRides, loadSettings } from '@/lib/storage/loaders';

const K_SETTINGS = 'kpass:settings';
const K_RIDES = 'kpass:rides';
const K_META = 'kpass:monthMeta';

function put(key: string, val: string | null): void {
  if (val === null) localStorage.removeItem(key);
  else localStorage.setItem(key, val);
}

function safeRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** 두 키를 순서대로 쓴다. 어느 쪽이든 실패하면 둘 다 이전 raw 값으로 되돌린다 */
export function writePair(
  key1: string,
  val1: string | null,
  key2: string,
  val2: string | null,
): SaveResult {
  const prev1 = safeRaw(key1);
  const prev2 = safeRaw(key2);
  try {
    put(key1, val1);
    put(key2, val2);
    return { ok: true };
  } catch {
    for (const [k, v] of [
      [key1, prev1],
      [key2, prev2],
    ] as const) {
      try {
        put(k, v);
      } catch {
        /* 복구 실패는 삼킨다 */
      }
    }
    return { ok: false, reason: 'QUOTA' };
  }
}

function stamp(now: Date, createdAt?: string): { createdAt: string; updatedAt: string } {
  const iso = now.toISOString();
  return { createdAt: createdAt ?? iso, updatedAt: createdAt && createdAt > iso ? createdAt : iso };
}

/** 보존 기간 이전 월의 일 키·스냅샷 제거 */
function prune(days: Record<string, number>, months: MonthMeta['months'], now: Date) {
  const cutoff = cutoffMonth(now);
  const outDays: Record<string, number> = {};
  for (const [k, n] of Object.entries(days)) {
    if (k.slice(0, 7) >= cutoff) outDays[k] = n;
  }
  const outMonths: MonthMeta['months'] = {};
  for (const [k, s] of Object.entries(months)) {
    if (k >= cutoff) outMonths[k] = s;
  }
  return { days: outDays, months: outMonths };
}

/** 이번 달 스냅샷이 없으면 현재 설정으로 만든다 */
function ensureSnapshot(
  months: MonthMeta['months'],
  month: string,
  settings: UserSettings,
  iso: string,
): MonthMeta['months'] {
  if (months[month]) return months;
  return {
    ...months,
    [month]: {
      id: month,
      userType: settings.userType,
      avgFare: settings.avgFare,
      createdAt: iso,
      updatedAt: iso,
    },
  };
}

/** 설정 저장 + 이번 달 스냅샷 갱신. monthMeta → settings 순, 실패 시 롤백 */
export function saveSettings(input: SaveSettingsInput): SaveResult {
  const now = new Date();
  const iso = now.toISOString();
  const month = toDateKey(now).slice(0, 7);
  const prevSettings = loadSettings(now);
  const meta = loadMonthMeta(now);

  const settings: UserSettings = {
    id: 'settings',
    version: 1,
    userType: input.userType,
    avgFare: input.avgFare,
    passPrice: input.passPrice,
    ...stamp(now, prevSettings?.createdAt),
  };
  const prevSnap = meta?.months[month];
  const months = {
    ...(meta?.months ?? {}),
    [month]: {
      id: month,
      userType: input.userType,
      avgFare: input.avgFare,
      createdAt: prevSnap?.createdAt ?? iso,
      updatedAt: iso,
    },
  };
  const newMeta: MonthMeta = {
    id: 'monthMeta',
    version: 1,
    months,
    ...stamp(now, meta?.createdAt),
  };
  return writePair(K_META, JSON.stringify(newMeta), K_SETTINGS, JSON.stringify(settings));
}

function commitDays(
  settings: UserSettings,
  date: string,
  count: number,
  now: Date,
): StoreResult {
  const iso = now.toISOString();
  const rides = loadRides(now);
  const meta = loadMonthMeta(now);
  const pruned = prune(rides?.days ?? {}, meta?.months ?? {}, now);

  const days = { ...pruned.days };
  if (count === 0) delete days[date];
  else days[date] = count;

  let months = pruned.months;
  if (getMonthKey(date) === toDateKey(now).slice(0, 7)) {
    months = ensureSnapshot(months, getMonthKey(date), settings, iso);
  }

  const newRides: RideLog = { id: 'rides', version: 1, days, ...stamp(now, rides?.createdAt) };
  const metaRaw =
    !meta && Object.keys(months).length === 0
      ? null
      : JSON.stringify({
          id: 'monthMeta',
          version: 1,
          months,
          ...stamp(now, meta?.createdAt),
        } satisfies MonthMeta);

  const res = writePair(K_RIDES, JSON.stringify(newRides), K_META, metaRaw);
  return res.ok ? { ok: true, count } : { ok: false, reason: 'QUOTA' };
}

/** 특정 날짜의 탑승 횟수 설정. 0이면 키 삭제. NO_SETTINGS → INVALID_DATE → DAILY_MAX/BELOW_ZERO */
export function setDayCount(date: string, count: number): StoreResult {
  const now = new Date();
  const settings = loadSettings(now);
  if (!settings) return { ok: false, reason: 'NO_SETTINGS' };
  if (!isValidRecordDate(date, now)) return { ok: false, reason: 'INVALID_DATE' };
  if (!Number.isInteger(count) || count < 0) return { ok: false, reason: 'BELOW_ZERO' };
  if (count > DAILY_MAX) return { ok: false, reason: 'DAILY_MAX' };
  return commitDays(settings, date, count, now);
}

function stepToday(delta: 1 | -1): StoreResult {
  const now = new Date();
  const settings = loadSettings(now);
  if (!settings) return { ok: false, reason: 'NO_SETTINGS' };
  const today = toDateKey(now);
  const current = loadRides(now)?.days[today] ?? 0;
  const next = current + delta;
  if (next > DAILY_MAX) return { ok: false, reason: 'DAILY_MAX' };
  if (next < 0) return { ok: false, reason: 'BELOW_ZERO' };
  return commitDays(settings, today, next, now);
}

/** 오늘 +1 (최대 20) */
export function incrementToday(): StoreResult {
  return stepToday(1);
}

/** 오늘 −1 (0이면 BELOW_ZERO, 0이 되면 키 삭제) */
export function decrementToday(): StoreResult {
  return stepToday(-1);
}
