import { Injectable } from '@nestjs/common';
import { CreateProductService } from '../application/create-product.service';
import { CreateProductWithVariantsService } from '../application/create-product-with-variants.service';
import { GetProductService } from '../application/get-product.service';
import { ProductLookupService } from '../application/product-lookup.service';
import { SetProductStatusService } from '../application/set-product-status.service';
import { UpdateProductService } from '../application/update-product.service';

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
