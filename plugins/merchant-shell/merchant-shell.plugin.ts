import { PluginCommonModule, VendurePlugin } from '@vendure/core';

/**
 * The merchant dashboard shell (ADR 0010): it owns the dashboard extension that loads the Arabic font,
 * keeps `html[lang]` in step with the display language and carries the shared RTL overrides. It has no
 * server-side behaviour in P0; the merchant IA, nav hiding and the store switcher arrive with P1.S5.
 */
@VendurePlugin({
  imports: [PluginCommonModule],
  dashboard: './dashboard/index.tsx',
  compatibility: '^3.8.0',
})
// A Vendure plugin is a decorated class; its body stays empty when its metadata is the whole plugin.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class MerchantShellPlugin {}
