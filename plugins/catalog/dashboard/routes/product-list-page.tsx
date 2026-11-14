import { ACTIVE_STORE_ALIAS, type ShellPageProps, storePathFor } from '@cod/plugin-merchant-shell/shell-api';
import { CATALOG_PRODUCT_LIST_PAGE_ID } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  ActionBarItem,
  Button,
  FullWidthPageBlock,
  Page,
  PageActionBar,
  PageLayout,
  PageTitle,
} from '@vendure/dashboard';
import { type ReactNode, useDeferredValue, useEffect, useState } from 'react';
import { DeleteDialog } from '../components/delete-dialog';
import { ListFilters } from '../components/list-filters';
import { ListPager } from '../components/list-pager';
import { ProductTable } from '../components/product-table';
import { SoldOutBar } from '../components/sold-out-bar';
import type { RowCommand } from '../components/row-actions';
import { StatusTabs } from '../components/status-tabs';
import {
  CREATE_PRODUCT_TEST_ID,
  CREATE_PRODUCTS_KEY,
  NEW_PRODUCT_PATH,
  PRODUCT_LIST_TEST_ID,
  PRODUCTS_EMPTY_TEST_ID,
  productPathOf,
} from '../constants';
import type { CatalogProductRowDto } from '../dto';
import { useProductCommand } from '../hooks/use-product-commands';
import { useStoreScope } from '../hooks/use-store-scope';
import {
  clampPage,
  INITIAL_LIST_STATE,
  isNarrowed,
  listQueryOf,
  type ProductListFilterChange,
  type ProductListState,
  withFilter,
  withPage,
} from '../model/list-search';
import { listErrorMessageId } from '../model/list-view';
import { soldOutOrdersOffered } from '../model/sold-out-view';
import { isStoreSwitched } from '../model/store-bound-fetch';
import {
  type StoreScope,
  useCatalogBrands,
  useCatalogProducts,
  useCatalogTags,
  useHeldPermissions,
  useMediaPreviews,
} from '../queries';

const LIST_BLOCK_ID = 'catalog-product-list';
const CREATE_ACTION_ID = 'catalog-create-product';

/** The list's state; the search reaches the query deferred, so typing stays responsive. */
function useListState() {
  const [state, setState] = useState<ProductListState>(INITIAL_LIST_STATE);
  const deferredSearch = useDeferredValue(state.search);
  return { state, query: listQueryOf({ ...state, search: deferredSearch }), setState };
}

/** Runs a row action: Edit opens the editor, Set draft runs at once, Delete asks first. */
function useRowCommands(storeAlias: string) {
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState<CatalogProductRowDto | null>(null);
  const command = useProductCommand(() => {
    setDeleting(null);
  });
  const onCommand = (action: RowCommand, product: CatalogProductRowDto): void => {
    if (action === 'edit') void navigate({ to: storePathFor(productPathOf(product.id), storeAlias) });
    if (action === 'set-draft') command.mutate({ command: 'set-draft', productId: product.id });
    if (action === 'delete') setDeleting(product);
  };
  return { onCommand, deleting, setDeleting, command };
}

function ListBody(props: {
  readonly scope: StoreScope | null;
  readonly products: ReturnType<typeof useCatalogProducts>;
  readonly narrowed: boolean;
  readonly pastLastPage: boolean;
  readonly held: ReadonlySet<string>;
  readonly onCommand: (action: RowCommand, product: CatalogProductRowDto) => void;
}): ReactNode {
  const { i18n } = useLingui();
  const previews = useMediaPreviews(props.scope);
  const { products } = props;
  // A dropped answer of the store switched away from: the list is about to show the new store, not an error.
  if (products.isError && !isStoreSwitched(products.error))
    return <p role="alert">{i18n._(listErrorMessageId(products.error))}</p>;
  // A page past the end is about to move back (`useLastPageClamp`): it says nothing about the store meanwhile.
  if (!products.isSuccess || props.pastLastPage) return <p>{i18n._('catalog.loading')}</p>;
  if (products.data.items.length === 0) {
    return (
      <p data-testid={PRODUCTS_EMPTY_TEST_ID} className="text-muted-foreground py-8 text-center text-sm">
        {i18n._(props.narrowed ? 'catalog.no-match' : 'catalog.empty')}
      </p>
    );
  }
  const previewMap = previews.data ?? new Map<string, string>();
  return (
    <ProductTable products={products.data.items} previews={previewMap} held={props.held} onCommand={props.onCommand} />
  );
}

