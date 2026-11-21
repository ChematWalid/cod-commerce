import { IMPORTS_EXPORTS_JOB_KINDS } from '@cod/shared';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { RunExportJobService } from '../application/run-export-job.service';
import { ImportsExportsJobRegistry } from './job-registry';

/**
 * Registers the `product-export` kind on the `imports-exports` registry (D2212): its rows are catalog-import's own
 * `catalog_export_job` table, so the worker opens each job from its row (scope and actor) before this runs.
 */
@Injectable()
export class ExportJobHandler implements OnModuleInit {
  constructor(
    @Inject(ImportsExportsJobRegistry) private readonly registry: ImportsExportsJobRegistry,
    @Inject(RunExportJobService) private readonly exports: RunExportJobService,
  ) {}

  onModuleInit(): void {
    this.registry.register(IMPORTS_EXPORTS_JOB_KINDS.productExport, (data, ctx, scope) =>
      this.exports.run(ctx, scope, data.recordId),
    );
  }
}
