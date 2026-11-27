import type { Readable } from 'node:stream';
import { requirePermission } from '@cod/plugin-rbac/guard';
import { PRICING_CSV_MAX_BYTES } from '@cod/shared';
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  StreamableFile,
  UseFilters,
} from '@nestjs/common';
import { Ctx, type RequestContext } from '@vendure/core';
import { DeliveryFeeGroupNotFoundError } from '../domain/errors';
import type { DeliveryFeeCsvImportDto } from './csv-dto';
import { DeliveryPricingRestErrorFilter, restCall } from './error-mapping';
import { FeeGroupCsvActions } from './fee-group-csv-actions';
import { DELIVERY_PRICING_PERMISSIONS as P } from './permissions';
import { readBodyAtMost } from './read-upload';

/** The type of the export, which Excel opens as UTF-8 thanks to its byte order mark. */
const CSV_CONTENT_TYPE = 'text/csv; charset=utf-8';

/** The CSV export and import of the active store's fee groups for clients that do not speak GraphQL (D3142). */
@Controller('delivery-fees')
@UseFilters(DeliveryPricingRestErrorFilter)
export class FeeGroupCsvController {
  constructor(private readonly actions: FeeGroupCsvActions) {}

  /** The group as a CSV download (delivery.pricing.view); 404 `delivery-pricing.not-found` otherwise. */
  @Get(':id/export')
  @requirePermission(P.view)
  exportCsv(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<StreamableFile> {
    return restCall(async () => {
      const file = await this.actions.exportCsv(ctx, id);
      if (file === null) throw new DeliveryFeeGroupNotFoundError();
      return new StreamableFile(Buffer.from(file.bytes), {
        type: CSV_CONTENT_TYPE,
        disposition: `attachment; filename="${file.fileName}"`,
      });
    });
  }

  /**
   * Previews or applies a CSV sent as the raw body (`Content-Type: text/csv`) to a group (delivery.pricing.edit):
   * `?dryRun=false` applies, anything else absent previews. 400 for a bad file or refused rows, 413 above the cap.
   */
  @Post(':id/import')
  @HttpCode(HttpStatus.OK)
  @requirePermission(P.edit)
  importCsv(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Query('dryRun') dryRun: unknown,
    @Req() request: Readable,
  ): Promise<DeliveryFeeCsvImportDto> {
    return restCall(async () => {
      const bytes = await readBodyAtMost(request, PRICING_CSV_MAX_BYTES + 1);
      return this.actions.importBytes(ctx, id, bytes, dryRun);
    });
  }
}
