import { requirePermission } from '@cod/plugin-rbac/guard';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, type RequestContext } from '@vendure/core';
import { withImportErrors } from './error-mapping';
import {
  type CatalogImportDto,
  type CatalogImportPreviewDto,
  type CatalogImportUploadDto,
  ImportActions,
} from './import-actions';
import { IMPORT_PERMISSIONS } from './permissions';

/** A presigned upload as GraphQL answers it: the signed headers as name/value pairs. */
type CatalogImportUploadGql = Omit<CatalogImportUploadDto, 'headers'> & {
  readonly headers: readonly { readonly name: string; readonly value: string }[];
};

/** Spreadsheet import on the Admin API; the same actions as the REST routes (D2206), every step needs create (D2207). */
@Resolver()
export class ImportResolver {
  constructor(private readonly actions: ImportActions) {}

  /** Starts an upload of the active store: the import id and the presigned PUT. */
  @Mutation()
  @requirePermission(IMPORT_PERMISSIONS.create)
  createCatalogImportUpload(
    @Ctx() ctx: RequestContext,
    @Args('input') input: unknown,
  ): Promise<CatalogImportUploadGql> {
    return withImportErrors(async () => {
      const upload = await this.actions.upload(ctx, input);
      const headers = Object.entries(upload.headers).map(([name, value]) => ({ name, value }));
      return { ...upload, headers };
    });
  }

  /** Analyzes the uploaded file of an import of the active store. */
  @Mutation()
  @requirePermission(IMPORT_PERMISSIONS.create)
  analyzeCatalogImport(@Ctx() ctx: RequestContext, @Args('input') input: unknown): Promise<CatalogImportDto> {
    return withImportErrors(() => this.actions.analyze(ctx, input));
  }

  /** An import of the active store, with a fresh error report link once done. */
  @Query()
  @requirePermission(IMPORT_PERMISSIONS.create)
  catalogImport(@Ctx() ctx: RequestContext, @Args('id') id: unknown): Promise<CatalogImportDto> {
    return withImportErrors(() => this.actions.status(ctx, id));
  }

  /** A page of an import's stored preview (at most 200 rows). */
  @Query()
  @requirePermission(IMPORT_PERMISSIONS.create)
  catalogImportPreview(
    @Ctx() ctx: RequestContext,
    @Args() args: { id?: unknown; skip?: unknown; take?: unknown },
  ): Promise<CatalogImportPreviewDto> {
    const query = {
      ...(args.skip == null ? {} : { skip: args.skip }),
      ...(args.take == null ? {} : { take: args.take }),
    };
    return withImportErrors(() => this.actions.page(ctx, args.id, query));
  }

  /** Computes an import's preview, with the merchant's column mapping when given. */
  @Mutation()
  @requirePermission(IMPORT_PERMISSIONS.create)
  previewCatalogImport(
    @Ctx() ctx: RequestContext,
    @Args() args: { id?: unknown; input?: unknown },
  ): Promise<CatalogImportPreviewDto> {
    return withImportErrors(() => this.actions.preview(ctx, args.id, args.input));
  }

  /** Confirms an import's preview; the worker applies exactly its stored rows. */
  @Mutation()
  @requirePermission(IMPORT_PERMISSIONS.create)
  confirmCatalogImport(@Ctx() ctx: RequestContext, @Args('id') id: unknown): Promise<CatalogImportDto> {
    return withImportErrors(() => this.actions.confirm(ctx, id));
  }
}
