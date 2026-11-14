import { describe, expect, it } from 'vitest';
import { listErrorMessageId } from '../../dashboard/model/list-view';
import { sendRowCommand } from '../../dashboard/model/row-commands';
import { isStoreSwitched } from '../../dashboard/model/store-bound-fetch';

const STORE_A_TOKEN = 'token-a';
const STORE_B_TOKEN = 'token-b';

/** A mutate that records what it was sent. */
function recordingMutate() {
  const sent: { readonly document: string; readonly variables: object }[] = [];
  return {
    sent,
    mutate: (document: string, variables: object): Promise<unknown> => {
      sent.push({ document, variables });
      return Promise.resolve({});
    },
  };
}

describe('list row commands', () => {
  it.each([
    ['set-draft', 'setCatalogProductStatus', { id: 'p1', status: 'draft' }],
    ['delete', 'deleteCatalogProduct', { id: 'p1' }],
  ] as const)('sends %s while requests go to the store the list is open for', async (command, field, variables) => {
    // Arrange
    const api = recordingMutate();

    // Act
    await sendRowCommand(
      { store: { channelToken: STORE_A_TOKEN }, readToken: () => STORE_A_TOKEN, mutate: api.mutate },
      command,
      'p1',
    );

    // Assert
    expect(api.sent).toHaveLength(1);
    expect(api.sent[0]?.document).toContain(field);
    expect(api.sent[0]?.variables).toEqual(variables);
  });

  it.each(['set-draft', 'delete'] as const)(
    'sends no %s once another tab switched the store, and says the store changed',
    async (command) => {
      // Arrange
      const api = recordingMutate();

      // Act
      const error = await sendRowCommand(
        { store: { channelToken: STORE_A_TOKEN }, readToken: () => STORE_B_TOKEN, mutate: api.mutate },
        command,
        'p1',
      ).catch((caught: unknown) => caught);

      // Assert
      expect(api.sent).toEqual([]);
      expect(isStoreSwitched(error)).toBe(true);
      expect(listErrorMessageId(error)).toBe('catalog.error-store-switched');
    },
  );

  it('sends nothing before the store the list is open for is known', async () => {
    // Arrange
    const api = recordingMutate();

    // Act
    const error = await sendRowCommand(
      { store: null, readToken: () => STORE_A_TOKEN, mutate: api.mutate },
      'delete',
      'p1',
    ).catch((caught: unknown) => caught);

    // Assert
    expect(api.sent).toEqual([]);
    expect(isStoreSwitched(error)).toBe(true);
  });
});
