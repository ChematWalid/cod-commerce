import { VendurePlugin } from '@vendure/core';
// Not in the package index; `SchedulerService` tests for exactly this class.
import { NoopSchedulerStrategy } from '@vendure/core/dist/scheduler/noop-scheduler-strategy';

/**
 * Registered last on the `migrate` role: `DefaultSchedulerPlugin` keeps its `scheduled_task_record` entity (so
 * the migrations still create the table) but its configuration step installs the real scheduler, so this one
 * runs after it and puts the no-op strategy back. A release job then never fires a catch-up task (D122, SRV-12).
 */
@VendurePlugin({
  configuration: (config) => {
    config.schedulerOptions.schedulerStrategy = new NoopSchedulerStrategy();
    return config;
  },
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- a Vendure plugin is a decorated class
export class MigrateNoSchedulerPlugin {}