function CreateAction({ held, storeAlias }: { readonly held: ReadonlySet<string>; readonly storeAlias: string }) {
  const { i18n } = useLingui();
  if (!held.has(CREATE_PRODUCTS_KEY)) return null;
  return (
    <PageActionBar>
      <ActionBarItem itemId={CREATE_ACTION_ID}>
        <Button data-testid={CREATE_PRODUCT_TEST_ID} render={<Link to={storePathFor(NEW_PRODUCT_PATH, storeAlias)} />}>
          {i18n._('catalog.create-product')}
        </Button>
      </ActionBarItem>
    </PageActionBar>
  );
}

type ListState = ReturnType<typeof useListState>;

/**
 * Moves the list back to its last page once the answer shows the page shown no longer exists (a delete emptied it, or
 * another member changed the store). Returns whether the page shown is past the end.
 */
function useLastPageClamp(list: ListState, totalItems: number | undefined): boolean {
  const { setState } = list;
  const { page } = list.state;
  const pastLastPage = totalItems !== undefined && clampPage(list.state, totalItems) !== list.state;
  useEffect(() => {
    if (totalItems === undefined) return;
    setState((state) => clampPage(state, totalItems));
  }, [totalItems, page, setState]);
  return pastLastPage;
}

interface ListToolbarProps {
  readonly list: ListState;
  readonly scope: StoreScope | null;
  readonly held: ReadonlySet<string>;
}

/** The tabs, the search and the filters; each change starts again at page 1. The sold-out tab adds its actions. */
function ListToolbar({ list, scope, held }: ListToolbarProps): ReactNode {
  const brands = useCatalogBrands(scope);
  const tags = useCatalogTags(scope);
  const change = (next: ProductListFilterChange): void => {
    list.setState((state) => withFilter(state, next));
  };
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <StatusTabs
        tab={list.state.tab}
        onTab={(tab) => {
          change({ tab });
        }}
      />
      <ListFilters state={list.state} brands={brands.data ?? []} tags={tags.data ?? []} onChange={change} />
      {soldOutOrdersOffered(list.state.tab, held) ? <SoldOutBar scope={scope} /> : null}
    </div>
  );
}

interface ProductListProps {
  readonly scope: StoreScope | null;
  readonly held: ReadonlySet<string>;
  readonly onCommand: (action: RowCommand, product: CatalogProductRowDto) => void;
}

/** The toolbar, the table of the page asked for and the pager. */
function ProductList({ scope, held, onCommand }: ProductListProps): ReactNode {
  const list = useListState();
  const products = useCatalogProducts(scope, list.query);
  const pastLastPage = useLastPageClamp(list, products.data?.totalItems);
  return (
    <div className="grid gap-4" data-testid={PRODUCT_LIST_TEST_ID} data-store-id={scope?.storeId}>
      <ListToolbar list={list} scope={scope} held={held} />
      <ListBody
        scope={scope}
        products={products}
        narrowed={isNarrowed(list.query)}
        pastLastPage={pastLastPage}
        held={held}
        onCommand={onCommand}
      />
      <ListPager
        page={list.state.page}
        total={products.data?.totalItems ?? 0}
        onPage={(page) => {
          list.setState((state) => withPage(state, page));
        }}
      />
    </div>
  );
}

/** The store's products (the `products.all` leaf): tabs, search, filters, the table and its row actions (AC4). */
export function ProductListPage({ store }: ShellPageProps): ReactNode {
  const { i18n } = useLingui();
  const storeAlias = store?.id ?? ACTIVE_STORE_ALIAS;
  const scope = useStoreScope(store);
  const held = useHeldPermissions(scope);
  const rows = useRowCommands(storeAlias);
  return (
    <Page pageId={CATALOG_PRODUCT_LIST_PAGE_ID}>
      <PageTitle>{i18n._('catalog.products-title')}</PageTitle>
      <CreateAction held={held} storeAlias={storeAlias} />
      <PageLayout>
        <FullWidthPageBlock blockId={LIST_BLOCK_ID}>
          <ProductList scope={scope} held={held} onCommand={rows.onCommand} />
        </FullWidthPageBlock>
      </PageLayout>
      <DeleteDialog
        product={rows.deleting}
        pending={rows.command.isPending}
        onConfirm={(product) => {
          rows.command.mutate({ command: 'delete', productId: product.id });
        }}
        onClose={() => {
          rows.setDeleting(null);
        }}
      />
    </Page>
  );
}
