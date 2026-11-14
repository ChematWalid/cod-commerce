import { asOperationContext } from '../../domain/ports/operation-context';
import { describeBrandRepositoryContract } from '../contract/brand-repository.contract';
import { describeHighlightRepositoryContract } from '../contract/highlight-repository.contract';
import { describeMediaRepositoryContract } from '../contract/media-repository.contract';
import { describeProductSettingsRepositoryContract } from '../contract/product-settings-repository.contract';
import type { MakeHarness } from '../contract/repository-harness';
import { describeTagRepositoryContract } from '../contract/tag-repository.contract';
import { InMemoryBrandRepository } from '../fakes/in-memory-brand-repository';
import { InMemoryHighlightRepository } from '../fakes/in-memory-highlight-repository';
import { InMemoryMediaRepository } from '../fakes/in-memory-media-repository';
import { InMemoryProductSettingsRepository } from '../fakes/in-memory-product-settings-repository';
import { InMemoryTagRepository } from '../fakes/in-memory-tag-repository';

const harnessOf =
  <R>(build: () => R): MakeHarness<R> =>
  () =>
    Promise.resolve({ repo: build(), ctx: asOperationContext({}) });

// The fakes the use-case tests run on must keep the same rules as the Postgres adapters (Task 10).
describeBrandRepositoryContract(
  'InMemoryBrandRepository',
  harnessOf(() => new InMemoryBrandRepository()),
);
describeTagRepositoryContract(
  'InMemoryTagRepository',
  harnessOf(() => new InMemoryTagRepository()),
);
describeHighlightRepositoryContract(
  'InMemoryHighlightRepository',
  harnessOf(() => new InMemoryHighlightRepository()),
);
describeProductSettingsRepositoryContract(
  'InMemoryProductSettingsRepository',
  harnessOf(() => new InMemoryProductSettingsRepository()),
);
describeMediaRepositoryContract(
  'InMemoryMediaRepository',
  harnessOf(() => new InMemoryMediaRepository()),
);
