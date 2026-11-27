import { Injectable } from '@nestjs/common';
import { AdjustPricesService } from '../application/adjust-prices.service';
import { DeleteFeeGroupService } from '../application/delete-fee-group.service';
import { DuplicateFeeGroupService } from '../application/duplicate-fee-group.service';
import { FeeGroupReadService } from '../application/fee-group-read.service';
import { PricingCsvExportService } from '../application/pricing-csv-export.service';
import { PricingCsvImportService } from '../application/pricing-csv-import.service';
import { SaveFeeGroupService } from '../application/save-fee-group.service';
import { SetCommunePricesService } from '../application/set-commune-prices.service';
import { SetCommuneRatesService } from '../application/set-commune-rates.service';

/** The fee-group use cases that read or edit one group, injected together. */
@Injectable()
export class FeeGroupUseCases {
  constructor(
    readonly reading: FeeGroupReadService,
    readonly saving: SaveFeeGroupService,
    readonly deleting: DeleteFeeGroupService,
    readonly communes: SetCommuneRatesService,
  ) {}
}

/** The bulk price tools and the copy of a group (D3140), injected together. */
@Injectable()
export class FeeGroupBulkUseCases {
  constructor(
    readonly adjusting: AdjustPricesService,
    readonly communePrices: SetCommunePricesService,
    readonly duplicating: DuplicateFeeGroupService,
  ) {}
}

/** The CSV export and import of a group (D3142), injected together. */
@Injectable()
export class FeeGroupCsvUseCases {
  constructor(
    readonly exporting: PricingCsvExportService,
    readonly importing: PricingCsvImportService,
  ) {}
}
