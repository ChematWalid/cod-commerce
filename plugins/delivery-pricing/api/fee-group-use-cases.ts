import { Injectable } from '@nestjs/common';
import { AdjustPricesService } from '../application/adjust-prices.service';
import { DeleteFeeGroupService } from '../application/delete-fee-group.service';
import { DuplicateFeeGroupService } from '../application/duplicate-fee-group.service';
import { FeeGroupReadService } from '../application/fee-group-read.service';
import { SaveFeeGroupService } from '../application/save-fee-group.service';
import { SetCommunePricesService } from '../application/set-commune-prices.service';
import { SetCommuneRatesService } from '../application/set-commune-rates.service';

/** The fee-group use cases, injected together. */
@Injectable()
export class FeeGroupUseCases {
  constructor(
    readonly reading: FeeGroupReadService,
    readonly saving: SaveFeeGroupService,
    readonly deleting: DeleteFeeGroupService,
    readonly communes: SetCommuneRatesService,
    readonly adjusting: AdjustPricesService,
    readonly communePrices: SetCommunePricesService,
    readonly duplicating: DuplicateFeeGroupService,
  ) {}
}
