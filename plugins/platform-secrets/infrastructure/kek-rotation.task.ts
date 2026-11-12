import { catchUpTask } from '@cod/plugin-platform-jobs';
import { KekRotationService } from '../application/kek-rotation.service';
import { KEK_ROTATION_SCHEDULE, KEK_ROTATION_TASK_ID } from '../domain/constants';

/** Daily at 03:30 UTC: queues the rewrap of every data key still on a retired KEK. A missed day is made up by the next. */
export const kekRotationTask = catchUpTask({
  id: KEK_ROTATION_TASK_ID,
  schedule: KEK_ROTATION_SCHEDULE,
  description: 'Queues the re-wrapping of tenant data keys that are not on the active key-encryption key',
  async run(injector, now) {
    const { enqueued, remainingOnRetiredKeks } = await injector.get(KekRotationService).enqueueStale(now);
    return { enqueued, remaining: remainingOnRetiredKeks };
  },
});
