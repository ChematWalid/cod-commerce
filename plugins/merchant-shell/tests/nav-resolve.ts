import type { ShellNavConfig, ShellNavItem, ShellNavSection } from '../dashboard/model/nav-config';
import type { ShellUserContext } from '../dashboard/model/staff';

/** What a test passes as the dashboard user context: the shell's view plus the stock permission check. */
export interface TestContext extends ShellUserContext {
  hasPermissions: (permissions: string[]) => boolean;
}

/** The Vendure permission names a test user holds on the active channel. */
export function contextOf(options: {
  administrator?: boolean;
  held?: readonly string[];
  otherChannelHeld?: readonly string[];
}): TestContext {
  const held = options.held ?? [];
  return {
    administrator: options.administrator === false ? undefined : { id: '1' },
    channels: [{ permissions: [...held] }, { permissions: [...(options.otherChannelHeld ?? [])] }],
    hasPermissions: (permissions) => permissions.some((permission) => held.includes(permission)),
  };
}

type Entry<Icon> = ShellNavSection<TestContext, Icon> | ShellNavItem<TestContext, Icon>;

/** A copy of `resolveNavMenu` in `@vendure/dashboard` 3.8.1: ANY-of permissions, ANDed `isVisible`, empty sections dropped. */
export function resolveNav<Icon>(config: ShellNavConfig<TestContext, Icon>, ctx: TestContext): Entry<Icon>[] {
  const passes = (entry: Entry<Icon>): boolean => {
    const required = [entry.requiresPermission ?? []].flat();
    return (required.length === 0 || ctx.hasPermissions(required)) && (entry.isVisible?.(ctx) ?? true);
  };
  return config.sections
    .map((section) => ('items' in section ? { ...section, items: (section.items ?? []).filter(passes) } : section))
    .filter((section) => passes(section) && (!('items' in section) || (section.items ?? []).length > 0));
}

/** The visible shape: top-level ids, and the item ids of each section. */
export function shapeOf<Icon>(entries: Entry<Icon>[]): Record<string, string[]> {
  return Object.fromEntries(
    entries.map((entry) => [entry.id, 'items' in entry ? (entry.items ?? []).map((item) => item.id) : []]),
  );
}
