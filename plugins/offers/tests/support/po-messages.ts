import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The dashboard's catalogues, read as the browser bundle reads them: one message per explicit id. */
const CATALOGUE_DIR = join(__dirname, '../../dashboard/i18n');

const ENTRY = /^msgid "(.+)"\nmsgstr "(.*)"$/gm;

/** The messages of the dashboard's `language` catalogue by id (single-line entries, as the catalogues hold). */
export function dashboardMessages(language: 'en' | 'ar'): ReadonlyMap<string, string> {
  const text = readFileSync(join(CATALOGUE_DIR, `${language}.po`), 'utf8');
  return new Map([...text.matchAll(ENTRY)].map(([, id = '', message = '']) => [id, message.replaceAll('\\"', '"')]));
}

/** `id`'s message with its `{name}` slots filled, as `i18n._(id, values)` renders a plain message. */
export function renderMessage(
  messages: ReadonlyMap<string, string>,
  id: string,
  values: Readonly<Record<string, string | number>> = {},
): string {
  const message = messages.get(id);
  if (message === undefined) throw new Error(`No message ${id}`);
  return message.replaceAll(/\{(\w+)\}/g, (slot, name: string) => String(values[name] ?? slot));
}
