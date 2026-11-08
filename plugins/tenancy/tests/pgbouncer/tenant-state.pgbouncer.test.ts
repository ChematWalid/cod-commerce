import { toBusinessId } from '@cod/shared';
import { type ConfigService, RequestContext, TransactionalConnection } from '@vendure/core';
import { DataSource } from 'typeorm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { TenantTransaction } from '../../infrastructure/tenant-transaction';
import { BusinessEntity } from '../../infrastructure/business.entity';
import { TransactionWrapper } from '@vendure/core/dist/connection/transaction-wrapper';

const SCOPE = { businessId: toBusinessId('4242') };
const SETTING = 'app.business_id';
const CONFIG_WITHOUT_ACCESS_CONTROL = { authOptions: {} } as unknown as ConfigService;

const openClient = (url: string): Promise<DataSource> =>
  new DataSource({ type: 'postgres', url, entities: [BusinessEntity], extra: { max: 1 } }).initialize();

const backendPid = async (client: DataSource): Promise<number> => {
  const [row] = await client.query<{ pid: number }[]>('SELECT pg_backend_pid() AS pid');
  return row?.pid ?? -1;
};

const currentSetting = async (client: DataSource): Promise<string> => {
  const [row] = await client.query<{ value: string | null }[]>(`SELECT current_setting('${SETTING}', true) AS value`);
  return row?.value ?? '';
};

/**
 * Runs against PgBouncer in transaction mode with a server pool of one (A13), so both clients are handed the
 * same Postgres backend: anything session-scoped set by one is visible to the other.
 */
describe('tenant state through PgBouncer', () => {
  let clientA: DataSource;
  let clientB: DataSource;
  let connection: TransactionalConnection;
  let transaction: TenantTransaction;

  beforeAll(async () => {
    const url = process.env['DATABASE_URL'];
    if (url === undefined) throw new Error('DATABASE_URL must point at PgBouncer');
    clientA = await openClient(url);
    clientB = await openClient(url);
    connection = new TransactionalConnection(clientA, new TransactionWrapper(), CONFIG_WITHOUT_ACCESS_CONTROL);
    transaction = new TenantTransaction(connection);
  });

  afterEach(async () => {
    await clientA.query(`RESET ${SETTING}`);
  });

  afterAll(async () => {
    await clientA.destroy();
    await clientB.destroy();
  });

  it('hands both clients the same backend', async () => {
    expect(await backendPid(clientA)).toBe(await backendPid(clientB));
  });

  it('sees the tenant inside TenantTransaction and not in the next client', async () => {
    const seenInside = await transaction.run(RequestContext.empty(), SCOPE, async (txCtx) => {
      const repository = connection.getRepository(txCtx, BusinessEntity);
      const [row] = await repository.query<{ value: string }[]>(`SELECT current_setting('${SETTING}', true) AS value`);
      return row?.value;
    });

    expect(seenInside).toBe(SCOPE.businessId);
    expect(await currentSetting(clientB)).toBe('');
  });

  it('leaks a plain SET to the next client, which is why the gate forbids it', async () => {
    await clientA.query(`SET ${SETTING} = '4242'`);

    expect(await currentSetting(clientB)).toBe('4242');
  });
});
