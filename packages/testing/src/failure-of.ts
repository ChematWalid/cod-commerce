/** What a rejected Admin API call carried: the GraphQL errors and the data, if any. */
export interface GraphQlFailure {
  readonly codes: readonly string[];
  readonly data: unknown;
}

interface ClientErrorShape {
  readonly response?: {
    readonly errors?: readonly { readonly extensions?: { readonly code?: string } }[];
    readonly data?: unknown;
  };
}

/**
 * Awaits a call that must fail and returns its GraphQL error codes and data. `SimpleGraphQLClient` throws a
 * `ClientError` holding the response; a call that succeeds fails the test.
 */
export async function failureOf(call: Promise<unknown>): Promise<GraphQlFailure> {
  const error = await call.then(
    () => {
      throw new Error('Expected the GraphQL call to fail, but it succeeded');
    },
    (rejection: unknown) => rejection as ClientErrorShape,
  );
  const errors = error.response?.errors ?? [];
  return { codes: errors.map((entry) => entry.extensions?.code ?? 'NO_CODE'), data: error.response?.data ?? null };
}
