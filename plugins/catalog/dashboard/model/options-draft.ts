import { catalogNameKey, MAX_OPTION_GROUPS, MAX_OPTION_VALUES } from '@cod/shared';

/** One option of the matrix as the editor holds it, such as Color (Red, Blue); values in display order. */
export interface OptionDraft {
  readonly name: string;
  readonly values: readonly string[];
}

export type OptionsDraft = readonly OptionDraft[];

/** The key that adds the typed value to its option. */
const ADD_VALUE_KEY = 'Enter';

export const isAddValueKey = (key: string): boolean => key === ADD_VALUE_KEY;

/** Whether `texts` already hold `text` whatever its case, outer spaces or Unicode form (the server's rule). */
const holds = (texts: readonly string[], text: string): boolean =>
  texts.some((existing) => catalogNameKey(existing) === catalogNameKey(text));

/** `items` with the item at `from` moved by `delta`, or `items` itself when the move would leave the list. */
function moved<T>(items: readonly T[], from: number, delta: number): readonly T[] {
  const to = from + delta;
  const item = items[from];
  if (item === undefined || to < 0 || to >= items.length) return items;
  const rest = items.filter((_, index) => index !== from);
  return [...rest.slice(0, to), item, ...rest.slice(to)];
}

/** `draft` with the option at `groupIndex` given new values. */
function withValues(draft: OptionsDraft, groupIndex: number, values: readonly string[]): OptionsDraft {
  return draft.map((group, index) => (index === groupIndex ? { ...group, values } : group));
}

/** Adds the typed value (trimmed) to an option; a blank, repeated or over-the-cap value leaves the draft as it is. */
export function addValue(draft: OptionsDraft, groupIndex: number, typed: string): OptionsDraft {
  const value = typed.trim();
  const group = draft[groupIndex];
  if (group === undefined || value === '' || group.values.length >= MAX_OPTION_VALUES) return draft;
  if (holds(group.values, value)) return draft;
  return withValues(draft, groupIndex, [...group.values, value]);
}

export function removeValue(draft: OptionsDraft, groupIndex: number, valueIndex: number): OptionsDraft {
  const group = draft[groupIndex];
  if (group === undefined) return draft;
  return withValues(
    draft,
    groupIndex,
    group.values.filter((_, index) => index !== valueIndex),
  );
}

/** Moves a value one place (`delta` −1 or +1); the drag handle and the arrow buttons both end here. */
export function moveValue(draft: OptionsDraft, groupIndex: number, valueIndex: number, delta: number): OptionsDraft {
  const group = draft[groupIndex];
  if (group === undefined) return draft;
  const values = moved(group.values, valueIndex, delta);
  return values === group.values ? draft : withValues(draft, groupIndex, values);
}

/** Adds an option without values; a blank or repeated name, or a fourth option, leaves the draft as it is. */
export function addGroup(draft: OptionsDraft, typed: string): OptionsDraft {
  const name = typed.trim();
  if (name === '' || draft.length >= MAX_OPTION_GROUPS) return draft;
  const names = draft.map((group) => group.name);
  return holds(names, name) ? draft : [...draft, { name, values: [] }];
}

export const removeGroup = (draft: OptionsDraft, groupIndex: number): OptionsDraft =>
  draft.filter((_, index) => index !== groupIndex);

export const moveGroup = (draft: OptionsDraft, groupIndex: number, delta: number): OptionsDraft =>
  moved(draft, groupIndex, delta);

/** The option names in order, compared the server's way. */
const groupKeys = (draft: OptionsDraft): string => JSON.stringify(draft.map((group) => catalogNameKey(group.name)));

/**
 * Whether saving `draft` over `saved` replaces every variant: variants are matched by their values in option order,
 * so adding, removing or reordering an option keeps none of them (D2124) and the editor asks first.
 */
export const resetsVariants = (saved: OptionsDraft, draft: OptionsDraft): boolean =>
  groupKeys(saved) !== groupKeys(draft);
