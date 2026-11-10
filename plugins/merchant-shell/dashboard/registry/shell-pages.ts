import type { ComponentType } from 'react';
import type { ShellLeafId } from '../model/tree';
import type { ShellPageProps } from '../model/types';

/** The page a dashboard registers for a leaf of the shell sidebar. */
export interface ShellPage {
  readonly component: ComponentType<ShellPageProps>;
}

/** A leaf-to-page map the shell reads at render, so the order in which dashboards load does not matter (D83). */
export interface ShellPageRegistry {
  /** @throws when `leafId` already has a page: two registrations would silently replace each other. */
  register(leafId: ShellLeafId, page: ShellPage): void;
  /** The page registered for `leafId`, or undefined, in which case the shell shows its skeleton. */
  get(leafId: ShellLeafId): ShellPage | undefined;
}

/** Creates an empty registry. */
export function createShellPageRegistry(): ShellPageRegistry {
  const pages = new Map<ShellLeafId, ShellPage>();
  return {
    register(leafId, page) {
      if (pages.has(leafId)) {
        throw new Error(`A shell page is already registered for "${leafId}".`);
      }
      pages.set(leafId, page);
    },
    get: (leafId) => pages.get(leafId),
  };
}

const shellPages = createShellPageRegistry();

/** Registers `page` for the shell leaf `leafId`. Called once per leaf, at module load of the owning dashboard. */
export function registerShellPage(leafId: ShellLeafId, page: ShellPage): void {
  shellPages.register(leafId, page);
}

/** The page registered for `leafId`, or undefined. */
export function getShellPage(leafId: ShellLeafId): ShellPage | undefined {
  return shellPages.get(leafId);
}
