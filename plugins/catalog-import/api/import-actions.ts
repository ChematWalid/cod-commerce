import {
  analyzeInputSchema,
  importPreviewQuerySchema,
  previewMappingSchema,
  type PermissionKey,
  uploadInputSchema,
  vendurePermissionName,
} from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { ForbiddenError, type Permission, type RequestContext } from '@vendure/core';
import type { ImportUploadView } from '../application/create-upload.service';
import { ImportUseCases } from '../application/import-use-cases';
import type { ImportPreviewView, ImportView } from '../application/import-view';
import { asOperationContext } from '../application/ports/operation-context';
import { ConfirmNeedsEditError } from '../domain/errors';
import { ImportRequestActors } from './actor-of';
import { ImportThrottle } from './import-throttle';
import { IMPORT_PERMISSIONS } from './permissions';
import { parseImportInput } from './request-body';
import { scopeOf } from './store-scope-of';

/** An import as both API surfaces answer it (`CatalogImport`). */
export type CatalogImportDto = ImportView;
/** A page of an import's preview (`CatalogImportPreview`). */
export type CatalogImportPreviewDto = ImportPreviewView;
/** A started upload (`CatalogImportUpload`). */
export type CatalogImportUploadDto = ImportUploadView;

/** The id of a path or argument: anything but text is no id of an import. */
const idOf = (value: unknown): string => (typeof value === 'string' ? value : '');

/** A preview body or input without a mapping (absent, null or `{}`) recomputes with the stored mapping. */
const hasMapping = (input: unknown): boolean =>
  typeof input === 'object' && input !== null && (input as { mapping?: unknown }).mapping != null;

/**
 * The import paths of both API surfaces (D2206, D2207, D2217): the steps that read the file or write the catalog
 * (upload, analyze, preview with a mapping, confirm) spend the caller's budget before parsing; the tenant comes from
 * the request (never from the path or channel, D2236). Every step needs `catalog.products.create`; whether the actor
 * also holds `catalog.products.edit` decides update rows (D2207).
 */
@Injectable()
export class ImportActions {
  constructor(
    private readonly useCases: ImportUseCases,
    private readonly actors: ImportRequestActors,
    private readonly throttle: ImportThrottle,
  ) {}

  /** Starts an upload: the import job and its presigned PUT. */
  async upload(ctx: RequestContext, input: unknown): Promise<CatalogImportUploadDto> {
    const scope = await this.spend(ctx);
    const command = parseImportInput(uploadInputSchema, input);
    const actor = await this.actors.actorOf(ctx);
    return this.useCases.steps.uploads.create(asOperationContext(ctx), scope, actor.administratorId, command);
  }

  /** Analyzes the uploaded file of the import the input names. */
  async analyze(ctx: RequestContext, input: unknown): Promise<CatalogImportDto> {
    const scope = await this.spend(ctx);
    const { importId } = parseImportInput(analyzeInputSchema, input);
    return this.useCases.steps.analyses.analyze(asOperationContext(ctx), scope, importId);
  }

  /** The import `id` of the caller's store; anything else is `catalog-import.job-not-found`. */
  status(ctx: RequestContext, id: unknown): Promise<CatalogImportDto> {
    return this.useCases.steps.statuses.status(asOperationContext(ctx), scopeOf(ctx), idOf(id));
  }

  /** A page of the stored preview; not throttled, it reads stored rows only. */
  page(ctx: RequestContext, id: unknown, query: unknown): Promise<CatalogImportPreviewDto> {
    const page = parseImportInput(importPreviewQuerySchema, query ?? {});
    return this.useCases.steps.previews.page(asOperationContext(ctx), scopeOf(ctx), idOf(id), page);
  }

  /** Computes the preview again, with the merchant's mapping when the input carries one. */
  async preview(ctx: RequestContext, id: unknown, input: unknown): Promise<CatalogImportPreviewDto> {
    const scope = await this.spend(ctx);
    const overrides = hasMapping(input) ? parseImportInput(previewMappingSchema, input).mapping : undefined;
    return this.useCases.steps.previews.preview(asOperationContext(ctx), scope, {
      importId: idOf(id),
      canEdit: this.canEdit(ctx),
      ...(overrides === undefined ? {} : { overrides }),
    });
  }

  /** Confirms the preview; a create-only actor confirming update rows is FORBIDDEN (D2207). */
  async confirm(ctx: RequestContext, id: unknown): Promise<CatalogImportDto> {
    const scope = await this.spend(ctx);
    const actor = await this.actors.actorOf(ctx);
    try {
      return await this.useCases.steps.confirms.confirm(
        asOperationContext(ctx),
        scope,
        {
          administratorId: actor.administratorId,
          canEdit: this.canEdit(ctx),
        },
        idOf(id),
      );
    } catch (error: unknown) {
      if (error instanceof ConfirmNeedsEditError) throw new ForbiddenError();
      throw error;
    }
  }

  private async spend(ctx: RequestContext) {
    const scope = scopeOf(ctx);
    await this.throttle.spendImport(scope.businessId, String(ctx.activeUserId));
    return scope;
  }

  /** Whether the caller holds `catalog.products.edit` on the active store (Vendure's per-channel check, D58). */
  private canEdit(ctx: RequestContext): boolean {
    const key: PermissionKey = IMPORT_PERMISSIONS.edit;
    // Custom permissions extend the enum at runtime only, so the compiler cannot know this name.
    return ctx.userHasPermissions([vendurePermissionName(key) as unknown as Permission]);
  }
}
