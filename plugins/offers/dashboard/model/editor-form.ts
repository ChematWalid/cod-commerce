import {
  type CombinesWith,
  INT_COLUMN_MAX,
  type OfferAppType,
  type OfferEligibility,
  type OfferMethod,
  type OfferTargetRole,
  PRICING_ERROR_CODES,
  type PublishProblem,
  type TargetRefType,
} from '@cod/shared';
import type { OfferViewDto } from '../dto';
import { algeriaInputOf, instantOfAlgeriaInput } from './algeria-time';
import { defaultConfigOf } from './default-configs';

/** A target as the editor holds it: the API's shape (D2501). */
export interface TargetDraft {
  readonly role: OfferTargetRole;
  readonly refType: TargetRefType;
  readonly refId: string;
}

/** When the offer starts: when it is published, or at a typed date (Algeria time). */
export type StartMode = 'publish' | 'date';

/** The offer's text per language, as typed (`''` or absent is none). */
export type LabelDraft = Readonly<Partial<Record<'ar' | 'fr' | 'en', string>>>;

/**
 * Everything the offer editor edits. Text and numbers are kept as typed and parsed on save; `config` belongs to the
 * kind's editor (Task 14) and is sent as it stands. `appTypeId` picks that editor (D2523).
 */
export interface OfferEditorForm {
  readonly appTypeId: string;
  readonly kind: string;
  readonly method: OfferMethod;
  readonly title: string;
  readonly label: LabelDraft;
  readonly config: unknown;
  readonly targets: readonly TargetDraft[];
  readonly eligibility: OfferEligibility;
  readonly combinesWith: CombinesWith;
  readonly startMode: StartMode;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly totalUsageLimit: string;
  readonly perBuyerLimit: string;
}

/** The parts of the editor a refusal points at. */
export type EditorField = PublishProblem | 'limits';
/** A catalogue id per refused part of the form. */
export type OfferFormErrors = Partial<Record<EditorField, string>>;

export const TITLE_MESSAGE_ID = 'offers.editor-error-title';
export const TARGETS_MESSAGE_ID = 'offers.editor-error-targets';
export const DATES_MESSAGE_ID = 'offers.editor-error-dates';
export const LIMIT_MESSAGE_ID = 'offers.editor-error-limit';

/** The field and message of each publish problem (D2510). */
const PROBLEM_MESSAGE_IDS: Readonly<Record<PublishProblem, string>> = {
  title: TITLE_MESSAGE_ID,
  targets: TARGETS_MESSAGE_ID,
  dates: DATES_MESSAGE_ID,
};

/** An untyped field. A named constant, as the catalogue scan reads a literal `title` value as a message id. */
const NOTHING_TYPED = '';
const NO_COMBINATION: CombinesWith = { order: false, product: false, delivery: false };
const EVERYONE_EVERYWHERE: OfferEligibility = { audience: 'everyone', channels: [], wilayas: [], deliveryMethods: [] };

/** A new offer of `appType`; a product named by the editor link (the product editor's block) is its buy target. */
export function emptyOfferForm(appType: OfferAppType, productId: string | null): OfferEditorForm {
  return {
    appTypeId: appType.id,
    kind: appType.kind,
    method: appType.method,
    title: NOTHING_TYPED,
    label: {},
    config: defaultConfigOf(appType.id),
    targets: productId === null ? [] : [{ role: 'buy', refType: 'product', refId: productId }],
    eligibility: EVERYONE_EVERYWHERE,
    combinesWith: NO_COMBINATION,
    startMode: 'publish',
    startsAt: '',
    endsAt: '',
    totalUsageLimit: '',
    perBuyerLimit: '',
  };
}

const textOf = (value: number | null): string => (value === null ? '' : String(value));

/** A saved offer as the editor's form; the form the editor compares with to send only what changed. */
export function offerFormOf(offer: OfferViewDto, appTypeId: string): OfferEditorForm {
  return {
    appTypeId,
    kind: offer.kind,
    method: offer.method,
    title: offer.title,
    label: offer.label,
    config: offer.config,
    targets: offer.targets,
    eligibility: offer.eligibility,
    combinesWith: offer.combinesWith,
    startMode: offer.startsAt === null ? 'publish' : 'date',
    startsAt: algeriaInputOf(offer.startsAt),
    endsAt: algeriaInputOf(offer.endsAt),
    totalUsageLimit: textOf(offer.totalUsageLimit),
    perBuyerLimit: textOf(offer.perBuyerLimit),
  };
}

