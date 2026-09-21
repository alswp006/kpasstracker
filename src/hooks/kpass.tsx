import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  buildMonthIndex,
  decrementToday,
  incrementToday,
  loadMonthMeta,
  loadRides,
  loadSettings,
  saveSettings,
  setDayCount,
} from '@/lib/kpassStore';
import type {
  MonthIndex,
  MonthMeta,
  RideLog,
  SaveResult,
  SaveSettingsInput,
  StoreResult,
  UserSettings,
} from '@/lib/types';
import { toDateKey } from '@/lib/dateKeys';

interface Snapshot {
  settings: UserSettings | null;
  rides: RideLog | null;
  monthMeta: MonthMeta | null;
}

interface KpassContextValue extends Snapshot {
  saveSettings: (input: SaveSettingsInput) => SaveResult;
  increment: () => StoreResult;
  decrement: () => StoreResult;
  setDay: (date: string, count: number) => StoreResult;
}

const KpassContext = createContext<KpassContextValue | null>(null);

function readAll(): Snapshot {
  const now = new Date();
  return { settings: loadSettings(now), rides: loadRides(now), monthMeta: loadMonthMeta(now) };
}

export function KpassProvider({ children }: { children: ReactNode }) {
  // 마운트 시 저장소에서 동기 로드
  const [snap, setSnap] = useState<Snapshot>(readAll);

  const reload = useCallback(() => setSnap(readAll()), []);

  // 탭이 다시 보이면 저장소 기준으로 상태를 다시 읽는다
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') reload();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [reload]);

  // 메모리 상태는 쓰기가 ok일 때만 갱신한다
  const value = useMemo<KpassContextValue>(
    () => ({
      ...snap,
      saveSettings: (input) => {
        const res = saveSettings(input);
        if (res.ok) reload();
        return res;
      },
      increment: () => {
        const res = incrementToday();
        if (res.ok) reload();
        return res;
      },
      decrement: () => {
        const res = decrementToday();
        if (res.ok) reload();
        return res;
      },
      setDay: (date, count) => {
        const res = setDayCount(date, count);
        if (res.ok) reload();
        return res;
      },
    }),
    [snap, reload],
  );

  return <KpassContext.Provider value={value}>{children}</KpassContext.Provider>;
}

function useKpass(): KpassContextValue {
  const ctx = useContext(KpassContext);
  if (!ctx) throw new Error('KpassProvider 안에서만 사용할 수 있어요');
  return ctx;
}

export function useSettings() {
  const { settings, saveSettings: save } = useKpass();
  return { settings, save };
}

export function useRides(): {
  rides: RideLog | null;
  days: Record<string, number>;
  todayCount: number;
  monthIndex: MonthIndex;
  increment: () => StoreResult;
  decrement: () => StoreResult;
  setDay: (date: string, count: number) => StoreResult;
} {
  const { rides, increment, decrement, setDay } = useKpass();
  const days = useMemo(() => rides?.days ?? {}, [rides]);
  const monthIndex = useMemo(() => buildMonthIndex(days), [days]);
  const todayCount = days[toDateKey(new Date())] ?? 0;
  return { rides, days, todayCount, monthIndex, increment, decrement, setDay };
}

export function useMonthMeta() {
  const { monthMeta } = useKpass();
  return { monthMeta };
}
