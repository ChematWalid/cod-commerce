import type { EditorForm, VariantDraft } from './editor-form';
import { isPackForm } from './editor-pack';

/** What the editor holds: the form as typed and what was last saved, which the patch diffs against. */
export interface EditorDraftState {
  readonly form: EditorForm;
  readonly saved: EditorForm;
}

/** The fields catalog-packs writes on a pack save; the editor shows them read-only (D2233). */
const PACK_WRITTEN_FIELDS = ['price', 'oldPrice', 'weight', 'options', 'variants'] as const;

/** Variant fields that stay the merchant's on a pack (D2232). */
const MERCHANT_VARIANT_FIELDS = ['sku', 'isHidden', 'featuredAssetId'] as const;

const sameValue = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);

/** `fresh`'s row with the merchant's unsaved SKU, hidden and image edits of that row, if it is still there. */
function withUnsavedEdits(
  fresh: VariantDraft,
  typed: ReadonlyMap<string, VariantDraft>,
  saved: ReadonlyMap<string, VariantDraft>,
): VariantDraft {
  const row = typed.get(fresh.id);
  const before = saved.get(fresh.id);
  if (row === undefined || before === undefined) return fresh;
  const edits = MERCHANT_VARIANT_FIELDS.filter((field) => row[field] !== before[field]);
  return { ...fresh, ...Object.fromEntries(edits.map((field) => [field, row[field]])) };
}

const byId = (rows: readonly VariantDraft[]): ReadonlyMap<string, VariantDraft> =>
  new Map(rows.map((row) => [row.id, row]));

/**
 * The editor state once a fresh read of a pack shows values catalog-packs wrote since it opened (a pack block save):
 * its price, old price, weight, options and variants go into both the form and what was saved, the merchant's unsaved
 * edits of every other field (and of a surviving variant's SKU, hidden flag and image) are kept. `null` when the
 * product is not a pack or nothing catalog-packs writes changed (D2249).
 */
export function packRefreshOf(current: EditorDraftState, fresh: EditorForm): EditorDraftState | null {
  if (!isPackForm(current.saved) || !isPackForm(fresh)) return null;
  if (PACK_WRITTEN_FIELDS.every((field) => sameValue(current.saved[field], fresh[field]))) return null;
  const written = {
    price: fresh.price,
    oldPrice: fresh.oldPrice,
    weight: fresh.weight,
    options: fresh.options,
  };
  const typed = byId(current.form.variants);
  const saved = byId(current.saved.variants);
  return {
    form: { ...current.form, ...written, variants: fresh.variants.map((row) => withUnsavedEdits(row, typed, saved)) },
    saved: { ...current.saved, ...written, variants: fresh.variants },
  };
}
