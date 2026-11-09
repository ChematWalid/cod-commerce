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
  type RequestContext,
  RoleService,
  SellerService,
  TransactionalConnection,
  Zone,
} from '@vendure/core';
import { ALGERIA_ZONE_NAME, ownerRoleCode } from '../domain/constants';
import { PlatformZoneMissingError, UnsupportedStoreLanguageError } from '../domain/errors';
import type {
  AdministratorRequest,
  ChannelProvisionerPort,
  ChannelRequest,
} from '../domain/ports/channel-provisioner.port';
import type { OperationContext } from '../domain/ports/operation-context';
import { toRequestContext } from './operation-context.adapter';
import { ownerRolePermissions } from './owner-role-permissions';
import { SuperadminContextFactory } from './superadmin-context.factory';

const CHANNEL_SECRET_BYTES = 16;

const randomChannelValue = (): string => randomBytes(CHANNEL_SECRET_BYTES).toString('hex');

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
    const role = await this.injector.get(RoleService).create(await this.superadmin(ctx), {
      code,
      description: code,
      permissions: ownerRolePermissions(this.injector.get(ConfigService).authOptions.customPermissions),
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
    await this.injector.get(RoleService).assignRoleToChannel(await this.superadmin(ctx), roleId, channelId);
  }

  async updateChannelLanguage(ctx: OperationContext, channelId: number, language: string): Promise<void> {
    const languageCode = LanguageCode[language as keyof typeof LanguageCode];
    const updated = await this.injector.get(ChannelService).update(await this.superadmin(ctx), {
      id: channelId,
      defaultLanguageCode: languageCode,
      availableLanguageCodes: [languageCode],
    });
    if (isGraphQlErrorResult(updated)) {
      throw new UnsupportedStoreLanguageError(language);
    }
  }

  async createAdministrator(ctx: OperationContext, request: AdministratorRequest): Promise<number> {
    const { businessId, roleId, ...identity } = request;
    const administrator = await this.injector.get(AdministratorService).create(await this.superadmin(ctx), {
      ...identity,
      roleIds: [roleId],
      customFields: { businessId },
    });
    return administrator.id as number;
  }

  private superadmin(ctx: OperationContext): Promise<RequestContext> {
    return this.injector.get(SuperadminContextFactory).create(ctx);
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
}
