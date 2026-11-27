import {
  type SwitchableStoreView,
  useActiveStore,
  useHeldPermissions,
  useStoreScope,
} from '@cod/plugin-merchant-shell/shell-api';
import { useLingui } from '@lingui/react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { FullWidthPageBlock, Page, PageLayout, PageTitle, Tabs, TabsList, TabsTrigger } from '@vendure/dashboard';
import type { ReactNode } from 'react';
import { PricingList } from '../components/pricing-list';
import {
  CARRIERS_PLACEHOLDER_TEST_ID,
  DELIVERY_PAGE_ID,
  DELIVERY_PAGE_TEST_ID,
  DELIVERY_PATH,
  DELIVERY_TABS_TEST_ID,
} from '../constants';
import { type DeliveryTab, deliveryTabsOf, shownTabOf, TAB_LABEL_IDS, tabSearchOf } from '../model/delivery-tabs';

const DELIVERY_BLOCK_ID = 'delivery-tabs';
/** The shell's own "Coming soon" wording, shared by every page no session has built yet. */
const COMING_SOON_MESSAGE_ID = 'shell.coming-soon';

function TabBar({ tabs, tab }: { readonly tabs: readonly DeliveryTab[]; readonly tab: DeliveryTab }): ReactNode {
  const { i18n } = useLingui();
  const navigate = useNavigate();
  return (
    <Tabs
      value={tab}
      onValueChange={(next) => {
        const chosen = tabs.find((candidate) => candidate === next);
        if (chosen !== undefined) void navigate({ to: DELIVERY_PATH, search: tabSearchOf(chosen) });
      }}
    >
      <TabsList data-testid={DELIVERY_TABS_TEST_ID} className="flex-wrap">
        {tabs.map((value) => (
          <TabsTrigger key={value} value={value}>
            {i18n._(TAB_LABEL_IDS[value])}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

/** Carriers arrive with P5.S1: until then the tab says so with the shell's coming-soon wording. */
function CarriersPlaceholder(): ReactNode {
  const { i18n } = useLingui();
  return (
    <p data-testid={CARRIERS_PLACEHOLDER_TEST_ID} className="text-muted-foreground py-8 text-center text-sm">
      {i18n._(COMING_SOON_MESSAGE_ID)}
    </p>
  );
}

/** The tabs of the active store, once the server says which keys the caller holds there. */
function DeliveryTabs({ store }: { readonly store: SwitchableStoreView }): ReactNode {
  const { i18n } = useLingui();
  const scope = useStoreScope(store);
  const held = useHeldPermissions(scope);
  const search: { readonly tab?: unknown } = useSearch({ strict: false });
  const tabs = deliveryTabsOf(held);
  const tab = shownTabOf(search.tab, tabs);
  if (tab === null) return <p>{i18n._('delivery-pricing.loading')}</p>;
  return (
    <div className="grid gap-4">
      <TabBar tabs={tabs} tab={tab} />
      {tab === 'pricing' ? <PricingList store={store} scope={scope} held={held} /> : <CarriersPlaceholder />}
    </div>
  );
}

/**
 * The `delivery` leaf (`/delivery`, captured "Delivery & Shipping"): the Carriers tab (P5.S1) and the Delivery pricing
 * tab (`?tab=pricing`) of the active store. The leaf opens with either key; each tab shows only to its own key's
 * holder, and the server checks every request again.
 */
export function DeliveryPage(): ReactNode {
  const { i18n } = useLingui();
  const store = useActiveStore();
  return (
    <Page pageId={DELIVERY_PAGE_ID}>
      <PageTitle>{i18n._('delivery-pricing.page-title')}</PageTitle>
      <PageLayout>
        <FullWidthPageBlock blockId={DELIVERY_BLOCK_ID}>
          <div data-testid={DELIVERY_PAGE_TEST_ID} data-store-id={store?.id}>
            {store === undefined ? (
              <p>{i18n._('delivery-pricing.loading')}</p>
            ) : (
              <DeliveryTabs key={store.id} store={store} />
            )}
          </div>
        </FullWidthPageBlock>
      </PageLayout>
    </Page>
  );
}
