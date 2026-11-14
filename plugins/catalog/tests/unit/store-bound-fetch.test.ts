import { describe, expect, it } from 'vitest';
import { listErrorMessageId } from '../../dashboard/model/list-view';
import {
  fetchForStore,
  isStoreSwitched,
  isStoreTokenMissing,
  retriesStoreSwitch,
  sendForStore,
  StoreSwitchedError,
} from '../../dashboard/model/store-bound-fetch';

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

  it('refuses a read with a missing stored token as an error of its own, not as a switch', async () => {
    // Arrange
    const tokens = tokenSource(null);
    let sent = false;

    // Act
    const attempt = fetchForStore(STORE_A_TOKEN, tokens.read, () => {
      sent = true;
      return Promise.resolve('rows');
    });

    // Assert
    await expect(attempt).rejects.toSatisfy(isStoreTokenMissing);
    await expect(attempt).rejects.not.toSatisfy(isStoreSwitched);
    expect(sent).toBe(false);
  });

  it('refuses a write with a missing stored token as an error of its own', async () => {
    // Arrange
    const tokens = tokenSource(null);

    // Act
    const attempt = sendForStore(STORE_A_TOKEN, tokens.read, () => Promise.resolve('created'));

    // Assert
    await expect(attempt).rejects.toSatisfy(isStoreTokenMissing);
  });

  it('shows a missing stored token as the generic error, never as loading', async () => {
    // Arrange
    const attempt = fetchForStore(STORE_A_TOKEN, tokenSource(null).read, () => Promise.resolve('rows'));

    // Act
    const error: unknown = await attempt.catch((caught: unknown) => caught);

    // Assert
    expect(listErrorMessageId(error)).toBe('catalog.error-generic');
  });

  it('retries a dropped answer of a switched store once, then lets the error show', () => {
    // Arrange
    const switched = new StoreSwitchedError();

    // Act
    const answers = [retriesStoreSwitch(0, switched), retriesStoreSwitch(1, switched)];

    // Assert
    expect(answers).toEqual([true, false]);
  });

  it('does not retry an API error', () => {
    // Act
    const retried = retriesStoreSwitch(0, new Error('FORBIDDEN'));

    // Assert
    expect(retried).toBe(false);
  });

  it('tells a switch apart from an API error', () => {
    // Act
    const apiError = isStoreSwitched(new Error('FORBIDDEN'));

    // Assert
    expect(apiError).toBe(false);
  });

  it('sends a write with the token of the store the editor is open for', async () => {
    // Arrange
    const tokens = tokenSource(STORE_A_TOKEN);

    // Act
    const answer = await sendForStore(STORE_A_TOKEN, tokens.read, () => Promise.resolve('created in A'));

    // Assert
    expect(answer).toBe('created in A');
  });

  it('refuses a write before sending it when requests go to another store', async () => {
    // Arrange
    const tokens = tokenSource(STORE_B_TOKEN);
    let sent = false;

    // Act
    const attempt = sendForStore(STORE_A_TOKEN, tokens.read, () => {
      sent = true;
      return Promise.resolve('created in B');
    });

    // Assert
    await expect(attempt).rejects.toSatisfy(isStoreSwitched);
    expect(sent).toBe(false);
  });

  it('refuses a write while the store is still unknown', async () => {
    // Arrange
    const tokens = tokenSource(STORE_A_TOKEN);
    let sent = false;

    // Act
    const attempt = sendForStore(null, tokens.read, () => {
      sent = true;
      return Promise.resolve('created');
    });

    // Assert
    await expect(attempt).rejects.toSatisfy(isStoreSwitched);
    expect(sent).toBe(false);
  });

  it('keeps the answer of a write sent before a switch, since the write already happened', async () => {
    // Arrange
    const tokens = tokenSource(STORE_A_TOKEN);

    // Act
    const answer = await sendForStore(STORE_A_TOKEN, tokens.read, () => {
      tokens.switchTo(STORE_B_TOKEN);
      return Promise.resolve('created in A');
    });

    // Assert
    expect(answer).toBe('created in A');
  });
});
