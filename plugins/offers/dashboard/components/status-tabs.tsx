import { useLingui } from '@lingui/react';
import { Tabs, TabsList, TabsTrigger } from '@vendure/dashboard';
import type { ReactNode } from 'react';
import { OFFER_TABS_TEST_ID } from '../constants';
import { isOfferListTab, OFFER_LIST_TABS, type OfferListTab } from '../model/list-search';
import { TAB_LABEL_IDS } from '../model/list-view';

interface StatusTabsProps {
  readonly tab: OfferListTab;
  readonly onTab: (tab: OfferListTab) => void;
}

/** All offers, or those of one status: active, draft, paused or archived. */
export function StatusTabs({ tab, onTab }: StatusTabsProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <Tabs
      value={tab}
      onValueChange={(next) => {
        if (isOfferListTab(next)) onTab(next);
      }}
    >
      <TabsList data-testid={OFFER_TABS_TEST_ID} className="flex-wrap">
        {OFFER_LIST_TABS.map((value) => (
          <TabsTrigger key={value} value={value}>
            {i18n._(TAB_LABEL_IDS[value])}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
