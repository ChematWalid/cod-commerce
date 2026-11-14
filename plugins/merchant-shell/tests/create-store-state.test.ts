import { describe, expect, it } from 'vitest';
import { STORE_SWITCH_TIMEOUT_MESSAGE_ID } from '../dashboard/constants';
import {
  awaitedTokenOf,
  canRecheck,
  canSubmitStore,
  type CreateStoreState,
  createStoreErrorIdOf,
  INITIAL_CREATE_STORE_STATE,
  isCreatingStore,
  nextCreateStoreState,
} from '../dashboard/model/create-store-state';

const TOKEN = 'channel-token-1';

/** The state after a submit whose store was created and whose channel never reached the session in time. */
function timedOut(): CreateStoreState {
  const submitted = nextCreateStoreState(INITIAL_CREATE_STORE_STATE, { type: 'submitted' });
  const created = nextCreateStoreState(submitted, { type: 'created', token: TOKEN });
  return nextCreateStoreState(created, { type: 'timed-out' });
}

describe('create store state', () => {
  it('after a timeout submit is refused and a re-check is offered', () => {
    // Arrange
    const state = timedOut();

    // Act
    const resubmitted = nextCreateStoreState(state, { type: 'submitted' });

    // Assert
    expect(canSubmitStore(state)).toBe(false);
    expect(resubmitted).toEqual(state);
    expect(canRecheck(state)).toBe(true);
    expect(createStoreErrorIdOf(state)).toBe(STORE_SWITCH_TIMEOUT_MESSAGE_ID);
  });

  it('a re-check waits for the same store again', () => {
    // Arrange
    const state = timedOut();

    // Act
    const rechecking = nextCreateStoreState(state, { type: 'recheck' });

    // Assert
    expect(awaitedTokenOf(rechecking)).toBe(TOKEN);
    expect(isCreatingStore(rechecking)).toBe(true);
    expect(createStoreErrorIdOf(rechecking)).toBeUndefined();
  });

  it('waits for the created store and is done once its channel is found', () => {
    // Arrange
    const submitted = nextCreateStoreState(INITIAL_CREATE_STORE_STATE, { type: 'submitted' });

    // Act
    const created = nextCreateStoreState(submitted, { type: 'created', token: TOKEN });
    const found = nextCreateStoreState(created, { type: 'found' });

    // Assert
    expect(isCreatingStore(submitted)).toBe(true);
    expect(canSubmitStore(submitted)).toBe(false);
    expect(awaitedTokenOf(created)).toBe(TOKEN);
    expect(found).toEqual(INITIAL_CREATE_STORE_STATE);
  });

  it('lets the merchant correct the form and submit again after a refusal', () => {
    // Arrange
    const submitted = nextCreateStoreState(INITIAL_CREATE_STORE_STATE, { type: 'submitted' });

    // Act
    const failed = nextCreateStoreState(submitted, { type: 'failed', messageId: 'subdomain.taken' });

    // Assert
    expect(createStoreErrorIdOf(failed)).toBe('subdomain.taken');
    expect(canSubmitStore(failed)).toBe(true);
    expect(canRecheck(failed)).toBe(false);
  });

  it('starts over when the dialog is closed after a refusal', () => {
    // Arrange
    const submitted = nextCreateStoreState(INITIAL_CREATE_STORE_STATE, { type: 'submitted' });
    const refused = nextCreateStoreState(submitted, { type: 'failed', messageId: 'shell.store.create.failed' });

    // Act
    const closed = nextCreateStoreState(refused, { type: 'closed' });

    // Assert
    expect(closed).toEqual(INITIAL_CREATE_STORE_STATE);
  });

  it('keeps a timed-out store across closing and reopening the dialog, so Create stays replaced by a re-check', () => {
    // Arrange
    const state = timedOut();

    // Act
    const closed = nextCreateStoreState(state, { type: 'closed' });

    // Assert
    expect(closed).toEqual(state);
    expect(canSubmitStore(closed)).toBe(false);
    expect(canRecheck(closed)).toBe(true);
  });

  it('ignores a timeout or a found channel it is not waiting for', () => {
    expect(nextCreateStoreState(INITIAL_CREATE_STORE_STATE, { type: 'timed-out' })).toEqual(INITIAL_CREATE_STORE_STATE);
    expect(nextCreateStoreState(timedOut(), { type: 'found' })).toEqual(timedOut());
  });
});
