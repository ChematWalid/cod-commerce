import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { requirePermission } from '@cod/plugin-rbac/guard';
import { RequestTenantScope, tenantOf } from '@cod/plugin-tenancy';
import type { TenantScope } from '@cod/shared';
import { Ctx, type RequestContext, Transaction } from '@vendure/core';
import { CreateNoteService } from '../application/create-note.service';
import { GetNotesService } from '../application/get-notes.service';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../domain/constants';
import { toNoteId } from '../domain/note';
import type { NotePage } from '../domain/ports/note-repository.port';
import {
  type CreateTemplateNoteArgs,
  type TemplateNoteArgs,
  type TemplateNoteDto,
  type TemplateNotesArgs,
  toTemplateNoteDto,
} from './dto';
import { mapDomainError } from './error-mapping';
import { NOTE_PERMISSIONS } from './permissions';

/** The page a list call reads: `take` defaults to {@link DEFAULT_PAGE_SIZE} and is capped at {@link MAX_PAGE_SIZE}. */
function toPage(args: TemplateNotesArgs): NotePage {
  const take = Math.min(Math.max(args.take ?? DEFAULT_PAGE_SIZE, 0), MAX_PAGE_SIZE);
  return { take, skip: Math.max(args.skip ?? 0, 0) };
}

/**
 * The Admin API of the template notes. `requirePermission` asks for the catalogue permission on the active store
 * and for a tenant, so each handler runs in the caller's tenant scope.
 */
@Resolver()
export class TemplateNoteResolver {
  constructor(
    private readonly createNote: CreateNoteService,
    private readonly getNotes: GetNotesService,
  ) {}

  /** A note of the caller's business by id, or `null` (another business's note is never found). */
  @Query()
  @requirePermission(NOTE_PERMISSIONS.view)
  templateNote(@Ctx() ctx: RequestContext, @Args() args: TemplateNoteArgs): Promise<TemplateNoteDto | null> {
    return this.inScope(ctx, async (scope) => {
      const note = await this.getNotes.byId(scope, toNoteId(args.id));
      return note === undefined ? null : toTemplateNoteDto(note);
    });
  }

  /** One page of the caller's notes, newest first. */
  @Query()
  @requirePermission(NOTE_PERMISSIONS.view)
  templateNotes(@Ctx() ctx: RequestContext, @Args() args: TemplateNotesArgs): Promise<TemplateNoteDto[]> {
    return this.inScope(ctx, async (scope) => {
      const notes = await this.getNotes.list(scope, toPage(args));
      return notes.map(toTemplateNoteDto);
    });
  }

  /** Creates a note for the caller's business; an invalid title or body is a typed input error. */
  @Transaction()
  @Mutation()
  @requirePermission(NOTE_PERMISSIONS.create)
  createTemplateNote(@Ctx() ctx: RequestContext, @Args() args: CreateTemplateNoteArgs): Promise<TemplateNoteDto> {
    return this.inScope(ctx, async (scope) => toTemplateNoteDto(await this.createNote.execute(scope, args.input)));
  }

  /** Builds the caller's scope and runs `work` in it; a domain error leaves through the one error mapping. */
  private async inScope<T>(ctx: RequestContext, work: (scope: TenantScope) => Promise<T>): Promise<T> {
    try {
      return await work(new RequestTenantScope(ctx, tenantOf(ctx).businessId));
    } catch (error) {
      mapDomainError(error);
    }
  }
}
