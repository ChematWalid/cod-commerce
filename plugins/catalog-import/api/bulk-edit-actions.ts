import { bulkEditInputSchema } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import type { RequestContext } from '@vendure/core';
import { BulkEditService } from '../application/bulk-edit.service';
import { asOperationContext } from '../application/ports/operation-context';
import { ImportRequestActors } from './actor-of';
import { ImportThrottle } from './import-throttle';
import { parseImportInput } from './request-body';
import { scopeOf } from './store-scope-of';

/** One product's line of a bulk-edit answer, as both API surfaces give it. */
export interface CatalogBulkEditProductResultDto {
  readonly productId: string;
  readonly productTitle: string | null;
  readonly ok: boolean;
  readonly changedFields: readonly string[];
  readonly error: string | null;
}

/** What a bulk edit answers (`CatalogBulkEditResult`): one line per distinct product named. */
export interface CatalogBulkEditResultDto {
  readonly results: readonly CatalogBulkEditProductResultDto[];
}

/**
 * The bulk-edit path of both API surfaces: spend the caller's budget, parse the input, take the tenant from the
 * request (never from the path or channel, D2236), identify the actor for the activity rows and run the use case.
 */
@Injectable()
export class BulkEditActions {
  constructor(
    private readonly bulkEdit: BulkEditService,
    private readonly actors: ImportRequestActors,
    private readonly throttle: ImportThrottle,
  ) {}

  /** Edits the products the input names; the budget is spent before parsing, so a malformed input counts too (D2217). */
  async edit(ctx: RequestContext, input: unknown): Promise<CatalogBulkEditResultDto> {
    const scope = scopeOf(ctx);
    await this.throttle.spendBulkEdit(scope.businessId, String(ctx.activeUserId));
    const command = parseImportInput(bulkEditInputSchema, input);
    const actor = await this.actors.actorOf(ctx);
    const results = await this.bulkEdit.edit(asOperationContext(ctx), scope, actor, command);
    return { results: results.map((result) => ({ ...result, changedFields: [...result.changedFields] })) };
  }
}
