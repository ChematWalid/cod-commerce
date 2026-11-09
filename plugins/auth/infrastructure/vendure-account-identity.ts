import { Injectable } from '@nestjs/common';
import {
  Administrator,
  isGraphQlErrorResult,
  NativeAuthenticationMethod,
  PasswordCipher,
  type RequestContext,
  TransactionalConnection,
  User,
  UserService,
} from '@vendure/core';
import { type FindOptionsWhere, IsNull, type Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { accountUserId } from '../domain/account-user-id';
import type { AuthEmailLocale } from '../domain/email';
import { CurrentPasswordWrongError, PasswordPolicyError } from '../domain/errors';
import type { AccountPasswordsPort } from '../domain/ports/account-credentials.port';
import type { AccountIdentityPort, AccountRecord } from '../domain/ports/account-identity.port';
import type { OperationContext } from '../domain/ports/operation-context';

const requestContextOf = (ctx: OperationContext): RequestContext => ctx as unknown as RequestContext;

/** The columns `configure` and tenancy add; the compiler does not know plugin custom fields. */
interface AccountCustomFields {
  readonly emailVerifiedAt: Date | null;
  readonly providerLinkUnproven: boolean;
  readonly emailLocale: AuthEmailLocale;
  readonly businessId: string | null;
}

/**
 * {@link AccountIdentityPort} and {@link AccountPasswordsPort} over Vendure's administrators and native logins, which
 * are account-level and not tenant tables. The stock reset column is never written (D25).
 */
@Injectable()
export class VendureAccountIdentity implements AccountIdentityPort, AccountPasswordsPort {
  constructor(
    private readonly connection: TransactionalConnection,
    private readonly users: UserService,
    private readonly cipher: PasswordCipher,
  ) {}

  inTransaction<T>(ctx: OperationContext, work: (transactional: OperationContext) => Promise<T>): Promise<T> {
    return this.connection.withTransaction(requestContextOf(ctx), (transactional) =>
      work(transactional as unknown as OperationContext),
    );
  }

  isEmailTaken(ctx: OperationContext, email: string): Promise<boolean> {
    return this.administrators(ctx).exists({ where: { emailAddress: email, deletedAt: IsNull() } });
  }

  async setEmailLocale(ctx: OperationContext, administratorId: number, locale: AuthEmailLocale): Promise<void> {
    // Plugin custom fields are unknown to the compiler; `configure` in the plugin module declares this one.
    const change = { customFields: { emailLocale: locale } } as QueryDeepPartialEntity<Administrator>;
    await this.administrators(ctx).update({ id: administratorId }, change);
  }

  async userIdOfAdministrator(ctx: OperationContext, administratorId: number): Promise<number> {
    const administrator = await this.administrators(ctx).findOneOrFail({
      where: { id: administratorId },
      relations: { user: true },
    });
    return accountUserId(administrator.user.id);
  }

  findByEmail(ctx: OperationContext, email: string): Promise<AccountRecord | undefined> {
    return this.find(ctx, { emailAddress: email });
  }

  findByUserId(ctx: OperationContext, userId: number): Promise<AccountRecord | undefined> {
    return this.find(ctx, { user: { id: userId } });
  }

  async markEmailVerified(ctx: OperationContext, administratorId: number, at: Date): Promise<void> {
    const change = { customFields: { emailVerifiedAt: at } } as QueryDeepPartialEntity<Administrator>;
    await this.administrators(ctx).update({ id: administratorId }, change);
  }

  async setProviderLinkUnproven(ctx: OperationContext, administratorId: number, unproven: boolean): Promise<void> {
    const change = { customFields: { providerLinkUnproven: unproven } } as QueryDeepPartialEntity<Administrator>;
    await this.administrators(ctx).update({ id: administratorId }, change);
  }

  async changeEmail(ctx: OperationContext, account: AccountRecord, email: string): Promise<void> {
    await this.administrators(ctx).update({ id: account.administratorId }, { emailAddress: email });
    await this.users.changeUserAndNativeIdentifier(requestContextOf(ctx), account.userId, email);
  }

  async verify(ctx: OperationContext, userId: number, password: string): Promise<boolean> {
    const method = await this.nativeMethod(ctx, userId);
    return method !== null && this.cipher.check(password, method.passwordHash);
  }

  async set(ctx: OperationContext, userId: number, password: string): Promise<void> {
    const method = await this.nativeMethod(ctx, userId);
    const passwordHash = await this.cipher.hash(password);
    const methods = this.connection.getRepository(requestContextOf(ctx), NativeAuthenticationMethod);
    if (method !== null) {
      await methods.update({ id: method.id }, { passwordHash });
      return;
    }
    // A provider-only account: the emailed token proved ownership, so the reset gives it a password login.
    const user = await this.connection.getRepository(requestContextOf(ctx), User).findOneByOrFail({ id: userId });
    await methods.save(new NativeAuthenticationMethod({ identifier: user.identifier, passwordHash, user }));
  }

  async change(ctx: OperationContext, userId: number, currentPassword: string, newPassword: string): Promise<void> {
    if ((await this.nativeMethod(ctx, userId)) === null) {
      // Stock `updatePassword` throws an internal error here; no current password can be right for this account.
      throw new CurrentPasswordWrongError();
    }
    const result = await this.users.updatePassword(requestContextOf(ctx), userId, currentPassword, newPassword);
    if (!isGraphQlErrorResult(result)) {
      return;
    }
    throw result.__typename === 'PasswordValidationError' ? new PasswordPolicyError() : new CurrentPasswordWrongError();
  }

  /** `passwordHash` is not selected by default. */
  private nativeMethod(ctx: OperationContext, userId: number): Promise<NativeAuthenticationMethod | null> {
    return this.connection
      .getRepository(requestContextOf(ctx), NativeAuthenticationMethod)
      .createQueryBuilder('method')
      .addSelect('method.passwordHash')
      .where('method.user = :userId', { userId })
      .getOne();
  }

  private async find(
    ctx: OperationContext,
    where: FindOptionsWhere<Administrator>,
  ): Promise<AccountRecord | undefined> {
    const administrator = await this.administrators(ctx).findOne({
      where: { ...where, deletedAt: IsNull() },
      relations: { user: true },
    });
    if (administrator === null) {
      return undefined;
    }
    const { emailVerifiedAt, providerLinkUnproven, emailLocale, businessId } =
      administrator.customFields as unknown as AccountCustomFields;
    return {
      userId: accountUserId(administrator.user.id),
      administratorId: administrator.id as number,
      firstName: administrator.firstName,
      email: administrator.emailAddress,
      locale: emailLocale,
      emailVerifiedAt,
      providerLinkUnproven,
      businessId,
    };
  }

  private administrators(ctx: OperationContext): Repository<Administrator> {
    return this.connection.getRepository(requestContextOf(ctx), Administrator);
  }
}
