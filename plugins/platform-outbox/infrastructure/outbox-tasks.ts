import { catchUpTask } from '@cod/plugin-platform-jobs';
import { OutboxSweeper } from '../application/outbox-sweeper';
import { OUTBOX_SWEEPER_TASK_ID } from '../domain/constants';

/** Every minute: queues the relay of events whose after-commit enqueue never happened (D104). */
export const outboxSweeperTask = catchUpTask({
  id: OUTBOX_SWEEPER_TASK_ID,
  schedule: '* * * * *',
  description: 'Queues the relay of outbox events still pending after a minute',
  async run(injector, now) {
    const { enqueued } = await injector.get(OutboxSweeper).sweep(now);
    return { enqueued };
  },
});
