import { vendurePermissionName } from '@cod/shared';
import { isMerchant, type ShellUserContext } from './staff';
import { SHELL_TREE, shellLeafUrl, type ShellGroup, type ShellLeaf } from './tree';
import type { ShellIconName } from './types';

/**
 * A sidebar link in the shape of `NavMenuItem` of `@vendure/dashboard`, which unit tests cannot import (virtual
 * modules). `Ctx` is the dashboard user context and `Icon` the icon component type; the stock types fit them.
 */
export interface ShellNavItem<Ctx extends ShellUserContext, Icon> {
  id: string;
  title: string;
  url: string;
  icon?: Icon;
  order?: number;
  placement?: 'top' | 'bottom';
  requiresPermission?: string | string[];
  isVisible?: (ctx: Ctx) => boolean;
}

/** A sidebar section, in the shape of `NavMenuSection`: a header that only expands its items. */
export interface ShellNavSection<Ctx extends ShellUserContext, Icon> extends Omit<ShellNavItem<Ctx, Icon>, 'url'> {
  defaultOpen?: boolean;
  items?: Array<ShellNavItem<Ctx, Icon>>;
}

/** The sidebar configuration, in the shape of `NavMenuConfig`. */
export interface ShellNavConfig<Ctx extends ShellUserContext, Icon> {
  sections: Array<ShellNavSection<Ctx, Icon> | ShellNavItem<Ctx, Icon>>;
}

/**
 * The ids of the stock top-level entries, a copy of `BUILT_IN_NAV_SECTION_IDS` (the dashboard package cannot load in
 * unit tests). `built-in-ids.check.ts` fails `typecheck` when the dashboard adds or renames one.
 */
export const BUILT_IN_SECTION_IDS = [
  'insights',
  'catalog',
  'sales',
  'customers',
  'marketing',
  'system',
  'settings',
] as const;

/** Prefixes the id of a tree group: the stock `settings` section and our Settings group would otherwise share an id. */
export function shellNavEntryId(groupId: string): string {
  return `shell-${groupId}`;
}

type Entry<Ctx extends ShellUserContext, Icon> = ShellNavSection<Ctx, Icon> | ShellNavItem<Ctx, Icon>;

const notMerchant = (ctx: ShellUserContext): boolean => !isMerchant(ctx);

/** ANDs `added` onto an existing predicate, `added` first so a constant false never reaches the existing one. */
function and<Ctx extends ShellUserContext>(
  existing: ((ctx: Ctx) => boolean) | undefined,
  added: (ctx: Ctx) => boolean,
): (ctx: Ctx) => boolean {
  return existing ? (ctx) => added(ctx) && existing(ctx) : added;
}

const permissionNames = (entry: ShellLeaf): string[] => entry.permissions.map(vendurePermissionName);

function toItem<Ctx extends ShellUserContext, Icon>(
  entry: ShellLeaf,
  order: number,
  icons: Record<ShellIconName, Icon>,
): ShellNavItem<Ctx, Icon> {
  const permissions = permissionNames(entry);
  return {
    id: entry.id,
    title: entry.titleId,
    url: shellLeafUrl(entry),
    order,
    ...(entry.icon ? { icon: icons[entry.icon] } : {}),
    ...(permissions.length > 0 ? { requiresPermission: permissions } : {}),
  };
}

/** A group of one leaf of its own id is a link; any other group is a section that expands. */
function toEntry<Ctx extends ShellUserContext, Icon>(
  group: ShellGroup,
  order: number,
  icons: Record<ShellIconName, Icon>,
): Entry<Ctx, Icon> {
  const common = {
    id: shellNavEntryId(group.id),
    title: group.titleId,
    icon: icons[group.icon],
    order,
    placement: 'top' as const,
    isVisible: isMerchant,
  };
  const [only] = group.leaves;
  if (group.leaves.length === 1 && only?.id === group.id) {
    return { ...toItem<Ctx, Icon>(only, order, icons), ...common };
  }
  return { ...common, items: group.leaves.map((entry, index) => toItem<Ctx, Icon>(entry, index, icons)) };
}

/** Hides a stock top-level entry and every bottom section from merchants, composing with its own `isVisible`. */
function hideFromMerchants<Ctx extends ShellUserContext, Icon>(entry: Entry<Ctx, Icon>): Entry<Ctx, Icon> {
  const isStock = (BUILT_IN_SECTION_IDS as readonly string[]).includes(entry.id);
  if (!isStock && entry.placement !== 'bottom') {
    return entry;
  }
  return { ...entry, isVisible: and(entry.isVisible, notMerchant) };
}

/**
 * Returns `config` with the merchant tree appended: every group at the top placement, visible to merchants only
 * (`isMerchant`), and each leaf asking for its permissions (any one of them, as the stock rule is) by Vendure name.
 * Every stock section and every bottom section gets `isVisible` ANDed with "not a merchant", so the "Administration"
 * heading, which renders only with a visible bottom section, never shows for them (D77). Presentation only.
 */
export function buildMerchantNav<Ctx extends ShellUserContext, Icon>(
  config: ShellNavConfig<Ctx, Icon>,
  icons: Record<ShellIconName, Icon>,
): ShellNavConfig<Ctx, Icon> {
  const kept = config.sections.map((entry) => hideFromMerchants(entry));
  const tree = SHELL_TREE.map((group, order) => toEntry<Ctx, Icon>(group, order, icons));
  return { ...config, sections: [...kept, ...tree] };
}
