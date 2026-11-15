import { ACTIVE_STORE_ALIAS, type ShellPageProps, storePathFor } from '@cod/plugin-merchant-shell/shell-api';
import { CATALOG_PRODUCT_LIST_BLOCK_ID, CATALOG_PRODUCT_LIST_PAGE_ID } from '@cod/shared';
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
import { type ReactNode, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { DeleteDialog } from '../components/delete-dialog';
import { ListFilters } from '../components/list-filters';
import { ListPager } from '../components/list-pager';
import { ProductTable } from '../components/product-table';
import type { TableSelection } from '../components/selection-cells';
import { SoldOutBar } from '../components/sold-out-bar';
import type { RowCommand } from '../components/row-actions';
import { StatusTabs } from '../components/status-tabs';
import {
  CREATE_PRODUCT_TEST_ID,
  NEW_PRODUCT_PATH,
  PRODUCT_LIST_TEST_ID,
  PRODUCTS_EMPTY_TEST_ID,
  productPathOf,
} from '../constants';
import type { CatalogProductRowDto } from '../dto';
import { type ListSelectionControl, useListSelection } from '../hooks/use-list-selection';
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
import { pageSelectionState } from '../model/list-selection';
import { listErrorMessageId } from '../model/list-view';
import { actionItemsShown, CREATE_PRODUCT_ACTION, listPageEntityOf } from '../model/product-list-actions';
import { soldOutOrdersOffered } from '../model/sold-out-view';
import {
  type StoreScope,
  useCatalogBrands,
  useCatalogProducts,
  useCatalogTags,
  useHeldPermissions,
  useMediaPreviews,
} from '../queries';

/** The list's state; the search reaches the query deferred, so typing stays responsive. */
function useListState() {
  const [state, setState] = useState<ProductListState>(INITIAL_LIST_STATE);
  const deferredSearch = useDeferredValue(state.search);
  return { state, query: listQueryOf({ ...state, search: deferredSearch }), setState };
}

/** Runs a row action: Edit opens the editor, Set draft runs at once, Delete asks first. */
function useRowCommands(storeAlias: string, scope: StoreScope | null) {
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState<CatalogProductRowDto | null>(null);
  const command = useProductCommand(scope, () => {
    setDeleting(null);
  });
  const onCommand = (action: RowCommand, product: CatalogProductRowDto): void => {
    if (action === 'edit') void navigate({ to: storePathFor(productPathOf(product.id), storeAlias) });
    if (action === 'set-draft') command.mutate({ command: 'set-draft', productId: product.id });
    if (action === 'delete') setDeleting(product);
  };
  return { onCommand, deleting, setDeleting, command };
}

/** What the table ticks with: the selection, and how much of the page shown it holds. */
function tableSelectionOf(control: ListSelectionControl, rows: readonly CatalogProductRowDto[]): TableSelection {
  const pageIds = rows.map((product) => product.id);
  return {
    selectedIds: new Set(control.selection.ids),
    pageState: pageSelectionState(control.selection, pageIds),
    onToggle: control.toggle,
    onTogglePage: (on: boolean) => {
      control.togglePage(pageIds, on);
    },
  };
}

function ListBody(props: {
  readonly scope: StoreScope | null;
  readonly products: ReturnType<typeof useCatalogProducts>;
  readonly narrowed: boolean;
  readonly pastLastPage: boolean;
  readonly held: ReadonlySet<string>;
  readonly onCommand: (action: RowCommand, product: CatalogProductRowDto) => void;
  readonly selection: ListSelectionControl;
}): ReactNode {
  const { i18n } = useLingui();
  const previews = useMediaPreviews(props.scope);
  const { products } = props;
  // A switch in this tab is retried until the page mounts for the new store; one that persists shows its message.
  if (products.isError) return <p role="alert">{i18n._(listErrorMessageId(products.error))}</p>;
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
    <ProductTable
      products={products.data.items}
      previews={previewMap}
      held={props.held}
      onCommand={props.onCommand}
      selection={tableSelectionOf(props.selection, products.data.items)}
    />
  );
}

/** Create product; the page shows it to holders of the create key only. */
function CreateButton({ storeAlias }: { readonly storeAlias: string }) {
  const { i18n } = useLingui();
  return (
    <Button data-testid={CREATE_PRODUCT_TEST_ID} render={<Link to={storePathFor(NEW_PRODUCT_PATH, storeAlias)} />}>
      {i18n._('catalog.create-product')}
    </Button>
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
  readonly list: ListState;
  readonly selection: ListSelectionControl;
  readonly scope: StoreScope | null;
  readonly held: ReadonlySet<string>;
  readonly onCommand: (action: RowCommand, product: CatalogProductRowDto) => void;
}

/** The toolbar, the table of the page asked for and the pager. */
function ProductList({ list, selection, scope, held, onCommand }: ProductListProps): ReactNode {
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
        selection={selection}
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

/**
 * The page's own action-bar items: Create product, shown to holders of the create key only. A plain function, not a
 * component: `PageActionBar` merges only its direct `ActionBarItem` children with the items other plugins register.
 */
function actionBarItemsOf(held: ReadonlySet<string>, storeAlias: string): ReactNode[] {
  return actionItemsShown([CREATE_PRODUCT_ACTION], held).map((item) => (
    <ActionBarItem key={item.id} itemId={item.id}>
      <CreateButton storeAlias={storeAlias} />
    </ActionBarItem>
  ));
}

/**
 * The store's products (the `products.all` leaf): tabs, search, filters, the table, its row actions and selection
 * (AC4). The page's `entity` hands action-bar items the list's query and the ticked products (D2201).
 */
export function ProductListPage({ store }: ShellPageProps): ReactNode {
  const { i18n } = useLingui();
  const storeAlias = store?.id ?? ACTIVE_STORE_ALIAS;
  const scope = useStoreScope(store);
  const held = useHeldPermissions(scope);
  const rows = useRowCommands(storeAlias, scope);
  const list = useListState();
  const selection = useListSelection(scope?.storeId ?? null, list.query);
  const queryKey = JSON.stringify(list.query);
  const selectedKey = selection.selection.ids.join(',');
  // Keyed by value: the query object and the id list are rebuilt on every render.
  const entity = useMemo(() => listPageEntityOf(list.query, selection.selection.ids), [queryKey, selectedKey]);
  return (
    <Page pageId={CATALOG_PRODUCT_LIST_PAGE_ID} entity={entity}>
      <PageTitle>{i18n._('catalog.products-title')}</PageTitle>
      {/*
        A literal direct child, rendered for every viewer (D2201): `Page` finds its action bar by element type, and other
        plugins add items (export, bulk edit, import) by the page's id, each gated by its own key.
      */}
      <PageActionBar>{actionBarItemsOf(held, storeAlias)}</PageActionBar>
      <PageLayout>
        <FullWidthPageBlock blockId={CATALOG_PRODUCT_LIST_BLOCK_ID}>
          <ProductList list={list} selection={selection} scope={scope} held={held} onCommand={rows.onCommand} />
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
