import { ActivityRecordEvent } from '@cod/plugin-rbac/member-access';
import {
  ACTIVITY_ACTIONS,
  ACTIVITY_ENTITY_TYPES,
  productBulkEditDiffSchema,
  productExportDiffSchema,
} from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { EventBus } from '@vendure/core';
import type { ExportActivity, ExportActivityPort } from '../application/ports/export-activity.port';
import type { OperationContext } from '../application/ports/operation-context';
import type { ProductActivityPort, ProductBulkEditActivity } from '../application/ports/product-activity.port';
import { toRequestContext } from './request-context';

/** The summary of a bulk-edit row; the dashboard reads the diff, this is for the log's plain view. */
const summaryOf = (changedFields: readonly string[]): string => `Bulk edit: ${changedFields.join(', ')}`;

/** The summary of an export row: counts and format only, never product text. */
const exportSummaryOf = (activity: ExportActivity): string =>
  `Export: ${String(activity.rowCount)} rows (${activity.format})`;

/**
 * {@link ProductActivityPort} and {@link ExportActivityPort} on rbac's activity log, through its blocking event: the
 * row joins the caller's transaction (D66, D2213). Each diff is parsed by its shared strict schema first, so only
 * field names, counts and words are logged.
 */
@Injectable()
export class ProductActivityAdapter implements ProductActivityPort, ExportActivityPort {
  constructor(private readonly events: EventBus) {}

  async recordBulkEdit(ctx: OperationContext, activity: ProductBulkEditActivity): Promise<void> {
    const { scope, productId, actor } = activity;
    const diff = productBulkEditDiffSchema.parse({ changedFields: [...activity.changedFields] });
    await this.events.publish(
      new ActivityRecordEvent(
        toRequestContext(ctx),
        {
          storeId: scope.storeId,
          actorAdministratorId: actor.administratorId,
          action: ACTIVITY_ACTIONS.CATALOG_PRODUCTS_BULK_EDITED,
          entityType: ACTIVITY_ENTITY_TYPES.PRODUCT,
          entityId: productId,
          summary: summaryOf(diff.changedFields),
          diff,
          ip: actor.ip,
          userAgent: actor.userAgent,
        },
        { businessId: scope.businessId },
      ),
    );
  }

  async recordExport(ctx: OperationContext, activity: ExportActivity): Promise<void> {
    const { scope, actor } = activity;
    const diff = productExportDiffSchema.parse({
      scope: activity.exportScope,
      format: activity.format,
      rowCount: activity.rowCount,
      skippedPacks: activity.skippedPacks,
    });
    await this.events.publish(
      new ActivityRecordEvent(
        toRequestContext(ctx),
        {
          storeId: scope.storeId,
          actorAdministratorId: actor.administratorId,
          action: ACTIVITY_ACTIONS.CATALOG_PRODUCTS_EXPORTED,
          entityType: ACTIVITY_ENTITY_TYPES.CATALOG_JOB,
          entityId: activity.exportId,
          summary: exportSummaryOf(activity),
          diff,
          ip: actor.ip,
          userAgent: actor.userAgent,
        },
        { businessId: scope.businessId },
      ),
    );
  }
}
