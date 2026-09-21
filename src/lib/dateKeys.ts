import { cutoffMonth } from '@/lib/kpassPolicy';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** 기기 로컬 날짜 → 'YYYY-MM-DD' */
export function toDateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 'YYYY-MM-DD' → 로컬 Date. 형식·달력이 틀리면 null */
function parseDateKey(key: string): Date | null {
  const m = typeof key === 'string' ? DATE_RE.exec(key) : null;
  if (!m) return null;
  const [y, mo, da] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(y, mo - 1, da);
  if (d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== da) return null;
  return d;
}

/** 실제 존재하는 날짜이고, 오늘 이전이며, 보존 기간(cutoffMonth) 안인가 */
export function isValidRecordDate(key: string, now: Date = new Date()): boolean {
  if (!parseDateKey(key)) return false;
  if (key > toDateKey(now)) return false;
  return key.slice(0, 7) >= cutoffMonth(now);
}

/** '2026-09-22' → '9월 22일 (화)'. 잘못된 입력은 원문 그대로 */
export function formatDayLabel(key: string): string {
  const d = parseDateKey(key);
  if (!d) return typeof key === 'string' ? key : '';
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAY_NAMES[d.getDay()]})`;
}

/** 'YYYY-MM-DD' → 'YYYY-MM'. 존재하지 않는 날짜면 빈 문자열 */
export function getMonthKey(date: string): string {
  return parseDateKey(date) ? date.slice(0, 7) : '';
}

/** 'YYYY-MM' → { year, month }. 형식이 틀리거나 월이 1~12가 아니면 { year: 0, month: 0 } */
export function parseYearMonth(key: string): { year: number; month: number } {
  const m = typeof key === 'string' ? /^(\d{4})-(\d{2})$/.exec(key) : null;
  if (!m) return { year: 0, month: 0 };
  const month = Number(m[2]);
  if (month < 1 || month > 12) return { year: 0, month: 0 };
  return { year: Number(m[1]), month };
}

/** 이번 달 포함 최근 n개월 키('YYYY-MM'), 오래된 달부터 */
export function recentMonthKeys(today: Date = new Date(), n = 6): string[] {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
  }
  return keys;
}
