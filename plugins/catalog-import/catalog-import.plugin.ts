import { CatalogPlugin } from '@cod/plugin-catalog';
import { PlatformFlagsPlugin } from '@cod/plugin-platform-flags';
import { JobReconciler, PlatformJobsPlugin, PlatformQueues } from '@cod/plugin-platform-jobs';
import { TenancyPlugin } from '@cod/plugin-tenancy';
import { Inject, type OnModuleInit } from '@nestjs/common';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { CATALOG_IMPORT_ENTITIES } from './infrastructure/catalog-import-entities';
import { ImportJobsReconcileSource } from './infrastructure/import-jobs.reconcile-source';
import { defineImportsExportsQueue } from './infrastructure/imports-exports.queue';
import { IMPORTS_EXPORTS_JOB_REGISTRAR } from './infrastructure/job-registrar';
import { ImportsExportsJobRegistry } from './infrastructure/job-registry';
import {
  type CatalogImportPluginOptions,
  currentCatalogImportOptions,
  setCatalogImportOptions,
} from './infrastructure/plugin-options';
import { CATALOG_IMPORT_PROVIDERS } from './infrastructure/providers';

/**
 * Bulk edit, export and import of a store's products, link import and the AI hooks (D2200): the private object
 * storage (D2208), the job tables and the `imports-exports` queue with its kind registry (D2212). Products are only
 * written through catalog's explicit-scope facade (D2201). This module only wires the layers.
 */
@VendurePlugin({
  // Catalog exports the facade; platform-jobs the queues, semaphore and reconciler; the flags gate the AI hooks
  // (D2215); tenancy the tenant repositories.
  imports: [PluginCommonModule, TenancyPlugin, PlatformJobsPlugin, PlatformFlagsPlugin, CatalogPlugin],
  entities: CATALOG_IMPORT_ENTITIES,
  providers: CATALOG_IMPORT_PROVIDERS,
  exports: [IMPORTS_EXPORTS_JOB_REGISTRAR],
  compatibility: '^3.8.0',
})
export class CatalogImportPlugin implements OnModuleInit {
  constructor(
    @Inject(PlatformQueues) private readonly queues: PlatformQueues,
    @Inject(ImportsExportsJobRegistry) private readonly registry: ImportsExportsJobRegistry,
    @Inject(JobReconciler) private readonly reconciler: JobReconciler,
    @Inject(ImportJobsReconcileSource) private readonly reconcileSource: ImportJobsReconcileSource,
  ) {}

  /**
   * Registers the plugin with its storage, scraper and environment, validated here (D2208). A second call replaces
   * the options; the providers read them when the app is built.
   * @throws Error for the memory storage or the fixture scraper in production
   */
  static init(options: CatalogImportPluginOptions): typeof CatalogImportPlugin {
    setCatalogImportOptions(options);
    return CatalogImportPlugin;
  }

  /** The options the last {@link CatalogImportPlugin.init} set. */
  static get options(): CatalogImportPluginOptions | undefined {
    return currentCatalogImportOptions();
  }

  /** Defines the queue (its one definer, D2212) and hands the job tables to the reconciler. */
  onModuleInit(): void {
    defineImportsExportsQueue(this.queues, this.registry);
    this.reconciler.registerSource(this.reconcileSource);
  }
}
