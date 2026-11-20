import { CatalogPlugin } from '@cod/plugin-catalog';
import { PlatformJobsPlugin } from '@cod/plugin-platform-jobs';
import { PlatformOutboxPlugin } from '@cod/plugin-platform-outbox';
import { RateLimitPlugin } from '@cod/plugin-rate-limit';
import { TenancyPlugin } from '@cod/plugin-tenancy';
import { COLLECTIONS_ERROR_CODES, DomainError } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { CreateCollectionService } from '../../application/create-collection.service';
import { SaveRecomputeService } from '../../application/save-recompute.service';
import { UpdateCollectionService } from '../../application/update-collection.service';
import { COLLECTIONS_PROVIDERS } from '../../infrastructure/collections.providers';
import * as errors from '../../domain/errors';
import { CollectionsRulesPlugin } from '../../index';

/** Nest's module metadata key for `imports`, and Vendure's keys for the dashboard entry and the compatibility. */
const IMPORTS_KEY = 'imports';
const DASHBOARD_KEY = 'dashboard';
const COMPATIBILITY_KEY = 'compatibility';

describe('CollectionsRulesPlugin', () => {
  it('imports tenancy, the outbox, the job pools, the rate limiter and the catalog it builds on', () => {
    // Arrange
    const plugin = CollectionsRulesPlugin;

    // Act
    const imports = Reflect.getMetadata(IMPORTS_KEY, plugin) as readonly unknown[];

    // Assert
    expect(imports).toEqual(
      expect.arrayContaining([TenancyPlugin, PlatformOutboxPlugin, PlatformJobsPlugin, RateLimitPlugin, CatalogPlugin]),
    );
  });

  it('declares its dashboard entry and the Vendure 3.8 compatibility range', () => {
    // Arrange
    const plugin = CollectionsRulesPlugin;

    // Act
    const dashboard: unknown = Reflect.getMetadata(DASHBOARD_KEY, plugin);
    const compatibility: unknown = Reflect.getMetadata(COMPATIBILITY_KEY, plugin);

    // Assert
    expect(dashboard).toBe('./dashboard/index.tsx');
    expect(compatibility).toBe('^3.8.0');
  });
});

describe('collections domain errors', () => {
  it('has one typed error per collections error code', () => {
    // Arrange
    const errorClasses = Object.values(errors) as (new () => DomainError)[];

    // Act
    const codes = errorClasses.map((ErrorClass) => new ErrorClass().code).sort();

    // Assert
    expect(codes).toEqual(Object.values(COLLECTIONS_ERROR_CODES).sort());
  });

  it.each([CreateCollectionService, UpdateCollectionService])(
    '%o saves through the save-time recompute, which queues the store reconcile over the sync cap (D2312)',
    (service) => {
      // Act
      const provider = COLLECTIONS_PROVIDERS.find(
        (candidate) => typeof candidate === 'object' && 'provide' in candidate && candidate.provide === service,
      );

      // Assert
      expect(provider).toMatchObject({ inject: expect.arrayContaining([SaveRecomputeService]) as unknown });
    },
  );
});
