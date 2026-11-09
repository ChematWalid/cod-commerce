import { Controller, Get, Inject } from '@nestjs/common';
import { Allow, Permission } from '@vendure/core';
import { AUTH_PUBLIC_CONFIG } from '../application/tokens';
import type { AuthPublicConfig } from '../domain/public-config';

/** The answer of `authPublicConfig` for clients that do not speak GraphQL. */
@Controller('auth')
export class AuthConfigController {
  constructor(@Inject(AUTH_PUBLIC_CONFIG) private readonly config: AuthPublicConfig) {}

  /** Which sign-in options this deployment offers. */
  @Get('config')
  @Allow(Permission.Public)
  publicConfig(): AuthPublicConfig {
    return this.config;
  }
}
