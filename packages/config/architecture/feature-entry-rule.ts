import type { IForbiddenRuleType } from 'dependency-cruiser' with { 'resolution-mode': 'import' };

/**
 * A rule keeping a feature plugin's entry (Nest services and its module) to adapters: outside `owner` only an
 * infrastructure/ file, a plugin's root *.plugin.ts module file, a test kit or apps/server may import `entry`.
 */
export const featureEntryInfraOnly = (
  name: string,
  owner: string,
  entry: string,
  comment: string,
): IForbiddenRuleType => ({
  name,
  comment,
  severity: 'error',
  from: {
    pathNot: [
      '^plugins/[^/]+/infrastructure/',
      '^plugins/[^/]+/[^/]+[.]plugin[.]ts$',
      '^plugins/[^/]+/tests/',
      `^plugins/${owner}/`,
      '^apps/server/',
    ],
  },
  to: { path: entry },
});
