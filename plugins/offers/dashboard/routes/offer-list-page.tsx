import { ACTIVE_STORE_ALIAS, type ShellPageProps, storePathFor } from '@cod/plugin-merchant-shell/shell-api';
import { useLingui } from '@lingui/react';
import { useNavigate } from '@tanstack/react-router';
import {
  ActionBarItem,
  Button,
  FullWidthPageBlock,
  Page,
  PageActionBar,
  PageLayout,
  PageTitle,
} from '@vendure/dashboard';
import { type ReactNode, useEffect, useState } from 'react';
import { ConfirmCommandDialog, type PendingConfirmation } from '../components/confirm-command-dialog';
import { CreateOfferDialog } from '../components/create-offer-dialog';
import { KindChips } from '../components/kind-chips';
import { ListPager } from '../components/list-pager';
import { OfferTable } from '../components/offer-table';
import { StatusTabs } from '../components/status-tabs';
import {
  CREATE_OFFER_TEST_ID,
  CREATE_OFFERS_KEY,
  NEW_OFFER_PATH,
  OFFER_LIST_TEST_ID,
  OFFERS_EMPTY_TEST_ID,
  offerPathOf,
} from '../constants';
import type { OfferRowDto } from '../dto';
import { useOfferCommand } from '../hooks/use-offer-command';
import { useStoreScope } from '../hooks/use-store-scope';
import { kindChipsOf } from '../model/app-type-cards';
import {
  clampPage,
  INITIAL_LIST_STATE,
  isNarrowed,
  listQueryOf,
  type OfferListState,
  withFilter,
  withPage,
} from '../model/list-search';
import { listErrorMessageId, type OfferRowAction } from '../model/list-view';
import { type StoreScope, useHeldPermissions, useOfferAppTypes, useOffers } from '../queries';

/** The page's id for the dashboard's page extensions; offers has no shared page id yet. */
const OFFER_LIST_PAGE_ID = 'offers-list-page';
const LIST_BLOCK_ID = 'offers-offer-list';
const CREATE_ACTION_ID = 'offers-create-offer';

type OnAction = (action: OfferRowAction, offer: OfferRowDto) => void;

/** Runs a row action: Edit opens the editor, Archive and Delete ask first, the others run at once. */
function useRowActions(storeAlias: string, scope: StoreScope | null) {
  const navigate = useNavigate();
  const [pending, setPending] = useState<PendingConfirmation | null>(null);
  const command = useOfferCommand(scope, () => {
    setPending(null);
  });
  const onAction: OnAction = (action, offer) => {
    if (action === 'edit') void navigate({ to: storePathFor(offerPathOf(offer.id), storeAlias) });
    else if (action === 'archive' || action === 'delete') setPending({ command: action, offer });
    else command.mutate({ command: action, offerId: offer.id });
  };
  return { onAction, pending, setPending, command };
}

/**
 * Moves the list back to its last page once the answer shows the page shown no longer exists (a delete emptied it, or
 * another member changed the store). Returns whether the page shown is past the end.
 */
function useLastPageClamp(
  state: OfferListState,
  setState: (update: (state: OfferListState) => OfferListState) => void,
  totalItems: number | undefined,
): boolean {
  const { page } = state;
  const pastLastPage = totalItems !== undefined && clampPage(state, totalItems) !== state;
  useEffect(() => {
    if (totalItems === undefined) return;
    setState((current) => clampPage(current, totalItems));
  }, [totalItems, page, setState]);
  return pastLastPage;
}

function ListBody(props: {
  readonly offers: ReturnType<typeof useOffers>;
  readonly narrowed: boolean;
  readonly pastLastPage: boolean;
  readonly held: ReadonlySet<string>;
  readonly onAction: OnAction;
}): ReactNode {
  const { i18n } = useLingui();
  const { offers } = props;
  if (offers.isError) return <p role="alert">{i18n._(listErrorMessageId(offers.error))}</p>;
  if (!offers.isSuccess || props.pastLastPage) return <p>{i18n._('offers.loading')}</p>;
  if (offers.data.items.length === 0) {
    return (
      <p data-testid={OFFERS_EMPTY_TEST_ID} className="text-muted-foreground py-8 text-center text-sm">
        {i18n._(props.narrowed ? 'offers.no-match' : 'offers.empty')}
      </p>
    );
  }
  return <OfferTable offers={offers.data.items} held={props.held} onAction={props.onAction} />;
}

