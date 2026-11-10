import { PLATFORM_STAFF_PERMISSION, vendurePermissionName } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import {
  BUILT_IN_SECTION_IDS,
  buildMerchantNav,
  type ShellNavConfig,
  shellNavEntryId,
} from '../dashboard/model/nav-config';
import { isMerchant, isPlatformStaff } from '../dashboard/model/staff';
import { SHELL_LEAVES, SHELL_TREE } from '../dashboard/model/tree';
import type { ShellIconName } from '../dashboard/model/types';
import { contextOf, resolveNav, shapeOf, type TestContext } from './nav-resolve';

type Config = ShellNavConfig<TestContext, string>;

const ICONS: Record<ShellIconName, string> = Object.fromEntries(
  SHELL_TREE.map((group) => [group.icon, `icon:${group.icon}`]),
) as Record<ShellIconName, string>;

/** Stand-ins for the stock sections, the stock Insights link and one plugin's bottom section. */
function stockConfig(): Config {
  return {
    sections: [
      ...BUILT_IN_SECTION_IDS.filter((id) => id !== 'insights').map((id) => ({
        id,
        title: id,
        items: [{ id: `${id}-item`, title: id, url: `/${id}` }],
      })),
      { id: 'insights', title: 'Insights', url: '/insights' },
      { id: 'ops', title: 'Ops', placement: 'bottom', items: [{ id: 'ops-item', title: 'Ops', url: '/ops' }] },
    ],
  };
}

const ORDERS_VIEW = vendurePermissionName('orders.view');
const ALL_PERMISSIONS = SHELL_LEAVES.flatMap((leaf) => leaf.permissions).map(vendurePermissionName);

describe('isPlatformStaff and isMerchant', () => {
  it('detects staff by the permission on any channel, not the active one', () => {
    const staff = contextOf({ otherChannelHeld: [PLATFORM_STAFF_PERMISSION] });

    expect(isPlatformStaff(staff)).toBe(true);
    expect(isMerchant(staff)).toBe(false);
  });

  it('treats a signed-in account without the permission as a merchant', () => {
    expect(isMerchant(contextOf({ held: [ORDERS_VIEW] }))).toBe(true);
  });

  it('is false before the administrator loads', () => {
    expect(isMerchant(contextOf({ administrator: false }))).toBe(false);
  });
});

describe('buildMerchantNav', () => {
  const nav = buildMerchantNav(stockConfig(), ICONS);

  it('shows a merchant with only orders.view Home and Orders with All orders and Spam', () => {
    const visible = resolveNav(nav, contextOf({ held: [ORDERS_VIEW] }));

    expect(shapeOf(visible)).toEqual({ 'shell-home': [], 'shell-orders': ['orders.all', 'orders.spam'] });
  });

  it('shows a merchant with no permission only Home, and no empty group', () => {
    const visible = resolveNav(nav, contextOf({}));

    expect(shapeOf(visible)).toEqual({ 'shell-home': [] });
  });

  it('shows a merchant holding every key the whole tree, with links as top-level entries', () => {
    const visible = resolveNav(nav, contextOf({ held: ALL_PERMISSIONS }));
    const shape = shapeOf(visible);

    expect(Object.keys(shape)).toEqual(SHELL_TREE.map((group) => shellNavEntryId(group.id)));
    expect(shape['shell-home']).toEqual([]);
    expect(shape['shell-delivery']).toEqual([]);
    expect(shape['shell-orders']).toEqual(['orders.all', 'orders.customers', 'orders.spam']);
  });

  it('shows a link when any one of its permissions is held', () => {
    const visible = resolveNav(nav, contextOf({ held: [vendurePermissionName('delivery.pricing.view')] }));

    expect(Object.keys(shapeOf(visible))).toEqual(['shell-home', 'shell-delivery']);
  });

  it('shows a staff context the stock sections and no tree entry', () => {
    const staff = contextOf({ held: [PLATFORM_STAFF_PERMISSION] });
    const visible = shapeOf(resolveNav(nav, staff));

    expect(Object.keys(visible).sort()).toEqual([...BUILT_IN_SECTION_IDS, 'ops'].sort());
  });

  it('hides every stock section, stock link and bottom section from a merchant', () => {
    const visible = resolveNav(nav, contextOf({ held: ALL_PERMISSIONS }));
    const ids = visible.map((entry) => entry.id);

    for (const hidden of [...BUILT_IN_SECTION_IDS, 'ops']) {
      expect(ids).not.toContain(hidden);
    }
    expect(visible.filter((entry) => entry.placement === 'bottom')).toEqual([]);
  });

  it('places every tree entry at the top with Home first by order', () => {
    const tree = nav.sections.filter((entry) => SHELL_TREE.some((group) => shellNavEntryId(group.id) === entry.id));

    expect(tree.map((entry) => entry.placement)).toEqual(SHELL_TREE.map(() => 'top'));
    expect(tree.map((entry) => entry.order)).toEqual(SHELL_TREE.map((_, index) => index));
  });

  it('links store-scoped leaves to the active-store alias and gives items their icon-less title ids', () => {
    const products = nav.sections.find((entry) => entry.id === 'shell-products');
    const items = products !== undefined && 'items' in products ? (products.items ?? []) : [];

    expect(items.map((item) => item.url)).toEqual([
      '/stores/active/products',
      '/stores/active/collections',
      '/stores/active/offers',
      '/stores/active/themes',
      '/stores/active/ab-tests',
    ]);
    expect(items[0]?.title).toBe('shell.nav.products.all');
    expect(items[0]?.requiresPermission).toEqual([vendurePermissionName('catalog.products.view')]);
    expect(products?.icon).toBe('icon:products');
  });

  it('composes with an isVisible already set on a stock section', () => {
    const config = stockConfig();
    const catalog = config.sections.find((entry) => entry.id === 'catalog');
    if (catalog) {
      catalog.isVisible = () => false;
    }

    const staffShape = shapeOf(
      resolveNav(buildMerchantNav(config, ICONS), contextOf({ held: [PLATFORM_STAFF_PERMISSION] })),
    );

    expect(staffShape).not.toHaveProperty('catalog');
    expect(staffShape).toHaveProperty('sales');
  });

  it('does not change the config it is given', () => {
    const config = stockConfig();
    const before = config.sections.length;

    buildMerchantNav(config, ICONS);

    expect(config.sections).toHaveLength(before);
    expect(config.sections.every((entry) => entry.isVisible === undefined)).toBe(true);
  });
});
