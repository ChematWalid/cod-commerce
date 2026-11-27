import { WILAYA_CODES, type WilayaCode } from '@cod/shared';
import type { WilayaRateRow } from './fee-group';

/** The home and stop-desk price of one wilaya, in whole DZD. */
export interface DefaultPrice {
  readonly home: number;
  readonly desk: number;
}

/**
 * Our own placeholder home/desk price per wilaya for the seeded "Platform default prices" table (D3124), for a parcel
 * of at most 5 kg. Indicative values close to the public 2026 Yalidine figures: https://dropdz.space/livraison-algerie
 * (per-wilaya "tarifs indicatifs", wilayas 1-58) and https://cabastore.com/livraison-yalidine-58-wilayas (zone
 * ranges), both retrieved 2026-11-22. Indicative, verify with the carrier. Rows marked "estimate" have no published
 * figure: they are interpolated from the former wilaya and its neighbours. Wilayas 49-58 follow the dropdz rows in
 * code order (its names are scrambled there). Oran below Alger is kept as published.
 */
export const DEFAULT_PRICES: Readonly<Record<WilayaCode, DefaultPrice>> = {
  '01': { home: 1100, desk: 600 },
  '02': { home: 690, desk: 400 },
  '03': { home: 900, desk: 500 },
  '04': { home: 850, desk: 400 },
  '05': { home: 850, desk: 400 },
  '06': { home: 790, desk: 400 },
  '07': { home: 950, desk: 500 },
  '08': { home: 1000, desk: 600 },
  '09': { home: 600, desk: 400 },
  '10': { home: 690, desk: 400 },
  '11': { home: 1100, desk: 600 },
  '12': { home: 850, desk: 400 },
  '13': { home: 600, desk: 400 },
  '14': { home: 700, desk: 400 },
  '15': { home: 690, desk: 400 },
  '16': { home: 500, desk: 400 },
  '17': { home: 900, desk: 500 },
  '18': { home: 790, desk: 400 },
  '19': { home: 750, desk: 400 },
  '20': { home: 790, desk: 400 },
  '21': { home: 690, desk: 400 },
  '22': { home: 600, desk: 400 },
  '23': { home: 800, desk: 400 },
  '24': { home: 850, desk: 450 },
  '25': { home: 800, desk: 400 },
  '26': { home: 690, desk: 400 },
  '27': { home: 600, desk: 400 },
  '28': { home: 800, desk: 400 },
  '29': { home: 650, desk: 400 },
  '30': { home: 900, desk: 500 },
  '31': { home: 450, desk: 250 },
  '32': { home: 900, desk: 500 },
  '33': { home: 1300, desk: 600 },
  '34': { home: 790, desk: 400 },
  '35': { home: 690, desk: 350 },
  '36': { home: 850, desk: 500 },
  '37': { home: 1300, desk: 600 },
  '38': { home: 750, desk: 400 },
  '39': { home: 950, desk: 550 },
  '40': { home: 800, desk: 400 },
  '41': { home: 800, desk: 500 },
  '42': { home: 690, desk: 350 },
  '43': { home: 690, desk: 400 },
  '44': { home: 690, desk: 400 },
  '45': { home: 900, desk: 500 },
  '46': { home: 600, desk: 400 },
  '47': { home: 990, desk: 500 },
  '48': { home: 690, desk: 400 },
  '49': { home: 1000, desk: 750 }, // Timimoun
  '50': { home: 1700, desk: 1100 }, // Bordj Badji Mokhtar
  '51': { home: 900, desk: 600 }, // Ouled Djellal
  '52': { home: 1100, desk: 600 }, // Béni Abbès
  '53': { home: 1100, desk: 600 }, // In Salah
  '54': { home: 1700, desk: 1100 }, // In Guezzam
  '55': { home: 990, desk: 500 }, // Touggourt
  '56': { home: 1700, desk: 1100 }, // Djanet
  '57': { home: 900, desk: 550 }, // El M'Ghair; desk estimate, from El Oued
  '58': { home: 990, desk: 500 }, // El Meniaa
  '59': { home: 900, desk: 500 }, // Aflou; estimate, from Laghouat
  '60': { home: 850, desk: 400 }, // Barika; estimate, from Batna, M'Sila
  '61': { home: 950, desk: 500 }, // El Kantara; estimate, from Biskra
  '62': { home: 850, desk: 400 }, // Bir El Ater; estimate, from Tébessa
  '63': { home: 750, desk: 450 }, // El Aricha; estimate, from Tlemcen, Naâma
  '64': { home: 800, desk: 450 }, // Ksar Chellala; estimate, from Tiaret, Djelfa
  '65': { home: 800, desk: 450 }, // Aïn Ouessara; estimate, from Djelfa, Médéa
  '66': { home: 900, desk: 500 }, // Messaad; estimate, from Djelfa
  '67': { home: 750, desk: 400 }, // Ksar El Boukhari; estimate, from Médéa
  '68': { home: 850, desk: 450 }, // Bou Saâda; estimate, from M'Sila
  '69': { home: 1000, desk: 550 }, // El Abiodh Sidi Cheikh; estimate, from El Bayadh
};

/** The seeded table's rows: one per wilaya, delivery and desk on, the default as base and no override (D3107). */
export function defaultRates(): WilayaRateRow[] {
  return WILAYA_CODES.map((provinceCode) => ({
    provinceCode,
    baseHome: DEFAULT_PRICES[provinceCode].home,
    baseDesk: DEFAULT_PRICES[provinceCode].desk,
    overrideHome: null,
    overrideDesk: null,
    deliveryEnabled: true,
    deskEnabled: true,
  }));
}
