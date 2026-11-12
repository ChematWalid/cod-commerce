import { catchUpTask } from '@cod/plugin-platform-jobs';
import { InboundKeyPurge } from '../application/key-purge.service';
import { KEY_PURGE_SCHEDULE, KEY_PURGE_TASK_ID } from '../domain/constants';

/** Daily at 04:15 UTC: deletes dedupe keys older than 30 days (D107). */
export const inboundKeyPurgeTask = catchUpTask({
  id: KEY_PURGE_TASK_ID,
  schedule: KEY_PURGE_SCHEDULE,
  description: 'Deletes inbound webhook dedupe keys older than 30 days',
  async run(injector, now) {
    return injector.get(InboundKeyPurge).purge(now);
  },
});
