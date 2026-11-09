import { ScheduledTask, TransactionalConnection } from '@vendure/core';
import { ACCOUNT_TOKEN_RETENTION_MS } from '../domain/constants';
import { AccountTokenEntity } from './account-token.entity';

const PURGE_TASK_ID = 'account-token-purge';
const DAILY_AT_03_UTC = '0 3 * * *';

/**
 * Deletes tokens {@link ACCOUNT_TOKEN_RETENTION_MS} past expiry or consumption (D43): they can hold `pendingEmail`,
 * which is personal data. Returns how many rows went.
 */
export async function purgeFinishedAccountTokens(connection: TransactionalConnection, now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - ACCOUNT_TOKEN_RETENTION_MS);
  const result = await connection.rawConnection
    .getRepository(AccountTokenEntity)
    .createQueryBuilder()
    .delete()
    .where('"expiresAt" < :cutoff OR "consumedAt" < :cutoff', { cutoff })
    .execute();
  return result.affected ?? 0;
}

/** The daily purge; Vendure's scheduler runs it on one worker. */
export const accountTokenPurgeTask = new ScheduledTask({
  id: PURGE_TASK_ID,
  description: 'Deletes account tokens seven days after they expired or were used',
  schedule: DAILY_AT_03_UTC,
  execute: async ({ injector }) => ({
    deleted: await purgeFinishedAccountTokens(injector.get(TransactionalConnection), new Date()),
  }),
});
