import { IMPORTS_EXPORTS_JOB_KINDS } from '@cod/shared';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { RunImportJobService } from '../application/run-import-job.service';
import { ImportsExportsJobRegistry } from './job-registry';

/**
 * Registers the `product-import` kind on the `imports-exports` registry (D2212): its rows are catalog-import's own
 * `catalog_import_job` table, so the worker opens each job from its row (scope and confirming actor) before this runs.
 */
@Injectable()
export class ImportJobHandler implements OnModuleInit {
  constructor(
    @Inject(ImportsExportsJobRegistry) private readonly registry: ImportsExportsJobRegistry,
    @Inject(RunImportJobService) private readonly imports: RunImportJobService,
  ) {}

  onModuleInit(): void {
    this.registry.register(IMPORTS_EXPORTS_JOB_KINDS.productImport, (data, ctx, scope) =>
      this.imports.run(ctx, scope, data.recordId),
    );
  }
}
