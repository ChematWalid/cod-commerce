import { sendForStore } from './store-bound-fetch';

const SET_STATUS_MUTATION = `mutation CatalogSetStatus($id: ID!, $status: CatalogProductStatus!) {
  setCatalogProductStatus(id: $id, status: $status) { id status } }`;
const DELETE_MUTATION = 'mutation CatalogDeleteProduct($id: ID!) { deleteCatalogProduct(id: $id) }';

/** A list command the server runs: its request and the message shown when it succeeded. */
const ROW_COMMANDS = {
  'set-draft': {
    document: SET_STATUS_MUTATION,
    variablesOf: (id: string) => ({ id, status: 'draft' }),
    doneId: 'catalog.set-draft-done',
  },
  delete: { document: DELETE_MUTATION, variablesOf: (id: string) => ({ id }), doneId: 'catalog.delete-done' },
} as const;

export type ProductCommand = keyof typeof ROW_COMMANDS;

/** How a row command reaches the server: the list's store, the token requests carry now, and the sender. */
export interface RowCommandRoute {
  /** The store the list is open for (its channel token), `null` while it is not known. */
  readonly store: { readonly channelToken: string } | null;
  readonly readToken: () => string | null;
  /** Sends a GraphQL mutation: the dashboard's `api.mutate` in the app, a recorder in tests. */
  readonly mutate: (document: string, variables: object) => Promise<unknown>;
}

/** The message id shown when `command` succeeded. */
export const rowCommandDoneId = (command: ProductCommand): string => ROW_COMMANDS[command].doneId;

/**
 * Runs `command` on `productId` only while requests go to the list's store ({@link sendForStore}), so a store switched
 * in another tab answers "the store changed" instead of sending the write with the other store's token.
 */
export function sendRowCommand(route: RowCommandRoute, command: ProductCommand, productId: string): Promise<unknown> {
  const { document, variablesOf } = ROW_COMMANDS[command];
  return sendForStore(route.store?.channelToken ?? null, route.readToken, () =>
    route.mutate(document, variablesOf(productId)),
  );
}
