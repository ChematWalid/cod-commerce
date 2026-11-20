import { COLLECTION_POSITION_MAX, COLLECTIONS_ERROR_CODES, type CollectionMode } from '@cod/shared';
import type {
  CreateStoreCollectionInput,
  StoreCollectionDto,
  StoreCollectionRuleDto,
  UpdateStoreCollectionInput,
} from '../dto';
import { type ManualProduct, productIdsOf, sameOrder } from './manual-order';

/** Everything the collection editor edits; text and the position are kept as typed and parsed on save. */
export interface CollectionForm {
  readonly title: string;
  readonly slug: string;
  readonly description: string;
  readonly featuredAssetId: string | null;
  readonly visible: boolean;
  readonly position: string;
  readonly mode: CollectionMode;
  /** The automatic rule; kept while the mode is manual so a switch back does not lose it, sent only when automatic. */
  readonly rule: StoreCollectionRuleDto | null;
  /** The hand-ordered products (manual), or the current members as last read (automatic). */
  readonly products: readonly ManualProduct[];
}

export type CollectionFormField = keyof CollectionForm;
/** A catalogue id per field the form or the server refuses. */
export type CollectionFormErrors = Partial<Record<CollectionFormField, string>>;

export const TITLE_REQUIRED_MESSAGE_ID = 'collections.error-title-required';
export const POSITION_MESSAGE_ID = 'collections.error-position';

/** An untyped field. A named constant, as the catalogue scan reads a literal `title` value as a message id. */
const NOTHING_TYPED = '';
const WHOLE_NUMBER = /^\d+$/;

/** A new collection: manual, visible, first in the store's order. */
export const emptyCollectionForm = (): CollectionForm => ({
  title: NOTHING_TYPED,
  slug: '',
  description: '',
  featuredAssetId: null,
  visible: true,
  position: '0',
  mode: 'manual',
  rule: null,
  products: [],
});

/** A saved collection and its products as the editor's form, the one a later save compares with. */
export const collectionFormOf = (
  collection: StoreCollectionDto,
  products: readonly ManualProduct[],
): CollectionForm => ({
  title: collection.title,
  slug: collection.slug,
  description: collection.description ?? '',
  featuredAssetId: collection.featuredAsset?.id ?? null,
  visible: collection.visible,
  position: String(collection.position),
  mode: collection.mode,
  rule: collection.rule,
  products,
});

/** The position typed, or undefined when it is no whole number of `0..9999` (D2318). */
function positionOf(text: string): number | undefined {
  const trimmed = text.trim();
  if (!WHOLE_NUMBER.test(trimmed)) return undefined;
  const position = Number(trimmed);
  return position <= COLLECTION_POSITION_MAX ? position : undefined;
}

const hasRule = (form: CollectionForm): boolean => form.rule !== null && form.rule.conditions.length > 0;

/** What the form refuses before the server is asked (the server checks again). */
export function collectionFormErrors(form: CollectionForm): CollectionFormErrors {
  const checks: readonly [CollectionFormField, boolean, string][] = [
    ['title', form.title.trim() !== '', TITLE_REQUIRED_MESSAGE_ID],
    ['position', positionOf(form.position) !== undefined, POSITION_MESSAGE_ID],
    ['rule', form.mode === 'manual' || hasRule(form), COLLECTIONS_ERROR_CODES.RULE_INVALID],
  ];
  return Object.fromEntries(checks.filter(([, valid]) => !valid).map(([field, , messageId]) => [field, messageId]));
}

/** The create of a valid form: blank optional fields left out, the rule only in automatic mode (D2302). */
export function createInputOf(form: CollectionForm): CreateStoreCollectionInput {
  return {
    title: form.title,
    ...(form.slug.trim() === '' ? {} : { slug: form.slug }),
    ...(form.description === '' ? {} : { description: form.description }),
    ...(form.featuredAssetId === null ? {} : { featuredAssetId: form.featuredAssetId }),
    visible: form.visible,
    position: positionOf(form.position) ?? 0,
    mode: form.mode,
    ...(form.mode === 'automatic' && form.rule !== null ? { rule: form.rule } : {}),
  };
}

const sameRule = (left: StoreCollectionRuleDto | null, right: StoreCollectionRuleDto | null): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

/** The mode and rule part of an update: a switch sends the mode (and the rule when automatic), an edit the rule. */
function modePatchOf(saved: CollectionForm, form: CollectionForm): UpdateStoreCollectionInput {
  const rule = form.mode === 'automatic' && form.rule !== null ? { rule: form.rule } : {};
  if (saved.mode !== form.mode) return { mode: form.mode, ...rule };
  return form.mode === 'automatic' && !sameRule(saved.rule, form.rule) ? rule : {};
}

