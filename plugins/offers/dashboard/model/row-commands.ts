import { sendForStore } from './store-bound-fetch';

const lifecycleMutation = (name: string, field: string): string =>
  `mutation ${name}($id: String!) { ${field}(id: $id) { id status } }`;

/** A list command the server runs (D2510, D2511, D2521): its request and the message shown when it succeeded. */
const ROW_COMMANDS = {
  duplicate: {
    document: lifecycleMutation('OfferDuplicate', 'duplicateOffer'),
    doneId: 'offers.duplicate-done',
  },
  pause: { document: lifecycleMutation('OfferPause', 'pauseOffer'), doneId: 'offers.pause-done' },
  resume: { document: lifecycleMutation('OfferResume', 'resumeOffer'), doneId: 'offers.resume-done' },
  archive: { document: lifecycleMutation('OfferArchive', 'archiveOffer'), doneId: 'offers.archive-done' },
  delete: { document: 'mutation OfferDelete($id: String!) { deleteOffer(id: $id) }', doneId: 'offers.delete-done' },
} as const;

export type OfferCommand = keyof typeof ROW_COMMANDS;

/** How a row command reaches the server: the list's store, the token requests carry now, and the sender. */
export interface RowCommandRoute {
  /** The store the list is open for (its channel token), `null` while it is not known. */
  readonly store: { readonly channelToken: string } | null;
  readonly readToken: () => string | null;
  /** Sends a GraphQL mutation: the dashboard's `api.mutate` in the app, a recorder in tests. */
  readonly mutate: (document: string, variables: object) => Promise<unknown>;
}

/** The message id shown when `command` succeeded. */
export const rowCommandDoneId = (command: OfferCommand): string => ROW_COMMANDS[command].doneId;

/**
 * Runs `command` on `offerId` only while requests go to the list's store ({@link sendForStore}), so a store switched
 * in another tab answers "the store changed" instead of sending the write with the other store's token.
 */
export function sendRowCommand(route: RowCommandRoute, command: OfferCommand, offerId: string): Promise<unknown> {
  return sendForStore(route.store?.channelToken ?? null, route.readToken, () =>
    route.mutate(ROW_COMMANDS[command].document, { id: offerId }),
  );
}
