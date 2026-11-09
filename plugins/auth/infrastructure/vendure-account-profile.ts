import { Injectable } from '@nestjs/common';
import { Administrator, ConfigService, type RequestContext, TransactionalConnection } from '@vendure/core';
import { IsNull } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import type { OperationContext } from '../domain/ports/operation-context';
import type { AccountProfileStorePort } from '../domain/ports/account-profile.port';
import type { AccountProfile, ProfileChange } from '../domain/profile';

const requestContextOf = (ctx: OperationContext): RequestContext => ctx as unknown as RequestContext;

/** The columns `configure` adds to the administrator; the compiler does not know plugin custom fields. */
interface ProfileCustomFields {
  readonly phone: string | null;
  readonly emailVerifiedAt: Date | null;
}

/**
 * {@link AccountProfileStorePort} on Vendure's administrators, which are account-level and not tenant tables. The
 * photo is the administrator's own avatar, a system asset that belongs to no channel.
 */
@Injectable()
export class VendureAccountProfile implements AccountProfileStorePort {
  constructor(
    private readonly connection: TransactionalConnection,
    private readonly config: ConfigService,
  ) {}

  async find(ctx: OperationContext, userId: number): Promise<AccountProfile | undefined> {
    const request = requestContextOf(ctx);
    const administrator = await this.connection.getRepository(request, Administrator).findOne({
      where: { user: { id: userId }, deletedAt: IsNull() },
      relations: { avatar: true },
    });
    if (administrator === null) {
      return undefined;
    }
    const { phone, emailVerifiedAt } = administrator.customFields as unknown as ProfileCustomFields;
    return {
      firstName: administrator.firstName,
      lastName: administrator.lastName,
      emailAddress: administrator.emailAddress,
      phone,
      avatarUrl: this.avatarUrl(request, administrator),
      emailVerified: emailVerifiedAt !== null,
    };
  }

  async save(ctx: OperationContext, userId: number, change: ProfileChange): Promise<void> {
    const { firstName, lastName, phone } = change;
    const columns = { firstName, lastName, customFields: { phone } } as QueryDeepPartialEntity<Administrator>;
    await this.connection
      .getRepository(requestContextOf(ctx), Administrator)
      .update({ user: { id: userId }, deletedAt: IsNull() }, columns);
  }

  /** The same URL the storage strategy gives every asset, so it follows the asset server's route and host. */
  private avatarUrl(ctx: RequestContext, administrator: Administrator): string | null {
    const preview = administrator.avatar?.source ? administrator.avatar.preview : undefined;
    if (!preview) {
      return null;
    }
    const storage = this.config.assetOptions.assetStorageStrategy;
    return storage.toAbsoluteUrl === undefined || ctx.req === undefined
      ? preview
      : storage.toAbsoluteUrl(ctx.req, preview);
  }
}
