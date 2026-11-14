import { Injectable } from '@nestjs/common';
import { PgProductLock } from './pg-product-lock';
import { DefaultChannelExit } from './vendure-default-channel';
import { VendureOptionSync } from './vendure-option-sync';
import { VendureVariantSync } from './vendure-variant-sync.adapter';

/**
 * What a product save writes under the product (its options, its variants, its exit from the default channel) and the
 * lock that keeps two saves of one product apart.
 */
@Injectable()
export class VendureProductStructure {
  constructor(
    readonly options: VendureOptionSync,
    readonly variants: VendureVariantSync,
    readonly defaultChannel: DefaultChannelExit,
    readonly lock: PgProductLock,
  ) {}
}
