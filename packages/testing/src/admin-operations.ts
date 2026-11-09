import type gql from 'graphql-tag';

/** A parsed GraphQL document, named without depending on `graphql` directly. */
export type GraphQlDocument = ReturnType<typeof gql>;

const ROOT_TYPES = new Set(['Query', 'Mutation']);

/** Every query and mutation a plugin's `adminApiSchema` declares, sorted: what an isolation registry must cover. */
export function adminOperationsOf(schema: GraphQlDocument): string[] {
  return schema.definitions
    .flatMap((definition) =>
      'fields' in definition && ROOT_TYPES.has(definition.name.value)
        ? (definition.fields ?? []).map((field) => field.name.value)
        : [],
    )
    .sort();
}
