import { useLingui } from '@lingui/react';
import type { DashboardRouteDefinition } from '@vendure/dashboard';
import type { ReactNode } from 'react';
import { MerchantNotFound } from '../components/merchant-route-guard';
import { ShellLeafPage } from '../components/shell-leaf-page';
import { storePathFor } from '../model/store-path';
import { SHELL_LEAVES, leafBreadcrumbTitleId, type ShellLeaf, type ShellLeafId } from '../model/tree';

/** The router's name for the store segment of a store-scoped leaf. */
const STORE_ID_PARAM = '$storeId';

/** The router's splat path. */
const CATCH_ALL_PATH = '/$';

/** A breadcrumb reading the catalogue at render, so it follows the display language. */
function LeafBreadcrumb({ titleId }: { readonly titleId: string }): ReactNode {
  const { i18n } = useLingui();
  return i18n._(titleId);
}

/** A link leaf adds no crumb: the sidebar entry's crumb already names the page (`/home` showed "Home > Home"). */
function toRoute(leaf: ShellLeaf<ShellLeafId>): DashboardRouteDefinition {
  const crumbTitleId = leafBreadcrumbTitleId(leaf);
  return {
    path: leaf.storeScoped ? storePathFor(leaf.path, STORE_ID_PARAM) : leaf.path,
    loader: () => (crumbTitleId === null ? {} : { breadcrumb: <LeafBreadcrumb titleId={crumbTitleId} /> }),
    component: () => <ShellLeafPage leaf={leaf} />,
  };
}

/**
 * Catches a URL nothing else matches. Without it the router renders its bare root page, outside the layout that holds
 * `MerchantRouteGuard`, so the guard never sees an unknown URL. It ranks below every other route.
 */
const catchAllRoute: DashboardRouteDefinition = { path: CATCH_ALL_PATH, component: () => <MerchantNotFound /> };

/** One route per leaf of the tree (D83), a leaf with no registered page showing the skeleton, and the catch-all. */
export const shellRoutes: readonly DashboardRouteDefinition[] = [...SHELL_LEAVES.map(toRoute), catchAllRoute];
