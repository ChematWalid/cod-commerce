import { Injectable } from '@nestjs/common';
import { CreateProductService } from '../application/create-product.service';
import { CreateProductWithVariantsService } from '../application/create-product-with-variants.service';
import { GetProductService } from '../application/get-product.service';
import { ProductLookupService } from '../application/product-lookup.service';
import { SetProductStatusService } from '../application/set-product-status.service';
import { UpdateProductService } from '../application/update-product.service';
import { WritePackValuesService } from '../application/write-pack-values.service';
import { PgProductLock } from './pg-product-lock';

/** The product use cases the write facade runs, injected together. */
@Injectable()
export class CatalogCommandWrites {
  constructor(
    readonly creating: CreateProductService,
    readonly creatingWithVariants: CreateProductWithVariantsService,
    readonly updating: UpdateProductService,
    readonly statuses: SetProductStatusService,
  ) {}
}

/** The product use cases the write facade reads through, injected together. */
@Injectable()
export class CatalogCommandReads {
  constructor(
    readonly reading: GetProductService,
    readonly lookup: ProductLookupService,
  ) {}
}

/** What the facade's two pack entries run on: the pack-write use case and the product locks a pack save holds. */
@Injectable()
export class CatalogPackEntries {
  constructor(
    readonly writing: WritePackValuesService,
    readonly locks: PgProductLock,
  ) {}
}
