import { definitionsFor } from './define';

const tracking = definitionsFor('tracking');
const catalog = definitionsFor('catalog');
const offers = definitionsFor('offers');
const inventory = definitionsFor('inventory');

export const TRACKING_PERMISSIONS = [
  tracking.view('tracking.view', 'Follow own shipments', 'متابعة الشحنات الخاصة'),
  tracking.sensitive('tracking.view-all', "Follow every member's shipments", 'متابعة شحنات جميع الأعضاء'),
  tracking.full('tracking.update', 'Update shipment status', 'تحديث حالة الشحنة'),
] as const;

export const CATALOG_PERMISSIONS = [
  catalog.full('catalog.products.create', 'Add products', 'إضافة منتجات'),
  catalog.view('catalog.products.view', 'See products', 'عرض المنتجات'),
  catalog.sensitive('catalog.products.delete', 'Delete products', 'حذف المنتجات'),
  catalog.full('catalog.products.edit', 'Edit products', 'تعديل المنتجات'),
  catalog.full('catalog.collections.create', 'Add collections', 'إضافة تشكيلات'),
  catalog.view('catalog.collections.view', 'See collections', 'عرض التشكيلات'),
  catalog.sensitive('catalog.collections.delete', 'Delete collections', 'حذف التشكيلات'),
  catalog.full('catalog.collections.edit', 'Edit collections', 'تعديل التشكيلات'),
] as const;

export const OFFERS_PERMISSIONS = [
  offers.full('offers.create', 'Create offers', 'إنشاء عروض'),
  offers.view('offers.view', 'See offers', 'عرض العروض'),
  offers.sensitive('offers.delete', 'Delete offers', 'حذف العروض'),
  offers.full('offers.edit', 'Edit offers', 'تعديل العروض'),
] as const;

export const INVENTORY_PERMISSIONS = [
  inventory.full('inventory.stock.add', 'Receive new stock', 'إدخال مخزون جديد'),
  inventory.view('inventory.stock.view', 'See stock levels', 'عرض مستويات المخزون'),
  inventory.full('inventory.stock.adjust', 'Correct stock counts', 'تصحيح كميات المخزون'),
  inventory.sensitive('inventory.buy-prices', 'See purchase prices', 'الاطلاع على أسعار الشراء'),
] as const;
