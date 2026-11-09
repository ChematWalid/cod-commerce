import type { SubdomainAvailability } from '@cod/shared';
import { RateLimit } from '@cod/plugin-rate-limit';
import { Controller, Get, Query } from '@nestjs/common';
import { Allow, Ctx, Permission, type RequestContext } from '@vendure/core';
import { CheckSubdomainService } from '../application/check-subdomain.service';
import { asOperationContext } from '../domain/ports/operation-context';

/** A repeated or missing query parameter is not a string; an empty one is answered as invalid. */
const asSubdomain = (raw: unknown): string => (typeof raw === 'string' ? raw : '');

/** Subdomain availability for the sign-up wizard, which has no session yet. */
@Controller('stores')
export class SubdomainController {
  constructor(private readonly checkSubdomain: CheckSubdomainService) {}

  /** Same answer as the `subdomainAvailability` query. */
  @Get('subdomain-availability')
  @Allow(Permission.Public)
  @RateLimit('subdomain-ip')
  availability(@Ctx() ctx: RequestContext, @Query('subdomain') raw: unknown): Promise<SubdomainAvailability> {
    return this.checkSubdomain.check(asOperationContext(ctx), asSubdomain(raw));
  }
}
