import type { PackRecord } from '../domain/pack';

/** A stored pack and what its product stores: what a read and a save answer. */
export interface PackView {
  readonly pack: PackRecord;
  readonly price: number;
  readonly weightGrams: number | null;
}

/** One value of a shared-option pack and its price. */
export interface PackPreviewValue {
  readonly value: string;
  readonly price: number;
}

/** What a preview answers: the default price, the weight and the price of each shared value. */
export interface PackPreview {
  readonly price: number;
  readonly weightGrams: number;
  readonly sharedValues: readonly PackPreviewValue[];
}
