import { useMutation, type UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { api, useChannel } from '@vendure/dashboard';
import { type Dispatch, useCallback, useEffect, useReducer } from 'react';
import {
  CREATE_STORE_FAILED_MESSAGE_ID,
  STORE_CHANNEL_POLL_MS,
  STORE_NAME_INVALID_ERROR_CODE,
  STORE_NAME_INVALID_MESSAGE_ID,
  STORE_SWITCH_TIMEOUT_MS,
  SUBDOMAIN_INVALID_ERROR_CODE,
  SUBDOMAIN_REASON_MESSAGE_IDS,
  SUBDOMAIN_TAKEN_ERROR_CODE,
  SWITCHABLE_STORES_QUERY_KEY,
} from '../constants';
import { errorCodeOf } from '../model/api-error';
import {
  awaitedTokenOf,
  canRecheck,
  canSubmitStore,
  type CreateStoreEvent,
  type CreateStoreState,
  createStoreErrorIdOf,
  INITIAL_CREATE_STORE_STATE,
  isCreatingStore,
  nextCreateStoreState,
} from '../model/create-store-state';
import { backoffRefreshTimes } from '../model/refresh-schedule';

const CREATE_STORE_MUTATION = /* GraphQL */ `
  mutation ShellCreateStore($input: CreateStoreInput!) {
    createStore(input: $input) {
      id
      channelToken
    }
  }
`;

/** What Create Store sends (D87). */
export interface CreateStoreInput {
  readonly name: string;
  readonly subdomain: string;
  readonly language: string;
}

interface CreateStoreResult {
  readonly createStore: { readonly channelToken: string };
}

function createErrorMessageId(error: unknown): string {
  const code = errorCodeOf(error);
  if (code === SUBDOMAIN_TAKEN_ERROR_CODE) return SUBDOMAIN_REASON_MESSAGE_IDS.taken;
  if (code === SUBDOMAIN_INVALID_ERROR_CODE) return SUBDOMAIN_REASON_MESSAGE_IDS.format;
  if (code === STORE_NAME_INVALID_ERROR_CODE) return STORE_NAME_INVALID_MESSAGE_ID;
  return CREATE_STORE_FAILED_MESSAGE_ID;
}

/** A Create Store in progress. */
export interface CreateStore {
  readonly submit: (input: CreateStoreInput) => void;
  /** True while the store is being created and until its channel has reached the session. */
  readonly submitting: boolean;
  /** False while a store is on its way, and after a timeout, when the store may already exist (SHELL-8). */
  readonly canSubmit: boolean;
  /** Set after a timeout: waits for the same store again instead of creating another one. */
  readonly recheck: (() => void) | undefined;
  readonly errorId: string | undefined;
  readonly reset: () => void;
}

/**
 * Waits for a new channel to reach the session: `refreshChannels` returns nothing and `setActiveChannel` ignores an
 * unknown id, so this refreshes after 1, 2 and 4 more seconds, watches the channel list and gives up after the
 * timeout (D87).
 */
function useAwaitedChannel(token: string | null, onFound: (channelId: string) => void, onTimeout: () => void): void {
  const { channels, refreshChannels } = useChannel();
  const channelId = channels.find((channel) => channel.token === token)?.id;
  useEffect(() => {
    if (channelId !== undefined) onFound(channelId);
  }, [channelId, onFound]);
  useEffect(() => {
    if (token === null) return undefined;
    // The creator's session can lag behind the new channel, so one refresh is not always enough; backing off keeps
    // a slow server from being asked every second.
    const refreshes = backoffRefreshTimes(STORE_CHANNEL_POLL_MS, STORE_SWITCH_TIMEOUT_MS).map((at) =>
      setTimeout(refreshChannels, at),
    );
    const timer = setTimeout(onTimeout, STORE_SWITCH_TIMEOUT_MS);
    return () => {
      refreshes.forEach(clearTimeout);
      clearTimeout(timer);
    };
  }, [token, onTimeout, refreshChannels]);
}

/** The `createStore` call and what follows it: the token to wait for, or the error to show. */
function useCreateStoreMutation(
  onCreated: (channelToken: string) => void,
  onFailed: (messageId: string) => void,
): UseMutationResult<CreateStoreResult['createStore'], unknown, CreateStoreInput> {
  const { refreshChannels } = useChannel();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateStoreInput) => {
      const result = (await api.mutate(CREATE_STORE_MUTATION, { input })) as CreateStoreResult;
      return result.createStore;
    },
    onSuccess: ({ channelToken }) => {
      onCreated(channelToken);
      refreshChannels();
      void queryClient.invalidateQueries({ queryKey: SWITCHABLE_STORES_QUERY_KEY });
    },
    onError: (error: unknown) => {
      onFailed(createErrorMessageId(error));
    },
  });
}

/** What the dialog sees of a Create Store in `state`; `send` starts the mutation, `refresh` reloads the session. */
function createStoreView(
  state: CreateStoreState,
  dispatch: Dispatch<CreateStoreEvent>,
  send: (input: CreateStoreInput) => void,
  refresh: () => void,
): CreateStore {
  const recheck = (): void => {
    refresh();
    dispatch({ type: 'recheck' });
  };
  return {
    submit: (input) => {
      if (!canSubmitStore(state)) return;
      dispatch({ type: 'submitted' });
      send(input);
    },
    submitting: isCreatingStore(state),
    canSubmit: canSubmitStore(state),
    recheck: canRecheck(state) ? recheck : undefined,
    errorId: createStoreErrorIdOf(state),
    reset: () => {
      dispatch({ type: 'reset' });
    },
  };
}

/** Creates a store, refreshes the session and switches to the new channel once it appears (D87, SHELL-8). */
export function useCreateStore(switchTo: (channelId: string) => Promise<void>, onDone: () => void): CreateStore {
  const [state, dispatch] = useReducer(nextCreateStoreState, INITIAL_CREATE_STORE_STATE);
  const { refreshChannels } = useChannel();
  const mutation = useCreateStoreMutation(
    (token) => {
      dispatch({ type: 'created', token });
    },
    (messageId) => {
      dispatch({ type: 'failed', messageId });
    },
  );
  const onFound = useCallback(
    (channelId: string) => {
      dispatch({ type: 'found' });
      switchTo(channelId).catch((error: unknown) => {
        console.error('Could not switch to the new store', error);
      });
      onDone();
    },
    [switchTo, onDone],
  );
  const onTimeout = useCallback(() => {
    dispatch({ type: 'timed-out' });
  }, []);
  useAwaitedChannel(awaitedTokenOf(state), onFound, onTimeout);
  return createStoreView(state, dispatch, mutation.mutate, refreshChannels);
}
