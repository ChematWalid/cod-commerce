import { ALGERIA_UTC_OFFSET, ALGERIA_UTC_OFFSET_MS } from '../constants';

/** What a `datetime-local` input holds: a date and a minute, no zone. */
const LOCAL_MINUTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
/** `YYYY-MM-DDTHH:mm` is the first 16 characters of an ISO instant. */
const LOCAL_MINUTE_LENGTH = 16;

/**
 * An instant as a `datetime-local` value in Algeria time (UTC+1 all year), `''` for none. The merchant types and
 * reads dates in the country's time whatever the browser's zone.
 */
export function algeriaInputOf(iso: string | null): string {
  if (iso === null) return '';
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return '';
  return new Date(time + ALGERIA_UTC_OFFSET_MS).toISOString().slice(0, LOCAL_MINUTE_LENGTH);
}

/** A typed Algeria time as a UTC ISO instant: `null` when blank, `undefined` when it is no date. */
export function instantOfAlgeriaInput(text: string): string | null | undefined {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  if (!LOCAL_MINUTE.test(trimmed)) return undefined;
  const time = Date.parse(`${trimmed}:00${ALGERIA_UTC_OFFSET}`);
  return Number.isNaN(time) ? undefined : new Date(time).toISOString();
}
