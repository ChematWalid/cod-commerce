import { randomBytes } from 'node:crypto';
import { PLATFORM_CURRENCY_CODE, type Snowflake } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  AdministratorService,
  ChannelService,
  ConfigService,
  CurrencyCode,
  GlobalSettingsService,
  Injector,
  isGraphQlErrorResult,
  LanguageCode,
  type Permission,
  type RequestContext,
  RequestContextService,
  RoleService,
  SellerService,
  TransactionalConnection,
  User,
  Zone,
} from '@vendure/core';
import { ALGERIA_ZONE_NAME, ownerRoleCode, PLATFORM_ONLY_CUSTOM_PERMISSIONS } from '../domain/constants';
import { PlatformZoneMissingError, UnsupportedStoreLanguageError } from '../domain/errors';
import type {
  AdministratorRequest,
  ChannelProvisionerPort,
  ChannelRequest,
} from '../domain/ports/channel-provisioner.port';
import type { OperationContext } from '../domain/ports/operation-context';
import { toRequestContext } from './operation-context.adapter';

const CHANNEL_SECRET_BYTES = 16;

const randomChannelValue = (): string => randomBytes(CHANNEL_SECRET_BYTES).toString('hex');

type ContextWithSymbols = RequestContext & Record<symbol, unknown>;

/**
 * Vendure's sellers, channels, roles and administrators. Role and administrator creation check the active user,
 * but an owner adding a store and an anonymous sign-up are legitimate callers, so those run as the superadmin (A2).
 */
@Injectable()
export class VendureChannelProvisioner implements ChannelProvisionerPort {
  private readonly injector: Injector;

  // The adapter spans six Vendure services; resolving them here keeps the constructor to one dependency.
  constructor(moduleRef: ModuleRef) {
    this.injector = new Injector(moduleRef);
  }

  async availableLanguages(ctx: OperationContext): Promise<readonly string[]> {
    const settings = await this.injector.get(GlobalSettingsService).getSettings(toRequestContext(ctx));
    // Deprecated for channels, but ChannelService.create still validates against it.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    return settings.availableLanguages;
  }

  async createSeller(ctx: OperationContext, name: string): Promise<number> {
    const seller = await this.injector.get(SellerService).create(toRequestContext(ctx), { name });
    return seller.id as number;
  }

  async createOwnerRole(ctx: OperationContext, businessId: Snowflake): Promise<number> {
    const code = ownerRoleCode(businessId);
    const role = await this.injector.get(RoleService).create(await this.asSuperadmin(ctx), {
      code,
      description: code,
      permissions: this.ownerPermissions(),
      // Explicitly empty: without `channelIds` Vendure would put the role on the caller's channel.
      channelIds: [],
    });
    return role.id as number;
  }

  async createChannel(ctx: OperationContext, { sellerId, language }: ChannelRequest): Promise<number> {
    const requestContext = toRequestContext(ctx);
    const zone = await this.algeriaZone(requestContext);
    const languageCode = LanguageCode[language as keyof typeof LanguageCode];
    const created = await this.injector.get(ChannelService).create(requestContext, {
      code: randomChannelValue(),
      token: randomChannelValue(),
      defaultLanguageCode: languageCode,
      availableLanguageCodes: [languageCode],
      defaultCurrencyCode: CurrencyCode[PLATFORM_CURRENCY_CODE],
      pricesIncludeTax: true,
      defaultTaxZoneId: zone.id,
      defaultShippingZoneId: zone.id,
      sellerId,
    });
    if (isGraphQlErrorResult(created)) {
      throw new UnsupportedStoreLanguageError(language);
    }
    return created.id as number;
  }

  async assignRoleToChannel(ctx: OperationContext, roleId: number, channelId: number): Promise<void> {
    await this.injector.get(RoleService).assignRoleToChannel(await this.asSuperadmin(ctx), roleId, channelId);
  }

  async createAdministrator(ctx: OperationContext, request: AdministratorRequest): Promise<number> {
    const { businessId, roleId, ...identity } = request;
    const administrator = await this.injector.get(AdministratorService).create(await this.asSuperadmin(ctx), {
      ...identity,
      roleIds: [roleId],
      customFields: { businessId },
    });
    return administrator.id as number;
  }

  /** Every assignable plugin permission except the platform's own. Never core ones such as `ReadChannel` (A1). */
  private ownerPermissions(): Permission[] {
    return (
      this.injector
        .get(ConfigService)
        .authOptions.customPermissions.flatMap((definition) => definition.getMetadata())
        .filter(({ assignable, name }) => assignable && !PLATFORM_ONLY_CUSTOM_PERMISSIONS.includes(name))
        // Custom permissions extend the enum at runtime only, so the compiler cannot know these names.
        .map(({ name }) => name as unknown as Permission)
    );
  }

  private async algeriaZone(ctx: RequestContext): Promise<Zone> {
    const zone = await this.injector
      .get(TransactionalConnection)
      .getRepository(ctx, Zone)
      .findOne({ where: { name: ALGERIA_ZONE_NAME } });
    if (zone === null) {
      throw new PlatformZoneMissingError(ALGERIA_ZONE_NAME);
    }
    return zone;
  }

  /**
   * A superadmin context on the caller's transaction. It is built per call: Vendure caches a user's channels per
   * context, and creating a channel adds one to the superadmin's role.
   */
  private async asSuperadmin(ctx: OperationContext): Promise<RequestContext> {
    const caller = toRequestContext(ctx);
    const { identifier } = this.injector.get(ConfigService).authOptions.superadminCredentials;
    const user = await this.injector
      .get(TransactionalConnection)
      .getRepository(caller, User)
      .findOneOrFail({ where: { identifier }, relations: { roles: { channels: true } } });
    const superadmin = await this.injector
      .get(RequestContextService)
      .create({ apiType: 'admin', channelOrToken: caller.channel, user });
    return shareTransaction(caller, superadmin);
  }
}

/** Vendure keeps the transaction under a symbol it does not export, and that symbol is a context's only one. */
function shareTransaction(from: RequestContext, to: RequestContext): RequestContext {
  for (const key of Object.getOwnPropertySymbols(from)) {
    (to as ContextWithSymbols)[key] = (from as ContextWithSymbols)[key];
  }
  return to;
}
