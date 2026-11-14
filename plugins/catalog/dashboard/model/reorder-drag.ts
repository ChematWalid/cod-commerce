/** The drag data format: plain text, the one every browser accepts. */
const REORDER_DRAG_FORMAT = 'text/plain';

/** The part of a drag's `DataTransfer` a reorder writes (structural: the model has no DOM types). */
export interface ReorderTransfer {
  effectAllowed: string;
  setData: (format: string, data: string) => void;
}

/**
 * Starts the drag of the item at `position`: Firefox starts no drag without data, and the effect tells the browser
 * this is a move.
 */
export function startReorderDrag(transfer: ReorderTransfer, position: number): void {
  transfer.setData(REORDER_DRAG_FORMAT, String(position));
  transfer.effectAllowed = 'move';
}
