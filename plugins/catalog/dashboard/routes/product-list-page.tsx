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
import { type ReactNode, useDeferredValue, useState } from 'react';
import { DeleteDialog } from '../components/delete-dialog';
import { ListFilters } from '../components/list-filters';
import { ListPager } from '../components/list-pager';
import { ProductTable } from '../components/product-table';
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
import {
  INITIAL_LIST_STATE,
  listQueryOf,
  type ProductListFilterChange,
  type ProductListState,
  withFilter,
  withPage,
} from '../model/list-search';
import { listErrorMessageId } from '../model/list-view';
import { useCatalogBrands, useCatalogProducts, useCatalogTags, useHeldPermissions, useMediaPreviews } from '../queries';

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
  readonly products: ReturnType<typeof useCatalogProducts>;
  readonly held: ReadonlySet<string>;
  readonly onCommand: (action: RowCommand, product: CatalogProductRowDto) => void;
}): ReactNode {
  const { i18n } = useLingui();
  const previews = useMediaPreviews();
  const { products } = props;
  if (products.isError) return <p role="alert">{i18n._(listErrorMessageId(products.error))}</p>;
  if (!products.isSuccess) return <p>{i18n._('catalog.loading')}</p>;
  if (products.data.items.length === 0) {
    return (
      <p data-testid={PRODUCTS_EMPTY_TEST_ID} className="text-muted-foreground py-8 text-center text-sm">
        {i18n._('catalog.empty')}
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

/** The tabs, the search and the filters; each change starts again at page 1. */
function ListToolbar({ list }: { readonly list: ListState }): ReactNode {
  const brands = useCatalogBrands();
  const tags = useCatalogTags();
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
    </div>
  );
}

/** The store's products (the `products.all` leaf): tabs, search, filters, the table and its row actions (AC4). */
export function ProductListPage({ store }: ShellPageProps): ReactNode {
  const { i18n } = useLingui();
  const storeAlias = store?.id ?? ACTIVE_STORE_ALIAS;
  const held = useHeldPermissions();
  const list = useListState();
  const products = useCatalogProducts(list.query);
  const rows = useRowCommands(storeAlias);
  return (
    <Page pageId={CATALOG_PRODUCT_LIST_PAGE_ID}>
      <PageTitle>{i18n._('catalog.products-title')}</PageTitle>
      <CreateAction held={held} storeAlias={storeAlias} />
      <PageLayout>
        <FullWidthPageBlock blockId={LIST_BLOCK_ID}>
          <div className="grid gap-4" data-testid={PRODUCT_LIST_TEST_ID}>
            <ListToolbar list={list} />
            <ListBody products={products} held={held} onCommand={rows.onCommand} />
            <ListPager
              page={list.state.page}
              total={products.data?.totalItems ?? 0}
              onPage={(page) => {
                list.setState((state) => withPage(state, page));
              }}
            />
          </div>
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