interface OfferListProps {
  readonly scope: StoreScope | null;
  readonly held: ReadonlySet<string>;
  readonly onAction: OnAction;
}

/** The status tabs, the kind chips, the table of the page asked for and the pager. */
function OfferList({ scope, held, onAction }: OfferListProps): ReactNode {
  const [state, setState] = useState<OfferListState>(INITIAL_LIST_STATE);
  const query = listQueryOf(state);
  const offers = useOffers(scope, query);
  const appTypes = useOfferAppTypes(scope);
  const pastLastPage = useLastPageClamp(state, setState, offers.data?.totalItems);
  return (
    <div className="grid gap-4" data-testid={OFFER_LIST_TEST_ID} data-store-id={scope?.storeId}>
      <div className="grid gap-3">
        <StatusTabs
          tab={state.tab}
          onTab={(tab) => {
            setState((current) => withFilter(current, { tab }));
          }}
        />
        <KindChips
          chips={kindChipsOf(appTypes.data ?? [])}
          kind={state.kind}
          onKind={(kind) => {
            setState((current) => withFilter(current, { kind }));
          }}
        />
      </div>
      <ListBody
        offers={offers}
        narrowed={isNarrowed(query)}
        pastLastPage={pastLastPage}
        held={held}
        onAction={onAction}
      />
      <ListPager
        page={state.page}
        total={offers.data?.totalItems ?? 0}
        onPage={(page) => {
          setState((current) => withPage(current, page));
        }}
      />
    </div>
  );
}

/** "Create offer" and its dialog; the page shows them to holders of the create key only. */
function CreateOffer({ storeAlias, scope }: { readonly storeAlias: string; readonly scope: StoreScope | null }) {
  const { i18n } = useLingui();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const appTypes = useOfferAppTypes(scope);
  return (
    <>
      <Button
        data-testid={CREATE_OFFER_TEST_ID}
        onClick={() => {
          setOpen(true);
        }}
      >
        {i18n._('offers.create-offer')}
      </Button>
      <CreateOfferDialog
        open={open}
        appTypes={appTypes.data}
        onChoose={(type) => {
          setOpen(false);
          void navigate({ to: storePathFor(NEW_OFFER_PATH, storeAlias), search: { type } });
        }}
        onClose={() => {
          setOpen(false);
        }}
      />
    </>
  );
}

/** The store's offers (the `products.offers` leaf): status tabs, kind chips, the table and its row actions (D2523). */
export function OfferListPage({ store }: ShellPageProps): ReactNode {
  const { i18n } = useLingui();
  const storeAlias = store?.id ?? ACTIVE_STORE_ALIAS;
  const scope = useStoreScope(store);
  const held = useHeldPermissions(scope);
  const rows = useRowActions(storeAlias, scope);
  return (
    <Page pageId={OFFER_LIST_PAGE_ID}>
      <PageTitle>{i18n._('offers.offers-title')}</PageTitle>
      {/* A direct child: the page puts only its own `PageActionBar` children in the title row. */}
      {held.has(CREATE_OFFERS_KEY) && (
        <PageActionBar>
          <ActionBarItem itemId={CREATE_ACTION_ID}>
            <CreateOffer storeAlias={storeAlias} scope={scope} />
          </ActionBarItem>
        </PageActionBar>
      )}
      <PageLayout>
        <FullWidthPageBlock blockId={LIST_BLOCK_ID}>
          <OfferList scope={scope} held={held} onAction={rows.onAction} />
        </FullWidthPageBlock>
      </PageLayout>
      <ConfirmCommandDialog
        pending={rows.pending}
        busy={rows.command.isPending}
        onConfirm={(pending) => {
          rows.command.mutate({ command: pending.command, offerId: pending.offer.id });
        }}
        onClose={() => {
          rows.setPending(null);
        }}
      />
    </Page>
  );
}
