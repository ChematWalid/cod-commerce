import { describe, expect, it } from 'vitest';
import { fetchForStore, isStoreSwitched } from '../../dashboard/model/store-bound-fetch';

const STORE_A_TOKEN = 'token-a';
const STORE_B_TOKEN = 'token-b';

/** A token source the test moves, as a store switch rewrites the stored token. */
function tokenSource(initial: string | null) {
  let current = initial;
  return {
    read: (): string | null => current,
    switchTo: (token: string): void => {
      current = token;
    },
  };
}

describe('store-bound fetch', () => {
  it('returns the answer when requests go to the store the query answers for', async () => {
    // Arrange
    const tokens = tokenSource(STORE_A_TOKEN);

    // Act
    const answer = await fetchForStore(STORE_A_TOKEN, tokens.read, () => Promise.resolve('rows of A'));

    // Assert
    expect(answer).toBe('rows of A');
  });

  it('sends nothing when requests already go to another store', async () => {
    // Arrange
    const tokens = tokenSource(STORE_B_TOKEN);
    let sent = false;

    // Act
    const attempt = fetchForStore(STORE_A_TOKEN, tokens.read, () => {
      sent = true;
      return Promise.resolve('rows of B');
    });

    // Assert
    await expect(attempt).rejects.toSatisfy(isStoreSwitched);
    expect(sent).toBe(false);
  });

  it('drops an answer that arrives after a switch to another store', async () => {
    // Arrange
    const tokens = tokenSource(STORE_A_TOKEN);

    // Act
    const attempt = fetchForStore(STORE_A_TOKEN, tokens.read, () => {
      tokens.switchTo(STORE_B_TOKEN);
      return Promise.resolve('rows sent while the switch happened');
    });

    // Assert
    await expect(attempt).rejects.toSatisfy(isStoreSwitched);
  });

  it('treats a missing stored token as another store', async () => {
    // Arrange
    const tokens = tokenSource(null);

    // Act
    const attempt = fetchForStore(STORE_A_TOKEN, tokens.read, () => Promise.resolve('rows'));

    // Assert
    await expect(attempt).rejects.toSatisfy(isStoreSwitched);
  });

  it('tells a switch apart from an API error', () => {
    // Act
    const apiError = isStoreSwitched(new Error('FORBIDDEN'));

    // Assert
    expect(apiError).toBe(false);
  });
});
