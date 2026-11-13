import { ClientIpResolver, RateLimit } from '@cod/plugin-rate-limit';
import { acceptInvitationSchema, type BusinessId } from '@cod/shared';
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req, UseFilters } from '@nestjs/common';
import { Allow, Permission, type RequestContext, RequestContextService } from '@vendure/core';
import { AcceptInvitationService } from '../application/accept-invitation.service';
import { type InvitationPreview, PreviewInvitationService } from '../application/preview-invitation.service';
import { InvitationInvalidError } from '../domain/errors';
import { asOperationContext, type OperationContext } from '../domain/ports/operation-context';
import { originOf } from './actor-of';
import { TeamPublicRestFilter } from './public-error-filter';
import { parseInput } from './request-body';

/** The Express request, named through Vendure so the plugin needs no Express dependency of its own. */
type HttpRequest = NonNullable<RequestContext['req']>;

/**
 * The invitee's side of an invitation, public and REST only (D205): no GraphQL accept. Rate limited by address;
 * `NoStoreMiddleware` keeps every answer out of caches and referrers, and no error echoes the query string: Team's
 * filter answers every error but a rate-limit refusal, whose own filter strips the query too.
 */
@Controller('team/invitations')
@UseFilters(TeamPublicRestFilter)
export class InvitationsController {
  constructor(
    private readonly previews: PreviewInvitationService,
    private readonly accepts: AcceptInvitationService,
    private readonly requestContexts: RequestContextService,
    private readonly ips: ClientIpResolver,
  ) {}

  /** What the accept page shows; one answer for every token that opens nothing (D213). */
  @Get('preview')
  @Allow(Permission.Public)
  @RateLimit('invitation-accept-ip')
  async preview(@Req() req: HttpRequest, @Query('token') token: unknown): Promise<InvitationPreview> {
    if (typeof token !== 'string' || token === '') throw new InvitationInvalidError();
    return this.previews.preview(await this.adminContext(req), token);
  }

  /** Creates the invitee's account and makes it an active member; the invitee then signs in. */
  @Post('accept')
  @HttpCode(HttpStatus.OK)
  @Allow(Permission.Public)
  @RateLimit('invitation-accept-ip')
  async accept(@Req() req: HttpRequest, @Body() body: unknown): Promise<{ businessId: BusinessId }> {
    const command = parseInput(acceptInvitationSchema, body);
    return this.accepts.accept(await this.adminContext(req), command, originOf(req, this.ips));
  }

  /** A REST request has api type `custom`; the same administrators as the Admin API are meant here. */
  private async adminContext(req: HttpRequest): Promise<OperationContext> {
    return asOperationContext(await this.requestContexts.create({ req, apiType: 'admin' }));
  }
}
