import type { LocalizedLabel } from './types';

/** The twelve permission areas, in display order. */
export const PERMISSION_AREA_IDS = [
  'orders',
  'tracking',
  'catalog',
  'offers',
  'inventory',
  'finance',
  'analytics',
  'team',
  'delivery',
  'store',
  'apps',
  'settings',
] as const;

/** One of the twelve areas. */
export type PermissionArea = (typeof PERMISSION_AREA_IDS)[number];

/** An area as shown on the role editor. */
export interface PermissionAreaEntry {
  readonly id: PermissionArea;
  /** 1-based display position. */
  readonly order: number;
  readonly label: LocalizedLabel;
}

const AREA_LABELS: Record<PermissionArea, LocalizedLabel> = {
  orders: { en: 'Orders', ar: 'الطلبات' },
  tracking: { en: 'Order tracking', ar: 'تتبّع الطلبات' },
  catalog: { en: 'Products and catalog', ar: 'المنتجات والفهرس' },
  offers: { en: 'Offers', ar: 'العروض' },
  inventory: { en: 'Inventory', ar: 'المخزون' },
  finance: { en: 'Finance', ar: 'المالية' },
  analytics: { en: 'Analytics', ar: 'التحليلات' },
  team: { en: 'Team', ar: 'الفريق' },
  delivery: { en: 'Delivery', ar: 'التوصيل' },
  store: { en: 'Store and storefront', ar: 'المتجر وواجهته' },
  apps: { en: 'Apps and integrations', ar: 'التطبيقات والتكاملات' },
  settings: { en: 'Business settings', ar: 'إعدادات النشاط' },
};

/** The areas with their position and label. */
export const PERMISSION_AREAS: readonly PermissionAreaEntry[] = PERMISSION_AREA_IDS.map((id, index) => ({
  id,
  order: index + 1,
  label: AREA_LABELS[id],
}));
