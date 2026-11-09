import type { PermissionArea } from './areas';
import { PERMISSION_CATALOG, type PermissionKey } from './catalog';
import type { LocalizedLabel } from './localized-label';

/** Keys of the seven roles every business starts with, in display order. */
export const BUILT_IN_ROLE_KEYS = [
  'owner',
  'manager',
  'order-manager',
  'inventory-manager',
  'accountant',
  'order-tracker',
  'store-manager',
] as const;

/** One of the seven built-in role keys. */
export type BuiltInRoleKey = (typeof BUILT_IN_ROLE_KEYS)[number];

/** A built-in role template. Immutable through the API (D61). */
export interface BuiltInRoleDefinition {
  readonly key: BuiltInRoleKey;
  readonly label: LocalizedLabel;
  /** Describes what the role can do, not who it is for. */
  readonly description: LocalizedLabel;
  /** Sorted, unique catalog keys. */
  readonly permissions: readonly PermissionKey[];
}

const ALL_KEYS: PermissionKey[] = PERMISSION_CATALOG.map((entry) => entry.key);

const keysIn = (...areas: PermissionArea[]): PermissionKey[] =>
  PERMISSION_CATALOG.filter((entry) => areas.includes(entry.area)).map((entry) => entry.key);

const MANAGER_EXCLUDED: ReadonlySet<PermissionKey> = new Set<PermissionKey>([
  'orders.delete',
  'orders.comments.delete',
  'catalog.products.delete',
  'catalog.collections.delete',
  'offers.delete',
  'finance.records.delete',
  'finance.expenses.delete',
  'team.members.remove',
  'team.roles.delete',
  'team.commissions.delete',
  'delivery.carriers.delete',
  'delivery.pricing.delete',
  'store.landing-pages.delete',
  'store.domains.remove',
  'apps.disconnect',
  'settings.business.edit',
]);

const orderViewKeys = (): PermissionKey[] =>
  PERMISSION_CATALOG.filter((e) => e.area === 'orders' && e.level === 'view' && !e.sensitive).map((e) => e.key);

const sorted = (keys: readonly PermissionKey[]): PermissionKey[] => [...new Set(keys)].sort();

/** The seven built-in roles with their permission templates. */
export const BUILT_IN_ROLES: readonly BuiltInRoleDefinition[] = [
  {
    key: 'owner',
    label: { en: 'Owner', ar: 'المالك' },
    description: {
      en: 'Can do everything in the business, including deleting records and changing settings.',
      ar: 'يستطيع فعل كل شيء في النشاط، بما في ذلك الحذف وتغيير الإعدادات.',
    },
    permissions: sorted(ALL_KEYS),
  },
  {
    key: 'manager',
    label: { en: 'Manager', ar: 'المدير' },
    description: {
      en: 'Can do everything except delete records, remove members or change business settings.',
      ar: 'يستطيع فعل كل شيء عدا حذف السجلات وإزالة الأعضاء وتغيير إعدادات النشاط.',
    },
    permissions: sorted(ALL_KEYS.filter((key) => !MANAGER_EXCLUDED.has(key))),
  },
  {
    key: 'order-manager',
    label: { en: 'Order manager', ar: 'مسؤول الطلبات' },
    description: {
      en: 'Can handle orders from creation to delivery, returns and buyers, and nothing else.',
      ar: 'يتولى الطلبات من الإنشاء حتى التسليم والمرتجعات والمشترين، دون سواها.',
    },
    permissions: sorted(keysIn('orders')),
  },
  {
    key: 'inventory-manager',
    label: { en: 'Inventory manager', ar: 'مسؤول المخزون' },
    description: {
      en: 'Can keep products, collections and stock up to date, including purchase prices.',
      ar: 'يحدّث المنتجات والتشكيلات والمخزون، بما في ذلك أسعار الشراء.',
    },
    permissions: sorted(keysIn('inventory', 'catalog')),
  },
  {
    key: 'accountant',
    label: { en: 'Accountant', ar: 'المحاسب' },
    description: {
      en: 'Can keep the books and read every order, without changing orders.',
      ar: 'يمسك الدفاتر ويطّلع على كل الطلبات دون تعديلها.',
    },
    permissions: sorted([...keysIn('finance'), ...orderViewKeys(), 'orders.view-all']),
  },
  {
    key: 'order-tracker',
    label: { en: 'Order tracker', ar: 'متتبّع الطلبات' },
    description: {
      en: 'Can follow shipments and update their status, and nothing else.',
      ar: 'يتابع الشحنات ويحدّث حالتها، دون سوى ذلك.',
    },
    permissions: sorted(keysIn('tracking')),
  },
  {
    key: 'store-manager',
    label: { en: 'Store manager', ar: 'مسؤول المتجر' },
    description: {
      en: 'Can run the storefront, its pages and domains, and maintain products and collections.',
      ar: 'يدير واجهة المتجر وصفحاته ونطاقاته، ويصون المنتجات والتشكيلات.',
    },
    permissions: sorted(keysIn('store', 'catalog')),
  },
];
