import { Inject } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { TenantScope } from '@cod/shared';
import { Allow, Ctx, type RequestContext, Transaction } from '@vendure/core';
import { CreateNoteService } from '../application/create-note.service';
import { GetNotesService } from '../application/get-notes.service';
import type { TenantScopeResolver } from '../application/ports/tenant-scope-resolver.port';
import { TENANT_SCOPE_RESOLVER } from '../application/tokens';
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
import { templateNotePermission } from './permissions';

/** The page a list call reads: `take` defaults to {@link DEFAULT_PAGE_SIZE} and is capped at {@link MAX_PAGE_SIZE}. */
function toPage(args: TemplateNotesArgs): NotePage {
  const take = Math.min(Math.max(args.take ?? DEFAULT_PAGE_SIZE, 0), MAX_PAGE_SIZE);
  return { take, skip: Math.max(args.skip ?? 0, 0) };
}

/** The Admin API of the template notes; each handler runs in the caller's tenant scope. */
@Resolver()
export class TemplateNoteResolver {
  constructor(
    private readonly createNote: CreateNoteService,
    private readonly getNotes: GetNotesService,
    @Inject(TENANT_SCOPE_RESOLVER) private readonly scopes: TenantScopeResolver<RequestContext>,
  ) {}

  /** A note of the caller's business by id, or `null` (another business's note is never found). */
  @Query()
  @Allow(templateNotePermission.Read)
  templateNote(@Ctx() ctx: RequestContext, @Args() args: TemplateNoteArgs): Promise<TemplateNoteDto | null> {
    return this.inScope(ctx, async (scope) => {
      const note = await this.getNotes.byId(scope, toNoteId(args.id));
      return note === undefined ? null : toTemplateNoteDto(note);
    });
  }

  /** One page of the caller's notes, newest first. */
  @Query()
  @Allow(templateNotePermission.Read)
  templateNotes(@Ctx() ctx: RequestContext, @Args() args: TemplateNotesArgs): Promise<TemplateNoteDto[]> {
    return this.inScope(ctx, async (scope) => {
      const notes = await this.getNotes.list(scope, toPage(args));
      return notes.map(toTemplateNoteDto);
    });
  }

  /** Creates a note for the caller's business; an invalid title or body is a typed input error. */
  @Transaction()
  @Mutation()
  @Allow(templateNotePermission.Create)
  createTemplateNote(@Ctx() ctx: RequestContext, @Args() args: CreateTemplateNoteArgs): Promise<TemplateNoteDto> {
    return this.inScope(ctx, async (scope) => toTemplateNoteDto(await this.createNote.execute(scope, args.input)));
  }

  /** Resolves the caller's scope and runs `work` in it; a domain error leaves through the one error mapping. */
  private async inScope<T>(ctx: RequestContext, work: (scope: TenantScope) => Promise<T>): Promise<T> {
    try {
      return await work(this.scopes.resolve(ctx));
    } catch (error) {
      mapDomainError(error);
    }
  }
}
