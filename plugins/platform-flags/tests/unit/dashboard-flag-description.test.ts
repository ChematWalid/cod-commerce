import { FLAG_SEEDS } from '@cod/shared';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { flagDescription } from '../../dashboard/flag-description';
import { DYNAMIC_MESSAGE_IDS } from '../../dashboard/i18n/dynamic-ids';

/** Reads a catalogue's single-line `msgid`/`msgstr` pairs; the flag descriptions are one line each. */
function catalogue(locale: 'en' | 'ar'): (id: string) => string {
  const text = readFileSync(join(__dirname, `../../dashboard/i18n/${locale}.po`), 'utf8');
  const entries = new Map<string, string>();
  for (const match of text.matchAll(/^msgid "(.*)"\nmsgstr "(.*)"$/gm)) entries.set(match[1] ?? '', match[2] ?? '');
  return (id) => entries.get(id) ?? '';
}

const seeded = (key: string): string => FLAG_SEEDS.find((seed) => seed.key === key)?.description ?? 'stored text';
const flag = (key: string, description = seeded(key)): { key: string; description: string } => ({ key, description });

describe('flagDescription', () => {
  it('shows the Arabic catalogue text for ai.enabled on the Arabic page', () => {
    const text = flagDescription(catalogue('ar'), flag('ai.enabled'));
    expect(text).toMatch(/\p{Script=Arabic}/u);
    expect(text).not.toBe(seeded('ai.enabled'));
  });

  it('shows the English catalogue text for ai.enabled on the English page', () => {
    expect(flagDescription(catalogue('en'), flag('ai.enabled'))).toMatch(/AI/);
  });

  it('shows the stored description for a key the catalogues do not know', () => {
    expect(flagDescription(catalogue('ar'), flag('future.flag', 'Stored words'))).toBe('Stored words');
  });

  it('shows the stored description once staff have edited a known flag', () => {
    expect(flagDescription(catalogue('ar'), flag('ai.enabled', 'Edited by staff'))).toBe('Edited by staff');
  });

  it.each(FLAG_SEEDS.map((seed) => seed.key))('has an Arabic and an English text for %s', (key) => {
    for (const locale of ['ar', 'en'] as const) {
      const text = flagDescription(catalogue(locale), flag(key));
      expect(text).not.toBe('');
      if (locale === 'ar') expect(text).not.toBe(seeded(key));
      expect(text).not.toBe(`flags.description.${key}`);
      if (locale === 'ar') expect(text).toMatch(/\p{Script=Arabic}/u);
    }
  });

  it('registers every seeded flag description as a dynamic message id for i18n:check', () => {
    expect(DYNAMIC_MESSAGE_IDS).toEqual(
      expect.arrayContaining(FLAG_SEEDS.map((seed) => `flags.description.${seed.key}`)),
    );
  });
});