/**
 * The update of a valid form: only what differs from `saved`. A blank slug keeps the saved one; a cleared description
 * or image is sent as `null`.
 */
export function updateInputOf(saved: CollectionForm, form: CollectionForm): UpdateStoreCollectionInput {
  const changed = (key: CollectionFormField): boolean => saved[key] !== form[key];
  return {
    ...(changed('title') ? { title: form.title } : {}),
    ...(changed('slug') && form.slug.trim() !== '' ? { slug: form.slug } : {}),
    ...(changed('description') ? { description: form.description === '' ? null : form.description } : {}),
    ...(changed('featuredAssetId') ? { featuredAssetId: form.featuredAssetId } : {}),
    ...(changed('visible') ? { visible: form.visible } : {}),
    ...(changed('position') ? { position: positionOf(form.position) ?? 0 } : {}),
    ...modePatchOf(saved, form),
  };
}

export const isEmptyUpdate = (input: UpdateStoreCollectionInput): boolean => Object.keys(input).length === 0;

/**
 * The products to set after the save: a manual collection's list when it is new and not empty, or when its order
 * differs from the saved one; otherwise null (nothing to send).
 */
export function productIdsToSet(saved: CollectionForm | null, form: CollectionForm): readonly string[] | null {
  if (form.mode !== 'manual') return null;
  if (saved === null) return form.products.length > 0 ? productIdsOf(form.products) : null;
  return sameOrder(saved.products, form.products) ? null : productIdsOf(form.products);
}

/** A saved manual collection turned automatic loses its hand-picked list and order, so the editor asks first (D2339). */
export const needsModeConfirmation = (saved: CollectionForm | null, form: CollectionForm): boolean =>
  saved !== null && saved.mode === 'manual' && form.mode === 'automatic';

/** What Save does with the form: show the refused fields, ask first (D2339), or send it. */
export type SaveStep =
  | { readonly kind: 'invalid'; readonly errors: CollectionFormErrors }
  | { readonly kind: 'confirm' }
  | { readonly kind: 'send' };

/** The form is checked before the D2339 question: a form that cannot be saved never asks to replace the list. */
export function saveStepOf(saved: CollectionForm | null, form: CollectionForm): SaveStep {
  const errors = collectionFormErrors(form);
  if (Object.keys(errors).length > 0) return { kind: 'invalid', errors };
  return needsModeConfirmation(saved, form) ? { kind: 'confirm' } : { kind: 'send' };
}

/**
 * The saved form and the shown one after a save of `sent`. The saved one is built from what was sent, so an edit made
 * while the save was pending still differs from it and goes out with the next save; the shown form is replaced only
 * when nothing was edited meanwhile.
 */
export function formsAfterSave(
  collection: StoreCollectionDto,
  sent: CollectionForm,
  current: CollectionForm,
): { readonly saved: CollectionForm; readonly form: CollectionForm } {
  const saved = collectionFormOf(collection, sent.products);
  return { saved, form: current === sent ? saved : current };
}

/** The field each server refusal belongs to, so it shows under that field. */
const FIELD_OF_CODE: Readonly<Record<string, CollectionFormField>> = {
  [COLLECTIONS_ERROR_CODES.SLUG_TAKEN]: 'slug',
  [COLLECTIONS_ERROR_CODES.IMAGE_NOT_FOUND]: 'featuredAssetId',
  [COLLECTIONS_ERROR_CODES.TOO_MANY_PRODUCTS]: 'products',
  [COLLECTIONS_ERROR_CODES.PRODUCT_NOT_FOUND]: 'products',
  [COLLECTIONS_ERROR_CODES.NOT_MANUAL]: 'products',
  [COLLECTIONS_ERROR_CODES.RULE_INVALID]: 'rule',
};

/** The field error of a server code, or none when the code belongs to no field. */
export function fieldErrorsOfCode(code: string | undefined): CollectionFormErrors {
  const field = code === undefined ? undefined : FIELD_OF_CODE[code];
  return field === undefined || code === undefined ? {} : { [field]: code };
}

export type SubmitOutcome<T> =
  { readonly kind: 'invalid'; readonly errors: CollectionFormErrors } | { readonly kind: 'sent'; readonly answer: T };

/** Sends the form with `send` only when nothing in it is refused; otherwise answers the refused fields. */
export async function submitCollection<T>(
  form: CollectionForm,
  send: (form: CollectionForm) => Promise<T>,
): Promise<SubmitOutcome<T>> {
  const errors = collectionFormErrors(form);
  if (Object.keys(errors).length > 0) return { kind: 'invalid', errors };
  return { kind: 'sent', answer: await send(form) };
}
