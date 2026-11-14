import { soldOutOrdersInputSchema } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import type { RequestContext } from '@vendure/core';
import { type SoldOutProduct, SoldOutService } from '../application/sold-out.service';
import { asOperationContext } from '../domain/ports/operation-context';
import { parseInput } from './request-body';
import { scopeOf } from './store-scope-of';

/** One sold-out product as both API surfaces answer it (`CatalogSoldOutProduct`). */
export interface CatalogSoldOutProductDto {
  readonly productId: string;
  readonly title: string;
  readonly allowOutOfStockOrders: boolean;
}

const toDto = ({ productId, title, allowOutOfStockOrders }: SoldOutProduct): CatalogSoldOutProductDto => ({
  productId,
  title,
  allowOutOfStockOrders,
});

/** One path per sold-out action for both API surfaces: parse, take the tenant from the request, run, shape. */
@Injectable()
export class SoldOutActions {
  constructor(private readonly soldOut: SoldOutService) {}

  async list(ctx: RequestContext): Promise<readonly CatalogSoldOutProductDto[]> {
    return (await this.soldOut.list(asOperationContext(ctx), scopeOf(ctx))).map(toDto);
  }

  async stop(ctx: RequestContext, input: unknown): Promise<readonly CatalogSoldOutProductDto[]> {
    const command = parseInput(soldOutOrdersInputSchema, input ?? {});
    return (await this.soldOut.stopOrders(asOperationContext(ctx), scopeOf(ctx), command)).map(toDto);
  }

  async resume(ctx: RequestContext, input: unknown): Promise<readonly CatalogSoldOutProductDto[]> {
    const command = parseInput(soldOutOrdersInputSchema, input ?? {});
    return (await this.soldOut.resumeOrders(asOperationContext(ctx), scopeOf(ctx), command)).map(toDto);
  }
}
