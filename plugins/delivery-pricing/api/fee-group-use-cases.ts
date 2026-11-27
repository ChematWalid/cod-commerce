import { Injectable } from '@nestjs/common';
import { DeleteFeeGroupService } from '../application/delete-fee-group.service';
import { FeeGroupReadService } from '../application/fee-group-read.service';
import { SaveFeeGroupService } from '../application/save-fee-group.service';
import { SetCommuneRatesService } from '../application/set-commune-rates.service';

/** The fee-group use cases, injected together. */
@Injectable()
export class FeeGroupUseCases {
  constructor(
    readonly reading: FeeGroupReadService,
    readonly saving: SaveFeeGroupService,
    readonly deleting: DeleteFeeGroupService,
    readonly communes: SetCommuneRatesService,
  ) {}
}
