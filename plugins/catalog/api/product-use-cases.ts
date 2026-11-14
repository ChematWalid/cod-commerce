import { Injectable } from '@nestjs/common';
import { CreateProductService } from '../application/create-product.service';
import { DeleteProductService } from '../application/delete-product.service';
import { GetProductService } from '../application/get-product.service';
import { ListProductsService } from '../application/list-products.service';
import { SetProductStatusService } from '../application/set-product-status.service';
import { SlugAvailabilityService } from '../application/slug-availability.service';
import { UpdateProductService } from '../application/update-product.service';

/** The product use cases that write, injected together. */
@Injectable()
export class ProductWriteUseCases {
  constructor(
    readonly creating: CreateProductService,
    readonly updating: UpdateProductService,
    readonly statuses: SetProductStatusService,
    readonly deleting: DeleteProductService,
  ) {}
}

/** The product use cases that read, injected together. */
@Injectable()
export class ProductReadUseCases {
  constructor(
    readonly reading: GetProductService,
    readonly listing: ListProductsService,
    readonly slugs: SlugAvailabilityService,
  ) {}
}
