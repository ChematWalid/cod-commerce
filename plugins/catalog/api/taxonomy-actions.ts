import {
  type BrandCommand,
  brandInputSchema,
  type HighlightCommand,
  highlightInputSchema,
  type TagCommand,
  tagInputSchema,
} from '@cod/shared';
import { Injectable } from '@nestjs/common';
import type { RequestContext } from '@vendure/core';
import type { z } from 'zod';
import { BrandService } from '../application/brand.service';
import { HighlightService } from '../application/highlight.service';
import { TagService } from '../application/tag.service';
import type { Highlight } from '../domain/highlight';
import { asOperationContext, type OperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import type { CatalogNameEntry } from '../domain/taxonomy';
import { idArgOf, parseInput } from './request-body';
import { scopeOf } from './store-scope-of';
import { type CatalogHighlightDto, type CatalogNameDto, toHighlightDto, toNameDto } from './taxonomy-dto';

/** The use cases of one kind of store taxonomy (brands, tags or highlights), as the actions drive them. */
interface TaxonomyUseCase<Command, Entry> {
  list(ctx: OperationContext, scope: StoreScope): Promise<readonly Entry[]>;
  create(ctx: OperationContext, scope: StoreScope, command: Command): Promise<Entry>;
  update(ctx: OperationContext, scope: StoreScope, rawId: string, command: Command): Promise<Entry>;
  delete(ctx: OperationContext, scope: StoreScope, rawId: string): Promise<void>;
}

/**
 * One path per action of one kind for both API surfaces (team pattern): parse the input with the shared schema, take
 * the tenant from the request, run the use case and shape the answer.
 */
export class TaxonomyKindActions<Command, Entry, Dto> {
  constructor(
    private readonly useCase: TaxonomyUseCase<Command, Entry>,
    private readonly schema: z.ZodType<Command>,
    private readonly toDto: (entry: Entry) => Dto,
  ) {}

  async list(ctx: RequestContext): Promise<Dto[]> {
    return (await this.useCase.list(asOperationContext(ctx), scopeOf(ctx))).map((entry) => this.toDto(entry));
  }

  async create(ctx: RequestContext, input: unknown): Promise<Dto> {
    const command = parseInput(this.schema, input);
    return this.toDto(await this.useCase.create(asOperationContext(ctx), scopeOf(ctx), command));
  }

  async update(ctx: RequestContext, id: unknown, input: unknown): Promise<Dto> {
    const command = parseInput(this.schema, input);
    return this.toDto(await this.useCase.update(asOperationContext(ctx), scopeOf(ctx), idArgOf(id), command));
  }

  async delete(ctx: RequestContext, id: unknown): Promise<void> {
    await this.useCase.delete(asOperationContext(ctx), scopeOf(ctx), idArgOf(id));
  }
}

/** The actions of the store's brands, tags and highlights; resolvers and controllers only add error mapping. */
@Injectable()
export class TaxonomyActions {
  readonly brands: TaxonomyKindActions<BrandCommand, CatalogNameEntry, CatalogNameDto>;
  readonly tags: TaxonomyKindActions<TagCommand, CatalogNameEntry, CatalogNameDto>;
  readonly highlights: TaxonomyKindActions<HighlightCommand, Highlight, CatalogHighlightDto>;

  constructor(brands: BrandService, tags: TagService, highlights: HighlightService) {
    this.brands = new TaxonomyKindActions(brands, brandInputSchema, toNameDto);
    this.tags = new TaxonomyKindActions(tags, tagInputSchema, toNameDto);
    this.highlights = new TaxonomyKindActions(highlights, highlightInputSchema, toHighlightDto);
  }
}
