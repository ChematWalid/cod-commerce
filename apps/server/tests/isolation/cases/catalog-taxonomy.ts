import { TAXONOMY_KINDS } from '../catalog-operations';
import { catalogOf, type CatalogWorld } from '../catalog-world';
import { type IsolationCase, ownerGraphql, ownerRest } from '../matrix';

/**
 * The list cells of the store's brands, tags and highlights (P2.S1): A's owner sees A's own rows, over GraphQL and
 * REST, and none of B's (the leak scan). By-id reads and writes, B's token and malformed ids come from the sweep.
 */

/** The id and the shown text of the row of `kind` in a business's catalog. */
const ROW_OF: Readonly<Record<string, (catalog: CatalogWorld) => readonly string[]>> = {
  Brand: (catalog) => [catalog.brand.id, catalog.brand.name],
  Tag: (catalog) => [catalog.tag.id, catalog.tag.name],
  Highlight: (catalog) => [catalog.highlight.id, catalog.highlight.text],
};

export const CATALOG_TAXONOMY_CASES: readonly IsolationCase[] = TAXONOMY_KINDS.flatMap(
  ({ name, path, entity, text }): IsolationCase[] => {
    const rowOf = ROW_OF[name] ?? (() => []);
    const operation = `catalog${name}s`;
    return [
      {
        id: `catalog.${operation}.list`,
        entity,
        endpoint: operation,
        access: 'list',
        title: `A's owner lists A's ${entity}s: A's own only`,
        request: (a) => ownerGraphql(a, `query { ${operation} { id ${text} } }`),
        expect: { kind: 'own', mustInclude: (a) => rowOf(catalogOf(a)) },
        reverse: true,
      },
      {
        id: `catalog.get-/catalog/${path}.list`,
        entity,
        endpoint: `GET /catalog/${path}`,
        access: 'list',
        title: `A's owner lists A's ${entity}s over REST: A's own only`,
        request: (a) => ownerRest(a, 'GET', `/catalog/${path}`),
        expect: { kind: 'own', mustInclude: (a) => rowOf(catalogOf(a)) },
        reverse: true,
      },
    ];
  },
);
