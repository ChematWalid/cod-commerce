import { CREATE_OFFERS_KEY, EDIT_OFFERS_KEY } from '../constants';
import type { OfferViewDto } from '../dto';

/** What the server says an offer allows: its moves and whether it may still be edited (D2543). */
export type OfferAllowance = Pick<OfferViewDto, 'allowedMoves' | 'editable'>;

/** What the editor's footer offers. */
export interface EditorAccess {
  /** Whether the form may be saved: the offer is editable and the caller holds the key the save asks for. */
  readonly canSave: boolean;
  /** Whether the offer is a draft to take live: a new one, or one the server lets publish. */
  readonly isDraft: boolean;
}

/**
 * The editor's controls, from what the server answers for `offer` (null for a new one) and the keys the caller holds;
 * the server checks each write again. The dashboard holds no lifecycle rule of its own (ADR 0017).
 */
export function editorAccessOf(offer: OfferAllowance | null, held: ReadonlySet<string>): EditorAccess {
  if (offer === null) return { canSave: held.has(CREATE_OFFERS_KEY), isDraft: true };
  return { canSave: offer.editable && held.has(EDIT_OFFERS_KEY), isDraft: offer.allowedMoves.includes('publish') };
}
