import { ACTIVE_STORE_ALIAS, type ShellPageProps, storePathFor } from '@cod/plugin-merchant-shell/shell-api';
import { COLLECTION_LIST_PAGE_SIZE, COLLECTION_TITLE_MAX } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  ActionBarItem,
  Button,
  FullWidthPageBlock,
  Input,
  Page,
  PageActionBar,
  PageLayout,
  PageTitle,
} from '@vendure/dashboard';
import { type ReactNode, useDeferredValue, useEffect, useState } from 'react';
import { CollectionTable } from '../components/collection-table';
import { DeleteDialog } from '../components/delete-dialog';
import { LtrRun } from '../components/ltr-run';
import {
  COLLECTION_LIST_PAGE_ID,
  COLLECTION_LIST_TEST_ID,
  COLLECTIONS_EMPTY_TEST_ID,
  CREATE_COLLECTION_TEST_ID,
  CREATE_COLLECTIONS_KEY,
  collectionPathOf,
  NEW_COLLECTION_PATH,
} from '../constants';
import type { StoreCollectionDto } from '../dto';
import { useDeleteCollection } from '../hooks/use-delete-collection';
import { useHeldPermissions } from '../hooks/use-held-permissions';
import { useStoreScope } from '../hooks/use-store-scope';
import { type CollectionRowAction, errorMessageIdOf, orderedCollections, pageWithin } from '../model/list-view';
import type { StoreScope } from '../model/store-query';
import { type CollectionListQuery, useStoreCollections } from '../queries';

const LIST_BLOCK_ID = 'collections-list';
const CREATE_ACTION_ID = 'collections-create';

/** Previous and next, shown only when the list holds more than one page. */
function Pager(props: {
  readonly query: CollectionListQuery;
  readonly total: number;
  readonly onPage: (page: number) => void;
}) {
  const { i18n } = useLingui();
  const pages = Math.max(1, Math.ceil(props.total / COLLECTION_LIST_PAGE_SIZE));
  const { page } = props.query;
  if (pages === 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 text-sm">
      <Button
        size="sm"
        variant="outline"
        disabled={page <= 1}
        onClick={() => {
          props.onPage(page - 1);
        }}
      >
        {i18n._('collections.page-previous')}
      </Button>
      <LtrRun>{`${String(page)} / ${String(pages)}`}</LtrRun>
      <Button
        size="sm"
        variant="outline"
        disabled={page >= pages}
        onClick={() => {
          props.onPage(page + 1);
        }}
      >
        {i18n._('collections.page-next')}
      </Button>
    </div>
  );
}

interface ListBodyProps {
  readonly collections: ReturnType<typeof useStoreCollections>;
  readonly searched: boolean;
  readonly held: ReadonlySet<string>;
  readonly onCommand: (action: CollectionRowAction, collection: StoreCollectionDto) => void;
}

function ListBody({ collections, searched, held, onCommand }: ListBodyProps): ReactNode {
  const { i18n } = useLingui();
  if (collections.isError) return <p role="alert">{i18n._(errorMessageIdOf(collections.error))}</p>;
  if (!collections.isSuccess) return <p>{i18n._('collections.loading')}</p>;
  if (collections.data.items.length === 0) {
    return (
      <p data-testid={COLLECTIONS_EMPTY_TEST_ID} className="text-muted-foreground py-8 text-center text-sm">
        {i18n._(searched ? 'collections.no-match' : 'collections.empty')}
      </p>
    );
  }
  return <CollectionTable collections={orderedCollections(collections.data.items)} held={held} onCommand={onCommand} />;
}

/** A delete can empty the last page: the list then shows the new last page, not an empty "no collections" state. */
function usePageWithinTotal(
  total: number | undefined,
  setQuery: (update: (shown: CollectionListQuery) => CollectionListQuery) => void,
): void {
  useEffect(() => {
    if (total === undefined) return;
    setQuery((shown) => {
      const page = pageWithin(shown.page, total);
      return page === shown.page ? shown : { ...shown, page };
    });
  }, [total, setQuery]);
}

/** The search, the table of the page asked for and the pager; a new search starts again at page 1. */
function CollectionList(
  props: Omit<ListBodyProps, 'collections' | 'searched'> & { readonly scope: StoreScope | null },
) {
  const { i18n } = useLingui();
  const [query, setQuery] = useState<CollectionListQuery>({ page: 1, search: '' });
  const deferred = useDeferredValue(query);
  const collections = useStoreCollections(props.scope, deferred);
  usePageWithinTotal(collections.data?.totalItems, setQuery);
  return (
    <div className="grid gap-4" data-testid={COLLECTION_LIST_TEST_ID} data-store-id={props.scope?.storeId}>
      <Input
        type="search"
        className="max-w-sm"
        aria-label={i18n._('collections.search')}
        placeholder={i18n._('collections.search')}
        maxLength={COLLECTION_TITLE_MAX}
        value={query.search}
        onChange={(event) => {
          setQuery({ page: 1, search: event.target.value });
        }}
      />
      <ListBody
        collections={collections}
        searched={deferred.search.trim() !== ''}
        held={props.held}
        onCommand={props.onCommand}
      />
      <Pager
        query={query}
        total={collections.data?.totalItems ?? 0}
        onPage={(page) => {
          setQuery({ ...query, page });
        }}
      />
    </div>
  );
}

/** Edit opens the editor; Delete asks first. */
function useRowCommands(storeAlias: string, scope: StoreScope | null) {
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState<StoreCollectionDto | null>(null);
  const remove = useDeleteCollection(scope, () => {
    setDeleting(null);
  });
  const onCommand = (action: CollectionRowAction, collection: StoreCollectionDto): void => {
    if (action === 'edit') void navigate({ to: storePathFor(collectionPathOf(collection.id), storeAlias) });
    else setDeleting(collection);
  };
  return { onCommand, deleting, setDeleting, remove };
}

/** The store's collections (the `products.collections` leaf), ordered by position (D2325). */
export function CollectionListPage({ store }: ShellPageProps): ReactNode {
  const { i18n } = useLingui();
  const storeAlias = store?.id ?? ACTIVE_STORE_ALIAS;
  const scope = useStoreScope(store);
  const held = useHeldPermissions(scope);
  const rows = useRowCommands(storeAlias, scope);
  return (
    <Page pageId={COLLECTION_LIST_PAGE_ID}>
      <PageTitle>{i18n._('collections.heading')}</PageTitle>
      {held.has(CREATE_COLLECTIONS_KEY) && (
        <PageActionBar>
          <ActionBarItem itemId={CREATE_ACTION_ID}>
            <Button
              data-testid={CREATE_COLLECTION_TEST_ID}
              render={<Link to={storePathFor(NEW_COLLECTION_PATH, storeAlias)} />}
            >
              {i18n._('collections.create')}
            </Button>
          </ActionBarItem>
        </PageActionBar>
      )}
      <PageLayout>
        <FullWidthPageBlock blockId={LIST_BLOCK_ID}>
          <CollectionList scope={scope} held={held} onCommand={rows.onCommand} />
        </FullWidthPageBlock>
      </PageLayout>
      <DeleteDialog
        collection={rows.deleting}
        pending={rows.remove.isPending}
        onConfirm={(collection) => {
          rows.remove.mutate(collection.id);
        }}
        onClose={() => {
          rows.setDeleting(null);
        }}
      />
    </Page>
  );
}
