import { useLingui } from '@lingui/react';
import { type DashboardRouteDefinition, FullWidthPageBlock, Page, PageLayout, PageTitle } from '@vendure/dashboard';
import { MerchantNotFound, usePlatformStaff } from '@cod/plugin-merchant-shell/shell-api';
import type { ReactNode } from 'react';
import { FlagTable } from '../components/flag-table';
import {
  FLAGS_LOADING_MESSAGE_ID,
  FLAGS_NAV_ITEM_ID,
  FLAGS_NAV_REQUIRED_PERMISSION,
  FLAGS_NAV_TITLE,
  FLAGS_PATH,
  PLATFORM_SECTION_ID,
} from '../constants';
import { flagErrorMessageId } from '../error-messages';
import { useFeatureFlags } from '../queries';

const PAGE_ID = 'platform-flags';
const BLOCK_ID = 'platform-flags-list';

function StaffFlags(): ReactNode {
  const { i18n } = useLingui();
  const flags = useFeatureFlags(true);
  return (
    <Page pageId={PAGE_ID}>
      <PageTitle>{i18n._(FLAGS_NAV_TITLE)}</PageTitle>
      <PageLayout>
        <FullWidthPageBlock blockId={BLOCK_ID}>
          {flags.isError && <p role="alert">{i18n._(flagErrorMessageId(flags.error))}</p>}
          {flags.isPending && <p>{i18n._(FLAGS_LOADING_MESSAGE_ID)}</p>}
          {flags.isSuccess && flags.data.length === 0 && <p>{i18n._('flags.empty')}</p>}
          {flags.isSuccess && <FlagTable flags={flags.data} />}
        </FullWidthPageBlock>
      </PageLayout>
    </Page>
  );
}

/** Platform staff only. Anyone else gets the shell's not-found page and no query leaves the browser (the server refuses too). */
function FlagsPage(): ReactNode {
  return usePlatformStaff() ? <StaffFlags /> : <MerchantNotFound />;
}

/** The staff flags screen (D116), in the platform section of the sidebar. */
export const flagsRoute: DashboardRouteDefinition = {
  path: FLAGS_PATH,
  component: () => <FlagsPage />,
  navMenuItem: {
    sectionId: PLATFORM_SECTION_ID,
    id: FLAGS_NAV_ITEM_ID,
    title: FLAGS_NAV_TITLE,
    requiresPermission: FLAGS_NAV_REQUIRED_PERMISSION,
  },
};
