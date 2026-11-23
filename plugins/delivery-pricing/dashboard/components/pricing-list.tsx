import { type StoreScope, storePathFor, type SwitchableStoreView } from '@cod/plugin-merchant-shell/shell-api';
import { FEE_GROUP_LIST_PAGE_SIZE, FEE_GROUP_NAME_MAX } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { Link, useNavigate } from '@tanstack/react-router';
import { Button, Input, Label } from '@vendure/dashboard';
import { type ReactNode, useDeferredValue, useEffect, useId, useState } from 'react';
import {
  ADD_PRICING_TEST_ID,
  CREATE_PRICING_KEY,
  NEW_PRICING_PATH,
  PRICING_EMPTY_TEST_ID,
  PRICING_LIST_TEST_ID,
  pricingPathOf,
} from '../constants';
import type { FeeGroupSummaryDto } from '../dto';
import { useDeletePricing } from '../hooks/use-pricing-writes';
import { errorMessageIdOf, pageWithin, type PricingListQuery, type PricingRowAction } from '../model/list-view';
import { useFeeGroups } from '../queries';
import { DeleteDialog } from './delete-dialog';
import { LtrRun } from './ltr-run';
import { PricingTable } from './pricing-table';

interface PricingListProps {
  readonly store: SwitchableStoreView;
  readonly scope: StoreScope | null;
  readonly held: ReadonlySet<string>;
}

/** The store the list answers for: the active store, shown as the list's filter (switched from the top bar). */
function StoreFilter({ store }: { readonly store: SwitchableStoreView }): ReactNode {
  const { i18n } = useLingui();
  const id = useId();
  return (
    <div className="grid gap-1">
      <Label htmlFor={id}>{i18n._('delivery-pricing.store-filter')}</Label>
      <Input id={id} className="max-w-xs" value={store.name} readOnly />
    </div>
  );
}

function Pager({ page, total, onPage }: { page: number; total: number; onPage: (page: number) => void }) {
  const { i18n } = useLingui();
  const pages = Math.max(1, Math.ceil(total / FEE_GROUP_LIST_PAGE_SIZE));
  if (pages === 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 text-sm">
      <Button
        size="sm"
        variant="outline"
        disabled={page <= 1}
        onClick={() => {
          onPage(page - 1);
        }}
      >
        {i18n._('delivery-pricing.page-previous')}
      </Button>
      <LtrRun>{`${String(page)} / ${String(pages)}`}</LtrRun>
      <Button
        size="sm"
        variant="outline"
        disabled={page >= pages}
        onClick={() => {
          onPage(page + 1);
        }}
      >
        {i18n._('delivery-pricing.page-next')}
      </Button>
    </div>
  );
}

interface ListBodyProps {
  readonly groups: ReturnType<typeof useFeeGroups>;
  readonly searched: boolean;
  readonly held: ReadonlySet<string>;
  readonly onAction: (action: PricingRowAction, group: FeeGroupSummaryDto) => void;
}

function ListBody({ groups, searched, held, onAction }: ListBodyProps): ReactNode {
  const { i18n } = useLingui();
  if (groups.isError) return <p role="alert">{i18n._(errorMessageIdOf(groups.error))}</p>;
  if (!groups.isSuccess) return <p>{i18n._('delivery-pricing.loading')}</p>;
  if (groups.data.items.length === 0) {
    return (
      <p data-testid={PRICING_EMPTY_TEST_ID} className="text-muted-foreground py-8 text-center text-sm">
        {i18n._(searched ? 'delivery-pricing.no-match' : 'delivery-pricing.empty')}
      </p>
    );
  }
  return <PricingTable groups={groups.data.items} held={held} onAction={onAction} />;
}

/** Edit and View open the editor; Delete asks first. */
function useRowActions(store: SwitchableStoreView, scope: StoreScope | null) {
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState<FeeGroupSummaryDto | null>(null);
  const remove = useDeletePricing(scope, () => {
    setDeleting(null);
  });
  const onAction = (action: PricingRowAction, group: FeeGroupSummaryDto): void => {
    if (action === 'delete') setDeleting(group);
    else void navigate({ to: storePathFor(pricingPathOf(group.id), store.id) });
  };
  return { onAction, deleting, setDeleting, remove };
}

/** A delete can empty the last page: the list then shows the new last page, not an empty state. */
function usePageWithinTotal(
  total: number | undefined,
  setQuery: (update: (shown: PricingListQuery) => PricingListQuery) => void,
): void {
  useEffect(() => {
    if (total === undefined) return;
    setQuery((shown) => {
      const page = pageWithin(shown.page, total);
      return page === shown.page ? shown : { ...shown, page };
    });
  }, [total, setQuery]);
}

interface ToolbarProps {
  readonly store: SwitchableStoreView;
  readonly held: ReadonlySet<string>;
  readonly search: string;
  readonly onSearch: (search: string) => void;
}

/** The store filter and the name search at the start, Add pricing option at the end (create key only). */
function Toolbar({ store, held, search, onSearch }: ToolbarProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <StoreFilter store={store} />
        <Input
          type="search"
          className="max-w-xs"
          aria-label={i18n._('delivery-pricing.search')}
          placeholder={i18n._('delivery-pricing.search')}
          maxLength={FEE_GROUP_NAME_MAX}
          value={search}
          onChange={(event) => {
            onSearch(event.target.value);
          }}
        />
      </div>
      {held.has(CREATE_PRICING_KEY) && (
        <Button data-testid={ADD_PRICING_TEST_ID} render={<Link to={storePathFor(NEW_PRICING_PATH, store.id)} />}>
          {i18n._('delivery-pricing.add')}
        </Button>
      )}
    </div>
  );
}

/** The Delivery pricing tab: the store filter, the search, Add pricing option, the table and its pager (captured). */
export function PricingList({ store, scope, held }: PricingListProps): ReactNode {
  const [query, setQuery] = useState<PricingListQuery>({ page: 1, search: '' });
  const deferred = useDeferredValue(query);
  const groups = useFeeGroups(scope, deferred);
  const rows = useRowActions(store, scope);
  usePageWithinTotal(groups.data?.totalItems, setQuery);
  return (
    <div className="grid gap-4" data-testid={PRICING_LIST_TEST_ID} data-store-id={store.id}>
      <Toolbar
        store={store}
        held={held}
        search={query.search}
        onSearch={(search) => {
          setQuery({ page: 1, search });
        }}
      />
      <ListBody groups={groups} searched={deferred.search.trim() !== ''} held={held} onAction={rows.onAction} />
      <Pager
        page={query.page}
        total={groups.data?.totalItems ?? 0}
        onPage={(page) => {
          setQuery({ ...query, page });
        }}
      />
      <DeleteDialog
        group={rows.deleting}
        pending={rows.remove.isPending}
        onConfirm={(group) => {
          rows.remove.mutate(group.id);
        }}
        onClose={() => {
          rows.setDeleting(null);
        }}
      />
    </div>
  );
}
