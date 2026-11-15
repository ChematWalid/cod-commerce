import {
  createStoreCollectionInputSchema,
  storeCollectionListQuerySchema,
  updateStoreCollectionInputSchema,
} from '@cod/shared';
import { Injectable } from '@nestjs/common';
import type { RequestContext } from '@vendure/core';
import { CreateCollectionService } from '../application/create-collection.service';
import { DeleteCollectionService } from '../application/delete-collection.service';
import { GetCollectionService } from '../application/get-collection.service';
import { ListCollectionsService } from '../application/list-collections.service';
import { UpdateCollectionService } from '../application/update-collection.service';
import { CollectionNotFoundError } from '../domain/errors';
import { asOperationContext } from '../domain/ports/operation-context';
import { type StoreCollectionDto, type StoreCollectionListDto, toCollectionDto, toCollectionListDto } from './dto';
import { idArgOf, parseInput } from './request-body';
import { scopeOf } from './store-scope-of';

/** The collection read use cases. */
@Injectable()
export class CollectionReadUseCases {
  constructor(
    readonly list: ListCollectionsService,
    readonly get: GetCollectionService,
  ) {}
}

/** The collection use cases the actions drive. */
@Injectable()
export class CollectionUseCases {
  constructor(
    readonly create: CreateCollectionService,
    readonly update: UpdateCollectionService,
    readonly remove: DeleteCollectionService,
    readonly reads: CollectionReadUseCases,
  ) {}
}

/**
 * One path per action for both API surfaces (team pattern): parse the input with the shared schema, take the store
 * from the session and channel token (ADR 0008), run the use case and shape the answer. Resolvers and controllers only
 * add error mapping.
 */
@Injectable()
export class CollectionsActions {
  constructor(private readonly useCases: CollectionUseCases) {}

  async list(ctx: RequestContext, options: unknown): Promise<StoreCollectionListDto> {
    const query = parseInput(storeCollectionListQuerySchema, options ?? {});
    const page = await this.useCases.reads.list.list(asOperationContext(ctx), scopeOf(ctx), query);
    return toCollectionListDto(page);
  }

  /** The collection, or `null` when the store has none with that id (GraphQL's read of none). */
  async find(ctx: RequestContext, id: unknown): Promise<StoreCollectionDto | null> {
    const view = await this.useCases.reads.get.find(asOperationContext(ctx), scopeOf(ctx), idArgOf(id));
    return view === undefined ? null : toCollectionDto(view);
  }

  /** The collection. @throws {CollectionNotFoundError} when the store has none with that id (REST's 404). */
  async get(ctx: RequestContext, id: unknown): Promise<StoreCollectionDto> {
    const found = await this.find(ctx, id);
    if (found === null) throw new CollectionNotFoundError();
    return found;
  }

  async create(ctx: RequestContext, input: unknown): Promise<StoreCollectionDto> {
    const command = parseInput(createStoreCollectionInputSchema, input);
    return toCollectionDto(await this.useCases.create.create(asOperationContext(ctx), scopeOf(ctx), command));
  }

  async update(ctx: RequestContext, id: unknown, input: unknown): Promise<StoreCollectionDto> {
    const command = parseInput(updateStoreCollectionInputSchema, input);
    const view = await this.useCases.update.update(asOperationContext(ctx), scopeOf(ctx), idArgOf(id), command);
    return toCollectionDto(view);
  }

  async delete(ctx: RequestContext, id: unknown): Promise<void> {
    await this.useCases.remove.delete(asOperationContext(ctx), scopeOf(ctx), idArgOf(id));
  }
}
