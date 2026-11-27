import type { Readable } from 'node:stream';
import { PRICING_CSV_MAX_BYTES } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import type { RequestContext } from '@vendure/core';
import type { PricingCsvFile } from '../application/pricing-csv-export.service';
import { InvalidDeliveryFeeInputError } from '../domain/errors';
import { asOperationContext } from '../domain/ports/operation-context';
import { type DeliveryFeeCsvImportDto, toCsvImportDto } from './csv-dto';
import { FeeGroupCsvUseCases } from './fee-group-use-cases';
import { readAtMost } from './read-upload';
import { idArgOf, parseDryRun } from './request-body';
import { scopeOf } from './store-scope-of';

/** What the `Upload` scalar resolves to: only the stream is read, never the client's name or type. */
interface FileUpload {
  readonly createReadStream: () => Readable;
}

const isFileUpload = (value: unknown): value is FileUpload =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { createReadStream?: unknown }).createReadStream === 'function';

/** One byte past the cap is read, so a larger file is told apart without being held whole (as D2113). */
const READ_LIMIT = PRICING_CSV_MAX_BYTES + 1;

/**
 * The CSV export and import of a pricing option for both API surfaces (D2102, D3142): the tenant and store come from
 * the session and `vendure-token`, never from the path; the file comes as GraphQL multipart or a raw REST body.
 */
@Injectable()
export class FeeGroupCsvActions {
  constructor(private readonly useCases: FeeGroupCsvUseCases) {}

  /** The CSV of the store's group `id`, or `null` for an unknown, foreign, other-store or malformed id. */
  async exportCsv(ctx: RequestContext, id: unknown): Promise<PricingCsvFile | null> {
    const file = await this.useCases.exporting.export(asOperationContext(ctx), scopeOf(ctx), idArgOf(id));
    return file ?? null;
  }

  /** Imports a GraphQL multipart `file` into the store's group `id`; a dry run unless `dryRun` is false. */
  async importUpload(
    ctx: RequestContext,
    id: unknown,
    file: unknown,
    dryRun: unknown,
  ): Promise<DeliveryFeeCsvImportDto> {
    const upload: unknown = await file;
    if (!isFileUpload(upload)) throw new InvalidDeliveryFeeInputError();
    return this.importBytes(ctx, id, await readAtMost(upload.createReadStream(), READ_LIMIT), dryRun);
  }

  /** Imports raw CSV `bytes` (at most one past the cap) into the store's group `id`. */
  async importBytes(
    ctx: RequestContext,
    id: unknown,
    bytes: Uint8Array,
    dryRun: unknown,
  ): Promise<DeliveryFeeCsvImportDto> {
    const request = { bytes, dryRun: parseDryRun(dryRun) };
    const report = await this.useCases.importing.import(asOperationContext(ctx), scopeOf(ctx), idArgOf(id), request);
    return toCsvImportDto(report);
  }
}
