import { JOB_RECONCILER_TASK_ID } from '../domain/constants';
import { JobReconciler } from '../application/job-reconciler';
import { catchUpTask } from './catch-up-task';

/** Every 5 minutes: finds durable rows whose job is gone, settled or stuck and queues them again (D105). */
export const jobReconcilerTask = catchUpTask({
  id: JOB_RECONCILER_TASK_ID,
  schedule: '*/5 * * * *',
  description: 'Queues again the durable rows whose BullMQ job is lost, settled or stuck',
  async run(injector, now) {
    const result = await injector.get(JobReconciler).reconcile(now);
    return { reenqueued: result.reenqueued, exhausted: result.exhausted };
  },
});
