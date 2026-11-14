import { STORE_SWITCH_TIMEOUT_MESSAGE_ID } from '../constants';

/**
 * Where a Create Store stands (D87, SHELL-8). After a timeout the store may already exist, so the form stays closed to a
 * second submit and offers a re-check of the session instead.
 */
export type CreateStoreState =
  | { readonly kind: 'idle'; readonly errorId?: string }
  | { readonly kind: 'creating' }
  | { readonly kind: 'awaiting'; readonly token: string }
  | { readonly kind: 'timed-out'; readonly token: string };

/** What happens to a Create Store. */
export type CreateStoreEvent =
  | { readonly type: 'submitted' }
  | { readonly type: 'created'; readonly token: string }
  | { readonly type: 'failed'; readonly messageId: string }
  | { readonly type: 'found' }
  | { readonly type: 'timed-out' }
  | { readonly type: 'recheck' }
  | { readonly type: 'reset' };

export const INITIAL_CREATE_STORE_STATE: CreateStoreState = { kind: 'idle' };

type AwaitingState = Extract<CreateStoreState, { readonly kind: 'awaiting' }>;
type TimedOutState = Extract<CreateStoreState, { readonly kind: 'timed-out' }>;

function afterCreating(state: CreateStoreState, event: CreateStoreEvent): CreateStoreState {
  if (event.type === 'created') return { kind: 'awaiting', token: event.token };
  return event.type === 'failed' ? { kind: 'idle', errorId: event.messageId } : state;
}

function afterAwaiting(state: AwaitingState, event: CreateStoreEvent): CreateStoreState {
  if (event.type === 'found') return INITIAL_CREATE_STORE_STATE;
  return event.type === 'timed-out' ? { kind: 'timed-out', token: state.token } : state;
}

const afterTimeout = (state: TimedOutState, event: CreateStoreEvent): CreateStoreState =>
  event.type === 'recheck' ? { kind: 'awaiting', token: state.token } : state;

/** The state after `event`; an event the state does not expect leaves it as it is. */
export function nextCreateStoreState(state: CreateStoreState, event: CreateStoreEvent): CreateStoreState {
  if (event.type === 'reset') return INITIAL_CREATE_STORE_STATE;
  switch (state.kind) {
    case 'idle':
      return event.type === 'submitted' ? { kind: 'creating' } : state;
    case 'creating':
      return afterCreating(state, event);
    case 'awaiting':
      return afterAwaiting(state, event);
    case 'timed-out':
      return afterTimeout(state, event);
  }
}

/** Only a fresh or refused form can be sent; never while a store is on its way or may already exist. */
export const canSubmitStore = (state: CreateStoreState): boolean => state.kind === 'idle';

/** Whether "check again" is offered: the store was created but its channel has not reached the session yet. */
export const canRecheck = (state: CreateStoreState): boolean => state.kind === 'timed-out';

/** True while the store is being created and until its channel has reached the session. */
export const isCreatingStore = (state: CreateStoreState): boolean =>
  state.kind === 'creating' || state.kind === 'awaiting';

/** The channel token being waited for, if any. */
export const awaitedTokenOf = (state: CreateStoreState): string | null =>
  state.kind === 'awaiting' ? state.token : null;

/** The catalogue id of the line to show, if any. */
export function createStoreErrorIdOf(state: CreateStoreState): string | undefined {
  if (state.kind === 'timed-out') return STORE_SWITCH_TIMEOUT_MESSAGE_ID;
  return state.kind === 'idle' ? state.errorId : undefined;
}
