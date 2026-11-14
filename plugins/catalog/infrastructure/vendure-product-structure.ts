import { Injectable } from '@nestjs/common';
import { DefaultChannelExit } from './vendure-default-channel';
import { VendureOptionSync } from './vendure-option-sync';
import { VendureVariantSync } from './vendure-variant-sync.adapter';

/** What a product save writes under the product: its options, its variants, and its exit from the default channel. */
@Injectable()
export class VendureProductStructure {
  constructor(
    readonly options: VendureOptionSync,
    readonly variants: VendureVariantSync,
    readonly defaultChannel: DefaultChannelExit,
  ) {}
}
