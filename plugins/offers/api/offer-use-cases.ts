import { Injectable } from '@nestjs/common';
import { OfferAdminService } from '../application/offer-admin.service';
import { OfferAppTypeService } from '../application/offer-app-type.service';
import { OfferCodesService } from '../application/offer-codes.service';
import { OfferLifecycleService } from '../application/offer-lifecycle.service';
import { OfferPreviewService } from '../application/offer-preview.service';
import { OfferStatsService } from '../application/offer-stats.service';

/** The offer use cases that read and write stored offers and codes, injected together. */
@Injectable()
export class OfferWriteUseCases {
  constructor(
    readonly admin: OfferAdminService,
    readonly lifecycle: OfferLifecycleService,
    readonly codes: OfferCodesService,
  ) {}
}

/** The offer use cases that only compute: stats, app types and the preview, injected together. */
@Injectable()
export class OfferReadUseCases {
  constructor(
    readonly stats: OfferStatsService,
    readonly appTypes: OfferAppTypeService,
    readonly preview: OfferPreviewService,
  ) {}
}
