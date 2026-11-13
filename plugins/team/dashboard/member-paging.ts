import { MEMBERS_PAGE_SIZE } from '@cod/shared';

/** How many pages a tab of `total` members fills; an empty tab still shows one page. */
export function pageCountOf(total: number): number {
  return Math.max(1, Math.ceil(total / MEMBERS_PAGE_SIZE));
}

/**
 * The page to show once the tab holds `total` members: past the last page (its rows were removed, deactivated or
 * revoked) it falls back to the last one, so the caller never lands on an empty page with no pager.
 */
export function clampedPage(page: number, total: number): number {
  return Math.min(page, pageCountOf(total));
}
