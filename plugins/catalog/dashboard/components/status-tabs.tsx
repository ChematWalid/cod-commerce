import { PRODUCT_LIST_TABS, type ProductListTab } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { Tabs, TabsList, TabsTrigger } from '@vendure/dashboard';
import type { ReactNode } from 'react';
import { PRODUCT_TABS_TEST_ID } from '../constants';
import { TAB_LABEL_IDS } from '../model/list-view';

const isTab = (value: unknown): value is ProductListTab =>
  typeof value === 'string' && (PRODUCT_LIST_TABS as readonly string[]).includes(value);

interface StatusTabsProps {
  readonly tab: ProductListTab;
  readonly onTab: (tab: ProductListTab) => void;
}

/** All products, or the drafts alone (AC4: the Draft tab lists only drafts). */
export function StatusTabs({ tab, onTab }: StatusTabsProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <Tabs
      value={tab}
      onValueChange={(next) => {
        if (isTab(next)) onTab(next);
      }}
    >
      <TabsList data-testid={PRODUCT_TABS_TEST_ID}>
        {PRODUCT_LIST_TABS.map((value) => (
          <TabsTrigger key={value} value={value}>
            {i18n._(TAB_LABEL_IDS[value])}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
