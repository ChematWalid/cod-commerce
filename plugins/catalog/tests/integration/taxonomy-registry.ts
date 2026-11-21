/** The registry entries of the store's brands, tags and highlights (Task 12), one block per kind. */
import { CATALOG_ERROR_CODES } from '@cod/shared';
import type { OperationEntry, RouteEntry, TargetIdField } from './registry-calls';

/** One kind of taxonomy as its API names it. */
interface TaxonomyKind {
  /** `Brand`, `Tag` or `Highlight`: the operation names are `catalog<Name>s`, `create|update|deleteCatalog<Name>`. */
  readonly name: string;
  readonly path: string;
  readonly idField: TargetIdField;
  readonly notFound: string;
  /** The field of its input and answer: `name` or `text`. */
  readonly field: 'name' | 'text';
}

const KINDS: readonly TaxonomyKind[] = [
  { name: 'Brand', path: 'brands', idField: 'brandId', notFound: CATALOG_ERROR_CODES.BRAND_NOT_FOUND, field: 'name' },
  { name: 'Tag', path: 'tags', idField: 'tagId', notFound: CATALOG_ERROR_CODES.TAG_NOT_FOUND, field: 'name' },
  {
    name: 'Highlight',
    path: 'highlights',
    idField: 'highlightId',
    notFound: CATALOG_ERROR_CODES.HIGHLIGHT_NOT_FOUND,
    field: 'text',
  },
];

const VIEW = 'catalog.products.view';
const EDIT = 'catalog.products.edit';

function operationsOf(kind: TaxonomyKind): OperationEntry[] {
  const { name, idField, notFound, field } = kind;
  const input = (): Record<string, string> => ({ [field]: `Synthetic ${name} ${String(Date.now())}` });
  const about = { idField, notFound };
  return [
    {
      operation: `catalog${name}s`,
      access: VIEW,
      foreign: 'own-only',
      byId: false,
      ...about,
      document: `query { catalog${name}s { id ${field} } }`,
      variables: () => ({}),
    },
    {
      operation: `createCatalog${name}`,
      access: EDIT,
      foreign: 'own-only',
      byId: false,
      ...about,
      document: `mutation ($input: Catalog${name}Input!) { createCatalog${name}(input: $input) { id } }`,
      variables: () => ({ input: input() }),
    },
    {
      operation: `updateCatalog${name}`,
      access: EDIT,
      foreign: 'not-found',
      byId: true,
      ...about,
      document: `mutation ($id: String!, $input: Catalog${name}Input!) { updateCatalog${name}(id: $id, input: $input) { id } }`,
      variables: (ids) => ({ id: ids[idField], input: input() }),
    },
    {
      operation: `deleteCatalog${name}`,
      access: EDIT,
      foreign: 'not-found',
      byId: true,
      ...about,
      document: `mutation ($id: String!) { deleteCatalog${name}(id: $id) }`,
      variables: (ids) => ({ id: ids[idField] }),
    },
  ];
}

function routesOf(kind: TaxonomyKind): RouteEntry[] {
  const { name, path, idField, notFound, field } = kind;
  const base = `/catalog/${path}`;
  const about = { idField, notFound };
  const body = (): Record<string, string> => ({ [field]: `Synthetic ${name} ${String(Date.now())}` });
  return [
    { method: 'GET', route: base, access: VIEW, foreign: 'own-only', ...about, url: () => base },
    { method: 'POST', route: base, access: EDIT, foreign: 'own-only', ...about, url: () => base, body },
    {
      method: 'PATCH',
      route: `${base}/:id`,
      access: EDIT,
      foreign: 'not-found',
      ...about,
      url: (ids) => `${base}/${ids[idField]}`,
      body,
    },
    {
      method: 'DELETE',
      route: `${base}/:id`,
      access: EDIT,
      foreign: 'not-found',
      ...about,
      url: (ids) => `${base}/${ids[idField]}`,
    },
  ];
}

/** Every Admin API operation of the store taxonomy. */
export const TAXONOMY_OPERATIONS: readonly OperationEntry[] = KINDS.flatMap(operationsOf);

/** Every REST route of the store taxonomy. */
export const TAXONOMY_ROUTES: readonly RouteEntry[] = KINDS.flatMap(routesOf);