/** The card a saved offer was made from: the same kind and method, else the same kind, else the kind itself. */
export function appTypeIdOf(offer: Pick<OfferViewDto, 'kind' | 'method'>, appTypes: readonly OfferAppType[]): string {
  const exact = appTypes.find((type) => type.kind === offer.kind && type.method === offer.method);
  return (exact ?? appTypes.find((type) => type.kind === offer.kind))?.id ?? offer.kind;
}

const WHOLE_NUMBER = /^\d+$/;

/** A typed usage limit: `null` when blank, `undefined` when it is not a whole number from 1 (D2535). */
export function usageLimitOf(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  if (!WHOLE_NUMBER.test(trimmed)) return undefined;
  const value = Number(trimmed);
  return value >= 1 && value <= INT_COLUMN_MAX ? value : undefined;
}

/** The start as an instant: `null` when the offer starts on publish. */
export const startInstantOf = (form: OfferEditorForm): string | null | undefined =>
  form.startMode === 'publish' ? null : instantOfAlgeriaInput(form.startsAt);

function datesAreValid(form: OfferEditorForm): boolean {
  const start = startInstantOf(form);
  const end = instantOfAlgeriaInput(form.endsAt);
  if (start === undefined || end === undefined) return false;
  if (form.startMode === 'date' && start === null) return false;
  return start === null || end === null || Date.parse(end) > Date.parse(start);
}

/**
 * What the form refuses before the server is asked (the server checks again): a blank title, a limit that is not a
 * whole number from 1, a missing or unreadable date, an end not after the start.
 */
export function editorFormErrors(form: OfferEditorForm): OfferFormErrors {
  const checks: readonly [EditorField, boolean, string][] = [
    ['title', form.title.trim() !== '', TITLE_MESSAGE_ID],
    [
      'limits',
      [form.totalUsageLimit, form.perBuyerLimit].every((text) => usageLimitOf(text) !== undefined),
      LIMIT_MESSAGE_ID,
    ],
    ['dates', datesAreValid(form), DATES_MESSAGE_ID],
  ];
  return Object.fromEntries(checks.filter(([, valid]) => !valid).map(([field, , messageId]) => [field, messageId]));
}

const isPublishProblem = (value: unknown): value is PublishProblem =>
  typeof value === 'string' && Object.hasOwn(PROBLEM_MESSAGE_IDS, value);

function extensionsOf(error: unknown): Readonly<Record<string, unknown>> | undefined {
  if (typeof error !== 'object' || error === null || !('extensions' in error)) return undefined;
  const { extensions } = error;
  return typeof extensions === 'object' && extensions !== null ? (extensions as Record<string, unknown>) : undefined;
}

/**
 * The fields a refused publish points at (`offers.publish-invalid` with its `problems`, D2535(d)), or `null` for any
 * other error, which is shown as its message instead.
 */
export function publishErrorsOf(error: unknown): OfferFormErrors | null {
  const extensions = extensionsOf(error);
  if (extensions?.['code'] !== PRICING_ERROR_CODES.PUBLISH_INVALID) return null;
  const problems = Array.isArray(extensions['problems']) ? extensions['problems'] : [];
  return Object.fromEntries(
    problems.filter(isPublishProblem).map((problem) => [problem, PROBLEM_MESSAGE_IDS[problem]]),
  );
}

/** What the editor link carries: the app type of a new offer and the product it is for (D2523, D2524). */
export interface EditorSearch {
  readonly type: string | null;
  readonly productId: string | null;
}

const DECIMAL_ID = /^\d+$/;

/** The text of a search value; the router parses `?productId=42` as the number 42. */
function searchTextOf(value: unknown): string | null {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return String(value);
  return typeof value === 'string' && value !== '' ? value : null;
}

/** Reads the editor link's search; a product id that is not a decimal id is left out. */
export function editorSearchOf(search: unknown): EditorSearch {
  const fields = typeof search === 'object' && search !== null ? (search as Record<string, unknown>) : {};
  const productId = searchTextOf(fields['productId']);
  return {
    type: searchTextOf(fields['type']),
    productId: productId !== null && DECIMAL_ID.test(productId) ? productId : null,
  };
}
