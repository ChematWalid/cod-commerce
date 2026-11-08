import { PLATFORM_LANGUAGE_CODES } from '@cod/shared';
import { type DashboardRouteDefinition, Page, PageBlock, PageLayout, PageTitle } from '@vendure/dashboard';
import type { ReactNode } from 'react';
import { PLATFORM_LANGUAGES_TEST_ID, SHELL_PLACEHOLDER_PATH, SHELL_PLACEHOLDER_TEST_ID } from '../constants';

const PAGE_ID = 'merchant-shell-placeholder';
const LANGUAGE_SEPARATOR = ' · ';
const LANGUAGES_BLOCK_ID = 'platform-languages';

function ShellPlaceholderPage(): ReactNode {
  return (
    <Page pageId={PAGE_ID}>
      <PageTitle>Merchant shell</PageTitle>
      <PageLayout>
        <PageBlock column="main" blockId={LANGUAGES_BLOCK_ID}>
          <div data-testid={SHELL_PLACEHOLDER_TEST_ID} />
          <p data-testid={PLATFORM_LANGUAGES_TEST_ID}>{PLATFORM_LANGUAGE_CODES.join(LANGUAGE_SEPARATOR)}</p>
        </PageBlock>
      </PageLayout>
    </Page>
  );
}

/** The shell's placeholder page: no nav entry, reached by URL only, until P1.S5 builds the merchant IA. */
export const shellPlaceholderRoute: DashboardRouteDefinition = {
  path: SHELL_PLACEHOLDER_PATH,
  component: () => <ShellPlaceholderPage />,
};
