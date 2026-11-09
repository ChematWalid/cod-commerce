import { definitionsFor } from './define';

const store = definitionsFor('store');
const apps = definitionsFor('apps');
const settings = definitionsFor('settings');

export const STORE_PERMISSIONS = [
  store.full('store.stores.create', 'Open new stores', 'فتح متاجر جديدة'),
  store.view('store.stores.view', 'See stores', 'عرض المتاجر'),
  store.full('store.settings.edit', 'Edit store settings', 'تعديل إعدادات المتجر'),
  store.full('store.builder.open', 'Open the store builder', 'فتح أداة تصميم المتجر'),
  store.full('store.pages.edit', 'Edit store pages', 'تعديل صفحات المتجر'),
  store.sensitive('store.publish', 'Publish the store', 'نشر المتجر'),
  store.sensitive('store.discard', 'Discard unpublished changes', 'التخلي عن التغييرات غير المنشورة'),
  store.full('store.landing-pages.create', 'Create landing pages', 'إنشاء صفحات هبوط'),
  store.view('store.landing-pages.view', 'See landing pages', 'عرض صفحات الهبوط'),
  store.sensitive('store.landing-pages.delete', 'Delete landing pages', 'حذف صفحات الهبوط'),
  store.full('store.landing-pages.edit', 'Edit landing pages', 'تعديل صفحات الهبوط'),
  store.full('store.domains.connect', 'Connect domains', 'ربط النطاقات'),
  store.view('store.domains.view', 'See domains', 'عرض النطاقات'),
  store.sensitive('store.domains.remove', 'Remove domains', 'إزالة النطاقات'),
  store.full('store.domains.edit', 'Edit domains', 'تعديل النطاقات'),
] as const;

export const APPS_PERMISSIONS = [
  apps.view('apps.view', 'See apps', 'عرض التطبيقات'),
  apps.full('apps.connect', 'Connect apps', 'ربط التطبيقات'),
  apps.full('apps.manage', 'Manage connected apps', 'إدارة التطبيقات المرتبطة'),
  apps.sensitive('apps.disconnect', 'Disconnect apps', 'فصل التطبيقات'),
  apps.view('apps.whatsapp.view', 'See messaging setup', 'عرض إعداد المراسلة'),
  apps.full('apps.whatsapp.manage', 'Manage messaging', 'إدارة المراسلة'),
  apps.full('apps.cargo.request', 'Request freight pickups', 'طلب خدمة نقل البضائع'),
  apps.view('apps.cargo.view', 'See freight requests', 'عرض طلبات نقل البضائع'),
] as const;

export const SETTINGS_PERMISSIONS = [
  settings.view('settings.business.view', 'See business settings', 'عرض إعدادات النشاط'),
  settings.sensitive('settings.business.edit', 'Edit business settings', 'تعديل إعدادات النشاط'),
  settings.view('settings.activity-log.view', 'See the activity log', 'عرض سجل النشاط'),
] as const;
