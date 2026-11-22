import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { TOWN_AVAILABILITY, TOWN_AVAILABILITY_REGISTRAR } from './application/tokens';
import { newTownAvailabilityRegistry } from './application/town-availability.registry';

/**
 * Algeria's geo reference data: the wilayas and communes of law 26-06 (D3123), global tables that are not tenant
 * data (D3103). This module wires the town availability seam; delivery pricing registers on its registrar token.
 */
@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [
    { provide: TOWN_AVAILABILITY, useFactory: newTownAvailabilityRegistry },
    { provide: TOWN_AVAILABILITY_REGISTRAR, useExisting: TOWN_AVAILABILITY },
  ],
  exports: [TOWN_AVAILABILITY_REGISTRAR],
  compatibility: '^3.8.0',
})
// A Vendure plugin is a decorated class; its body stays empty when its metadata is the whole plugin.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class GeoPlugin {}
