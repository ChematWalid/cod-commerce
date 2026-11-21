import { exportInputSchema } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import type { RequestContext } from '@vendure/core';
import { ExportProductsService } from '../application/export-products.service';
import { ExportStatusService } from '../application/export-status.service';
import type { ExportView } from '../application/export-view';
import { asOperationContext } from '../application/ports/operation-context';
import { ImportRequestActors } from './actor-of';
import { ImportThrottle } from './import-throttle';
import { parseImportInput } from './request-body';
import { scopeOf } from './store-scope-of';

/** An export as both API surfaces answer it (`CatalogExport`). */
export type CatalogExportDto = ExportView;

/**
 * The input without its top-level `null` fields: an unset GraphQL variable or field means "not given" (the export
 * schema reads absent fields only).
 */
function withoutNullFields(input: unknown): unknown {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return input;
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== null));
}

/**
 * The export paths of both API surfaces: spend the business's budget, parse the input, take the tenant from the
 * request (never from the path or channel, D2236) and run the use case. Export and its read need
 * `catalog.products.view` (D2207).
 */
@Injectable()
export class ExportActions {
  constructor(
    private readonly exports: ExportProductsService,
    private readonly statuses: ExportStatusService,
    private readonly actors: ImportRequestActors,
    private readonly throttle: ImportThrottle,
  ) {}

  /** Starts an export; the budget is spent before parsing, so a malformed input counts too (D2217). */
  async export(ctx: RequestContext, input: unknown): Promise<CatalogExportDto> {
    const scope = scopeOf(ctx);
    await this.throttle.spendExport(scope.businessId);
    const command = parseImportInput(exportInputSchema, withoutNullFields(input));
    const actor = await this.actors.actorOf(ctx);
    return this.exports.export(asOperationContext(ctx), scope, actor, command);
  }

  /** The export `id` of the caller's store; anything else is `catalog-import.job-not-found`. */
  status(ctx: RequestContext, id: unknown): Promise<CatalogExportDto> {
    return this.statuses.status(asOperationContext(ctx), scopeOf(ctx), typeof id === 'string' ? id : '');
  }
}
