import { searchQueryTokens } from '@cod/shared';
import type { SynonymPair } from './search-query';

/**
 * Common Darija product words as buyers type them in Latin script, with the Arabic-script word a merchant writes
 * (ADR 0014 risk "Latin-script ↔ Arabic-script Darija"): every backend of spike E missed these pairs. Each business
 * starts with this list on its first search; merchants edit their own copy later.
 */
const DARIJA_WORDS: readonly (readonly [latin: string, arabic: string])[] = [
  ['sabbat', 'سبّاط'],
  ['sebbat', 'سبّاط'],
  ['jellaba', 'جلّابة'],
  ['djellaba', 'جلّابة'],
  ['tricot', 'تريكو'],
  ['triko', 'تريكو'],
  ['kaftan', 'قفطان'],
  ['caftan', 'قفطان'],
  ['chlaka', 'شلاكة'],
  ['karakou', 'كاراكو'],
  ['burnous', 'برنوس'],
  ['gandoura', 'قندورة'],
  ['djebba', 'جبّة'],
  ['serwal', 'سروال'],
  ['sirwal', 'سروال'],
  ['hayek', 'حايك'],
  ['melhfa', 'ملحفة'],
  ['blouza', 'بلوزة'],
  ['fouta', 'فوطة'],
  ['chechia', 'شاشية'],
  ['belgha', 'بلغة'],
  ['tqacher', 'تقاشر'],
  ['maryoul', 'مريول'],
  ['pyjama', 'بيجامة'],
  ['zarbia', 'زربية'],
  ['mkhadda', 'مخدّة'],
  ['mraya', 'مراية'],
  ['berrad', 'برّاد'],
  ['tajine', 'طاجين'],
  ['keskes', 'كسكاس'],
  ['gasaa', 'قصعة'],
  ['tabsi', 'طبسي'],
  ['mendil', 'منديل'],
  ['henna', 'حنّة'],
  ['kohl', 'كحل'],
  ['ghassoul', 'غاسول'],
  ['saboun', 'صابون'],
  ['siwak', 'سواك'],
  ['chargeur', 'شارجور'],
  ['casque', 'كاسك'],
];

/** A word in the form query words take: search normal form, article stripped as in a query. */
const asQueryWord = (word: string): string => searchQueryTokens(word).join(' ');

/** {@link DARIJA_WORDS} in search normal form, as a business's synonym table stores them. */
export const DARIJA_SYNONYMS: readonly SynonymPair[] = DARIJA_WORDS.map(([latin, arabic]) => ({
  term: asQueryWord(latin),
  expansion: asQueryWord(arabic),
}));
