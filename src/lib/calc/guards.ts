import type { UserType } from '@/lib/types';
import { REFUND_RATE_PCT } from '@/lib/kpassPolicy';

export function isValidCount(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0;
}

export function isValidPositive(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

export function isValidType(t: unknown): t is UserType {
  return typeof t === 'string' && Object.prototype.hasOwnProperty.call(REFUND_RATE_PCT, t);
}
