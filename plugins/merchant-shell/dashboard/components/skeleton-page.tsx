/// <reference types="vite/client" />
import { useLingui } from '@lingui/react';
import { Page, PageBlock, PageLayout, PageTitle } from '@vendure/dashboard';
import type { ReactNode } from 'react';
import { SHELL_SKELETON_TEST_ID } from '../constants';
import type { ShellLeaf } from '../model/tree';

const BLOCK_ID = 'shell-skeleton';
const COMING_SOON_MESSAGE_ID = 'shell.coming-soon';

/** The page of a leaf no session has built yet (D94). The owning session shows in development only. */
export function SkeletonPage({ leaf }: { readonly leaf: ShellLeaf }): ReactNode {
  const { i18n } = useLingui();
  return (
    <Page pageId={`shell-${leaf.id}`}>
      <PageTitle>{i18n._(leaf.titleId)}</PageTitle>
      <PageLayout>
        <PageBlock column="main" blockId={BLOCK_ID}>
          <p data-testid={SHELL_SKELETON_TEST_ID} className="text-muted-foreground">
            {i18n._(COMING_SOON_MESSAGE_ID)}
          </p>
          {import.meta.env.DEV && leaf.ownerSession !== null && (
            <p dir="ltr" className="text-muted-foreground text-xs">
              {leaf.ownerSession}
            </p>
          )}
        </PageBlock>
      </PageLayout>
    </Page>
  );
}
