import { requirePermission } from '@cod/plugin-rbac/guard';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, type RequestContext } from '@vendure/core';
import { type DeliveryFeeCsvImportDto, type DeliveryFeeGroupCsvDto, toCsvFileDto } from './csv-dto';
import { withDeliveryPricingErrors } from './error-mapping';
import { FeeGroupCsvActions } from './fee-group-csv-actions';
import { DELIVERY_PRICING_PERMISSIONS as P } from './permissions';

/** The CSV export and import of the active store's fee groups on the Admin API (D3142). */
@Resolver()
export class FeeGroupCsvResolver {
  constructor(private readonly actions: FeeGroupCsvActions) {}

  /** A fee group as CSV text, or `null` for a group the store does not hold (delivery.pricing.view). */
  @Query()
  @requirePermission(P.view)
  deliveryFeeGroupCsv(@Ctx() ctx: RequestContext, @Args('id') id: unknown): Promise<DeliveryFeeGroupCsvDto | null> {
    return withDeliveryPricingErrors(async () => {
      const file = await this.actions.exportCsv(ctx, id);
      return file === null ? null : toCsvFileDto(file);
    });
  }

  /** Previews (`dryRun`, the default) or applies a CSV upload to a fee group (delivery.pricing.edit). */
  @Mutation()
  @requirePermission(P.edit)
  importDeliveryFeeGroupCsv(
    @Ctx() ctx: RequestContext,
    @Args('groupId') groupId: unknown,
    @Args('file') file: unknown,
    @Args('dryRun') dryRun: unknown,
  ): Promise<DeliveryFeeCsvImportDto> {
    return withDeliveryPricingErrors(() => this.actions.importUpload(ctx, groupId, file, dryRun));
  }
}
