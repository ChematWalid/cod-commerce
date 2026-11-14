import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  type ID,
  type LanguageCode,
  ProductOptionGroupService,
  ProductOptionService,
  ProductService,
  type RequestContext,
} from '@vendure/core';
import { comparableText } from '../domain/comparable-text';
import type { CoreId } from '../domain/core-id';
import type { OptionGroupRecord, OptionValueRecord } from '../domain/product';
import type { OptionGroupSpec } from '../domain/variant-matrix';
import { coreIdOf } from './vendure-product-mapper';

/** The options of a product after a sync, and what must go once the variants that use it are removed. */
export interface OptionSyncResult {
  readonly groups: readonly OptionGroupRecord[];
  readonly staleGroupIds: readonly CoreId[];
  readonly staleOptionIds: readonly CoreId[];
}

/** Where a sync writes: the store context, the product and the store's language (D2112). */
export interface OptionTarget {
  readonly ctx: RequestContext;
  readonly productId: CoreId;
  readonly language: LanguageCode;
}

/** A code no other group or option holds: codes are internal, the names are what merchants see. */
const freshCode = (prefix: string): string => `${prefix}-${randomUUID()}`;

const findByName = <T extends { readonly name: string }>(items: readonly T[], name: string): T | undefined =>
  items.find((item) => comparableText(item.name) === comparableText(name));

/**
 * Brings a product's Vendure option groups and options in line with the wanted options: matched by name without case
 * and Unicode form (Task 9), renamed to the current spelling, reordered through `position` (D2124). Groups are made
 * per product and found only through the product's own groups, never by code or name elsewhere (D2135).
 */
@Injectable()
export class VendureOptionSync {
  constructor(
    private readonly products: ProductService,
    private readonly groupService: ProductOptionGroupService,
    private readonly optionService: ProductOptionService,
  ) {}

  async sync(
    target: OptionTarget,
    current: readonly OptionGroupRecord[],
    wanted: readonly OptionGroupSpec[],
  ): Promise<OptionSyncResult> {
    const groups: OptionGroupRecord[] = [];
    const staleOptionIds: CoreId[] = [];
    for (const [position, spec] of wanted.entries()) {
      const existing = findByName(current, spec.name);
      const group =
        existing === undefined
          ? await this.createGroup(target, spec, position)
          : await this.updateGroup(target, existing, spec, position);
      groups.push(group);
      if (existing !== undefined) {
        staleOptionIds.push(
          ...existing.values
            .filter((value) => findByName(group.values, value.name) === undefined)
            .map((value) => value.id),
        );
      }
    }
    const staleGroupIds = current
      .filter(
        (group) =>
          findByName(
            wanted.map((spec) => ({ name: spec.name })),
            group.name,
          ) === undefined,
      )
      .map((group) => group.id);
    return { groups, staleGroupIds, staleOptionIds };
  }

  private async createGroup(target: OptionTarget, spec: OptionGroupSpec, position: number): Promise<OptionGroupRecord> {
    const { ctx, productId, language } = target;
    const group = await this.groupService.create(ctx, {
      code: freshCode('catalog-group'),
      translations: [{ languageCode: language, name: spec.name }],
      customFields: { position },
    });
    const values: OptionValueRecord[] = [];
    for (const [index, name] of spec.values.entries())
      values.push(await this.createOption(target, group.id, name, index));
    await this.products.addOptionGroupToProduct(ctx, productId, group.id);
    return { id: coreIdOf(group.id), name: spec.name, values };
  }

  private async createOption(
    target: OptionTarget,
    groupId: ID,
    name: string,
    position: number,
  ): Promise<OptionValueRecord> {
    const option = await this.optionService.create(target.ctx, groupId, {
      code: freshCode('catalog-option'),
      translations: [{ languageCode: target.language, name }],
      customFields: { position },
    });
    return { id: coreIdOf(option.id), name };
  }

  private async updateGroup(
    target: OptionTarget,
    existing: OptionGroupRecord,
    spec: OptionGroupSpec,
    position: number,
  ): Promise<OptionGroupRecord> {
    await this.groupService.update(target.ctx, {
      id: existing.id,
      translations: [{ languageCode: target.language, name: spec.name }],
      customFields: { position },
    });
    const values: OptionValueRecord[] = [];
    for (const [index, name] of spec.values.entries()) {
      const option = findByName(existing.values, name);
      if (option === undefined) {
        values.push(await this.createOption(target, existing.id, name, index));
        continue;
      }
      await this.optionService.update(target.ctx, {
        id: option.id,
        translations: [{ languageCode: target.language, name }],
        customFields: { position: index },
      });
      values.push({ id: option.id, name });
    }
    return { id: existing.id, name: spec.name, values };
  }

  /** Deletes options and groups no variant uses any more; Vendure soft-deletes those removed variants still name. */
  async removeStale(target: OptionTarget, result: OptionSyncResult): Promise<void> {
    for (const optionId of result.staleOptionIds) await this.optionService.delete(target.ctx, optionId);
    for (const groupId of result.staleGroupIds) {
      // Groups are made per product (D2135), so forcing only detaches it from this product.
      await this.groupService.delete(target.ctx, groupId, true);
    }
  }
}
