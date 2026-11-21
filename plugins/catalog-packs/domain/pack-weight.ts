import type { PackWeighting } from './pack';

/** A component line as weighing sees it: its product's grams (none counts as 0) and its quantity. */
export interface WeighedComponent {
  readonly weightGrams: number | null;
  readonly quantity: number;
}

/** The weight of a pack in grams (D2202): its fixed grams, or Σ component weight × quantity. */
export function packWeight(pack: PackWeighting, components: readonly WeighedComponent[]): number {
  if (pack.packWeightMode === 'fixed') return pack.packFixedWeightGrams ?? 0;
  return components.reduce((sum, component) => sum + (component.weightGrams ?? 0) * component.quantity, 0);
}
