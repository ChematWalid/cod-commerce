import { UPLOAD_URL_TTL_SECONDS, type UploadCommand } from '@cod/shared';
import { importSourceKey } from '../domain/object-keys';
import type { StoreScope } from '../domain/store-scope';
import type { JobIdGenerator } from './ports/export-queue.port';
import type { ImportJobStore } from './ports/import-job.port';
import type { ObjectStorage } from './ports/object-storage.port';
import type { OperationContext } from './ports/operation-context';
import type { UnitOfWorkPort } from './ports/unit-of-work.port';

/** A started upload (D2208): the import's id and the presigned PUT the browser sends the file with, unchanged. */
export interface ImportUploadView {
  readonly importId: string;
  readonly uploadUrl: string;
  readonly method: 'PUT';
  readonly headers: Readonly<Record<string, string>>;
  readonly expiresAt: Date;
}

/** What {@link CreateUploadService} runs through. */
export interface CreateUploadDeps {
  readonly jobs: Pick<ImportJobStore, 'create'>;
  readonly storage: Pick<ObjectStorage, 'presignPut'>;
  readonly units: UnitOfWorkPort;
  readonly ids: JobIdGenerator;
  readonly now?: () => Date;
}

/**
 * "Upload a spreadsheet" (D2208): creates the import job (`awaiting_upload`, the declared size and type stored) and
 * answers a presigned PUT of exactly that size and type to `uploads/b/<business>/s/<store>/imports/<id>/source`, valid
 * 10 minutes. Nothing is read until analyze, whose HEAD is the real gate.
 */
export class CreateUploadService {
  private readonly now: () => Date;

  constructor(private readonly deps: CreateUploadDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  async create(
    ctx: OperationContext,
    scope: StoreScope,
    actorAdministratorId: number,
    command: UploadCommand,
  ): Promise<ImportUploadView> {
    const id = this.deps.ids.next();
    const job = {
      id,
      format: command.format,
      declaredSize: command.size,
      declaredContentType: command.contentType,
      actorAdministratorId,
      at: this.now(),
    };
    await this.deps.units.run(ctx, scope, (tx) => this.deps.jobs.create(tx, scope, job));
    const signed = await this.deps.storage.presignPut(importSourceKey(scope, id), {
      contentType: command.contentType,
      size: command.size,
      ttlSeconds: UPLOAD_URL_TTL_SECONDS,
    });
    return {
      importId: id,
      uploadUrl: signed.url,
      method: signed.method,
      headers: signed.headers,
      expiresAt: signed.expiresAt,
    };
  }
}
