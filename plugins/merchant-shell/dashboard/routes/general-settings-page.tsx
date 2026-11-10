import { useLingui } from '@lingui/react';
import { Page, PageBlock, PageLayout, PageTitle, useAuth } from '@vendure/dashboard';
import type { ReactNode } from 'react';
import { BusinessProfileCard } from '../components/business-profile-card';
import { StoreProfileCard } from '../components/store-profile-card';
import {
  BUSINESS_EDIT_PERMISSION,
  BUSINESS_VIEW_PERMISSION,
  SETTINGS_LOAD_ERROR_TEST_ID,
  STORE_EDIT_PERMISSION,
  STORE_VIEW_PERMISSION,
} from '../constants';
import { useSettledActiveChannel } from '../hooks/use-settled-active-channel';
import { useActiveStore } from '../hooks/use-store-session';
import { channelHolds } from '../model/permissions';
import { useActiveBusiness, useStoreRecord } from '../queries';

const PAGE_ID = 'shell-settings-general';
const BUSINESS_BLOCK_ID = 'shell-settings-business';
const STORE_BLOCK_ID = 'shell-settings-store';
const STATUS_BLOCK_ID = 'shell-settings-status';

/** What the caller may do on the active store: a card is shown with its view key and saved with its edit key. */
function useCardAccess(): Readonly<Record<'viewBusiness' | 'editBusiness' | 'viewStore' | 'editStore', boolean>> {
  const { channels } = useAuth();
  const { activeChannelId } = useSettledActiveChannel();
  return {
    viewBusiness: channelHolds(channels, activeChannelId, BUSINESS_VIEW_PERMISSION),
    editBusiness: channelHolds(channels, activeChannelId, BUSINESS_EDIT_PERMISSION),
    viewStore: channelHolds(channels, activeChannelId, STORE_VIEW_PERMISSION),
    editStore: channelHolds(channels, activeChannelId, STORE_EDIT_PERMISSION),
  };
}

/** General settings: the business's and the active store's profile. Minimal: the other fields come with their data. */
export function GeneralSettingsPage(): ReactNode {
  const { i18n } = useLingui();
  const access = useCardAccess();
  const { activeChannelId } = useSettledActiveChannel();
  const activeStore = useActiveStore();
  const business = useActiveBusiness(activeChannelId, access.viewBusiness);
  const store = useStoreRecord(activeChannelId, activeStore?.id, access.viewStore);
  const loadFailed = business.isError || store.isError;
  return (
    <Page pageId={PAGE_ID}>
      <PageTitle>{i18n._('shell.nav.settings.general')}</PageTitle>
      <PageLayout>
        {business.data !== undefined && (
          <PageBlock column="main" blockId={BUSINESS_BLOCK_ID} title={i18n._('shell.settings.business.title')}>
            <BusinessProfileCard business={business.data} canEdit={access.editBusiness} />
          </PageBlock>
        )}
        {store.data !== undefined && store.data !== null && (
          <PageBlock column="main" blockId={STORE_BLOCK_ID} title={i18n._('shell.settings.store.title')}>
            <StoreProfileCard store={store.data} canEdit={access.editStore} />
          </PageBlock>
        )}
        {loadFailed && (
          <PageBlock column="main" blockId={STATUS_BLOCK_ID} layout="bare">
            <p role="alert" data-testid={SETTINGS_LOAD_ERROR_TEST_ID} className="text-destructive text-sm">
              {i18n._('shell.settings.load-failed')}
            </p>
          </PageBlock>
        )}
      </PageLayout>
    </Page>
  );
}
