import { COLLECTIONS_ERROR_CODES } from '@cod/shared';
import type { RequestContext } from '@vendure/core';
import { describe, expect, it, vi } from 'vitest';
import type { CollectionsThrottle } from '../../api/preview-throttle';
import { RulesActions, type RulesUseCases } from '../../api/rules-actions';
import { scopeA } from '../support/builders';

vi.mock('../../api/store-scope-of', () => ({ scopeOf: () => scopeA }));

const ctx = { activeUserId: 1 } as unknown as RequestContext;

describe('RulesActions.preview', () => {
  it('spends no preview budget on an input it refuses (D2338)', async () => {
    // Arrange
    const spendPreview = vi.fn(() => Promise.resolve());
    const run = vi.fn();
    const actions = new RulesActions(
      { preview: { run } } as unknown as RulesUseCases,
      { spendPreview } as unknown as CollectionsThrottle,
    );

    // Act
    const answer = actions.preview(ctx, { rule: { match: 'all', conditions: 'half-typed' } });

    // Assert
    await expect(answer).rejects.toMatchObject({ code: COLLECTIONS_ERROR_CODES.RULE_INVALID });
    expect(spendPreview).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });
});
