/**
 * kpassStore barrel - 저장소 로더·쓰기 함수·관련 타입을 한 곳에서 내보낸다.
 * 화면/훅은 '@/lib/storage/*'를 직접 import하지 말고 이 모듈을 쓴다.
 */

// 로더 (packet 0001-0002)
export { loadSettings, loadRides, loadMonthMeta, buildMonthIndex } from '@/lib/storage/loaders';

// 쓰기 함수 (packet 0003)
export { writePair, saveSettings, setDayCount, incrementToday, decrementToday } from '@/lib/storage/writes';

// 저장 결과·입력 타입 (호출부에서 별도 import 없이 결과 분기 가능)
export type {
  MonthMeta,
  RideLog,
  SaveResult,
  SaveSettingsInput,
  StoreResult,
  UserSettings,
} from '@/lib/types';

/** localStorage 키 — 값을 바꾸면 기존 사용자 데이터가 끊기므로 변경 금지 */
export const STORAGE_KEYS = {
  settings: 'kpass:settings',
  rides: 'kpass:rides',
  monthMeta: 'kpass:monthMeta',
} as const;
