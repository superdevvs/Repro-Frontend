import type { EmailHealth } from '@/types/auth';
import { isUserEmailVerified } from '@/utils/emailHealth';

export type AccountSortKey = 'name' | 'accountRep' | 'lastShootDate' | 'emailVerified';
export type AccountSort = { key: AccountSortKey; direction: 'asc' | 'desc' } | null;

export const ACCOUNT_SORT_OPTIONS: Array<{ value: string; label: string; sort: AccountSort }> = [
  { value: 'default', label: 'Default order', sort: null },
  { value: 'name-asc', label: 'User: A–Z', sort: { key: 'name', direction: 'asc' } },
  { value: 'name-desc', label: 'User: Z–A', sort: { key: 'name', direction: 'desc' } },
  { value: 'accountRep-asc', label: 'Rep: A–Z', sort: { key: 'accountRep', direction: 'asc' } },
  { value: 'accountRep-desc', label: 'Rep: Z–A', sort: { key: 'accountRep', direction: 'desc' } },
  { value: 'lastShootDate-desc', label: 'Last shoot: newest first', sort: { key: 'lastShootDate', direction: 'desc' } },
  { value: 'lastShootDate-asc', label: 'Last shoot: oldest first', sort: { key: 'lastShootDate', direction: 'asc' } },
  { value: 'emailVerified-desc', label: 'Verified emails first', sort: { key: 'emailVerified', direction: 'desc' } },
  { value: 'emailVerified-asc', label: 'Unverified emails first', sort: { key: 'emailVerified', direction: 'asc' } },
];

export function getAccountSortValue(sort: AccountSort): string {
  return sort ? `${sort.key}-${sort.direction}` : 'default';
}

export function getNextAccountSort(current: AccountSort, key: AccountSortKey): AccountSort {
  return {
    key,
    direction: current?.key === key
      ? (current.direction === 'asc' ? 'desc' : 'asc')
      : (key === 'lastShootDate' ? 'desc' : 'asc'),
  };
}

type SortableAccount = {
  name: string;
  email: string;
  accountRep?: string;
  lastShootDate?: string;
  email_health?: EmailHealth | null;
};

const accountCollator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

function getRepName(value?: string): string | null {
  const name = value?.trim();
  return name && name.toLowerCase() !== 'unassigned' ? name : null;
}

function getShootTimestamp(value?: string): number | null {
  const timestamp = value ? Date.parse(value) : NaN;
  return Number.isFinite(timestamp) ? timestamp : null;
}

function compareMissingLast<T>(
  left: T | null,
  right: T | null,
  compare: (a: T, b: T) => number,
  direction: number,
): number {
  if (left === null) return right === null ? 0 : 1;
  if (right === null) return -1;
  return compare(left, right) * direction;
}

export function sortAccounts<T extends SortableAccount>(accounts: readonly T[], sort: AccountSort): T[] {
  const sorted = [...accounts];
  if (!sort) return sorted;

  const direction = sort.direction === 'asc' ? 1 : -1;
  return sorted.sort((left, right) => {
    let comparison = 0;
    switch (sort.key) {
      case 'name':
        comparison = accountCollator.compare(left.name.trim(), right.name.trim()) * direction;
        break;
      case 'accountRep':
        comparison = compareMissingLast(
          getRepName(left.accountRep),
          getRepName(right.accountRep),
          accountCollator.compare,
          direction,
        );
        break;
      case 'lastShootDate':
        comparison = compareMissingLast(
          getShootTimestamp(left.lastShootDate),
          getShootTimestamp(right.lastShootDate),
          (a, b) => a - b,
          direction,
        );
        break;
      case 'emailVerified':
        comparison = (
          Number(isUserEmailVerified(left.email_health)) - Number(isUserEmailVerified(right.email_health))
        ) * direction;
        break;
    }

    return comparison
      || accountCollator.compare(left.name.trim(), right.name.trim())
      || accountCollator.compare(left.email.trim(), right.email.trim());
  });
}
