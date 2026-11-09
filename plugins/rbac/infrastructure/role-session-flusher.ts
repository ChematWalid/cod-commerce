import { Injectable } from '@nestjs/common';
import { Administrator, AuthenticatedSession, ConfigService, Logger, TransactionalConnection } from '@vendure/core';
import { SESSION_CACHE_DELETE_TIMEOUT_MS, SESSION_REDELETE_DELAY_MS } from '../domain/constants';
import type { SessionFlusherPort } from '../domain/ports/session-flusher.port';

const LOG_CONTEXT = 'RoleSessionFlusher';

const reasonOf = (error: unknown): string => (error instanceof Error ? error.message : 'unknown error');

/**
 * {@link SessionFlusherPort} over Vendure's session table and cache (D55). The delete repeats after a delay to catch a
 * reader that loaded the old permissions before the commit and cached them after the first delete.
 */
@Injectable()
export class RoleSessionFlusher implements SessionFlusherPort {
  constructor(
    private readonly connection: TransactionalConnection,
    private readonly config: ConfigService,
  ) {}

  async flushAdministrators(administratorIds: readonly number[]): Promise<void> {
    if (administratorIds.length === 0) return;
    const tokens = await this.loadTokens(administratorIds);
    if (tokens.length === 0) return;
    await this.evictAll(tokens);
    // Unreferenced: a pending repeat must not keep a process alive at shutdown.
    setTimeout(() => void this.evictAll(tokens), SESSION_REDELETE_DELAY_MS).unref();
  }

  private async loadTokens(administratorIds: readonly number[]): Promise<readonly string[]> {
    try {
      const sessions = await this.connection.rawConnection
        .getRepository(AuthenticatedSession)
        .createQueryBuilder('session')
        .innerJoin(Administrator, 'administrator', 'administrator.userId = session.userId')
        .where('administrator.id IN (:...administratorIds)', { administratorIds })
        .andWhere('session.expires > :now', { now: new Date() })
        .select(['session.id', 'session.token'])
        .getMany();
      return sessions.map((session) => session.token);
    } catch (error: unknown) {
      Logger.error(`Could not read sessions to flush, they live until the cache TTL: ${reasonOf(error)}`, LOG_CONTEXT);
      return [];
    }
  }

  private async evictAll(tokens: readonly string[]): Promise<void> {
    await Promise.all(tokens.map((token) => this.evict(token)));
  }

  /** Never throws: the worst case is the cache TTL, which the log makes visible. */
  private async evict(token: string): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(new Error('timed out'));
      }, SESSION_CACHE_DELETE_TIMEOUT_MS);
    });
    try {
      const { sessionCacheStrategy } = this.config.authOptions;
      await Promise.race([Promise.resolve(sessionCacheStrategy.delete(token)), timeout]);
    } catch (error: unknown) {
      Logger.error(
        `Session cache delete failed, the session lives until the cache TTL: ${reasonOf(error)}`,
        LOG_CONTEXT,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
