import type { Page } from 'playwright-core';

/** The top-level sidebar entries of a merchant, in tree order (the plan's table). */
export const MERCHANT_SECTIONS = [
  'Home',
  'Orders',
  'Tracking',
  'Products',
  'Analytics',
  'Inventory',
  'Finance',
  'Team',
  'Delivery & shipping',
  'Apps',
  'Sourcing',
  'Settings',
];

/** Every leaf except `/team`, `/team/roles`, `/settings` and the product list, which have real pages, in tree order. */
export const SKELETON_LEAVES = [
  '/home',
  '/cod-orders',
  '/cod-orders/customers',
  '/cod-orders/spam',
  '/tracking',
  '/tracking/returns',
  '/stores/active/collections',
  '/stores/active/offers',
  '/stores/active/themes',
  '/stores/active/ab-tests',
  '/analytics',
  '/analytics/team',
  '/analytics/marketing',
  '/inventory',
  '/inventory/packaging',
  '/inventory/movements',
  '/finance',
  '/finance/costs',
  '/finance/products',
  '/finance/wilayas',
  '/finance/ads',
  '/finance/wallets',
  '/finance/study',
  '/team/distribution',
  '/delivery',
  '/apps',
  '/sourcing',
  '/stores/active/settings/pixels',
  '/stores/active/settings/domains',
  '/stores/active/settings/billing',
  '/stores/active/settings/statuses',
  '/stores/active/settings/locations',
  '/stores/active/settings/spam',
];

/** Records, from before the page's own scripts run, whether `testId` is ever in the DOM. */
export const watchFor = (page: Page, testId: string): Promise<unknown> =>
  page.addInitScript((id: string) => {
    const seen = (): void => {
      if (document.querySelector(`[data-testid="${id}"]`)) {
        (window as unknown as { __seen?: boolean }).__seen = true;
      }
    };
    new MutationObserver(seen).observe(document, { childList: true, subtree: true });
  }, testId);

/** The page's rendered text (`innerText`, so hidden parts are left out), without the elements matching `excluded`. */
export const textOutside = (page: Page, excluded: string): Promise<string> =>
  page.evaluate((selector: string) => {
    const elements = [...document.querySelectorAll<HTMLElement>(selector)];
    const displays = elements.map((element) => element.style.display);
    elements.forEach((element) => {
      element.style.display = 'none';
    });
    const text = document.body.innerText;
    elements.forEach((element, index) => {
      element.style.display = displays[index] ?? '';
    });
    return text;
  }, excluded);

export const everSeen = (page: Page): Promise<boolean> =>
  page.evaluate(() => (window as unknown as { __seen?: boolean }).__seen === true);
