export type LooseRecord = Record<string, unknown>;

export const asRecord = (value: unknown): LooseRecord =>
  value && typeof value === 'object' ? value as LooseRecord : {};

export const asOptionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value : undefined;

export const toStringMap = (value: unknown): Record<string, string> =>
  Object.fromEntries(
    Object.entries(asRecord(value))
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );

export const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback;
