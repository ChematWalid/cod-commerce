import { Injectable } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';
import { TaskHeartbeatReader, type TaskHeartbeatWriter } from '../domain/task-heartbeat.port';
import { TaskHeartbeatEntity } from './task-heartbeat.entity';

/** {@link TaskHeartbeatReader} and {@link TaskHeartbeatWriter} on `platform_task_heartbeat`, a platform table. */
@Injectable()
export class TaskHeartbeatRepository implements TaskHeartbeatReader, TaskHeartbeatWriter {
  constructor(private readonly connection: TransactionalConnection) {}

  async recordSuccess(taskId: string, at: Date): Promise<void> {
    await this.connection.rawConnection
      .getRepository(TaskHeartbeatEntity)
      .upsert({ taskId, lastSuccessAt: at }, ['taskId']);
  }

  async lastSuccess(): Promise<ReadonlyMap<string, Date>> {
    const rows = await this.connection.rawConnection.getRepository(TaskHeartbeatEntity).find();
    return new Map(rows.map((row) => [row.taskId, row.lastSuccessAt]));
  }
}
