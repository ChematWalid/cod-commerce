import { definitionsFor } from './define';

const finance = definitionsFor('finance');
const analytics = definitionsFor('analytics');
const team = definitionsFor('team');
const delivery = definitionsFor('delivery');

export const FINANCE_PERMISSIONS = [
  finance.full('finance.records.add', 'Record income', 'تسجيل الإيرادات'),
  finance.view('finance.records.view', 'See income records', 'عرض سجلات الإيرادات'),
  finance.sensitive('finance.records.delete', 'Delete income records', 'حذف سجلات الإيرادات'),
  finance.full('finance.expenses.add', 'Record expenses', 'تسجيل المصاريف'),
  finance.view('finance.expenses.view', 'See expenses', 'عرض المصاريف'),
  finance.sensitive('finance.expenses.delete', 'Delete expenses', 'حذف المصاريف'),
  finance.full('finance.expenses.edit', 'Edit expenses', 'تعديل المصاريف'),
] as const;

export const ANALYTICS_PERMISSIONS = [
  analytics.view('analytics.view', 'See sales figures', 'عرض أرقام المبيعات'),
  analytics.view('analytics.visitors.view', 'See visitor figures', 'عرض أرقام الزوار'),
] as const;

export const TEAM_PERMISSIONS = [
  team.full('team.members.invite', 'Invite members', 'دعوة أعضاء'),
  team.view('team.members.view', 'See members', 'عرض الأعضاء'),
  team.sensitive('team.members.remove', 'Remove members', 'إزالة الأعضاء'),
  team.full('team.members.edit', 'Change member access', 'تغيير صلاحيات الأعضاء'),
  team.full('team.roles.create', 'Create roles', 'إنشاء أدوار'),
  team.view('team.roles.view', 'See roles', 'عرض الأدوار'),
  team.sensitive('team.roles.delete', 'Delete roles', 'حذف الأدوار'),
  team.full('team.roles.edit', 'Edit roles', 'تعديل الأدوار'),
  team.full('team.commissions.set', 'Set commission rates', 'تحديد نسب العمولات'),
  team.view('team.commissions.view', 'See commission rates', 'عرض نسب العمولات'),
  team.sensitive('team.commissions.delete', 'Delete commission rates', 'حذف نسب العمولات'),
  team.full('team.commissions.edit', 'Edit commission rates', 'تعديل نسب العمولات'),
] as const;

export const DELIVERY_PERMISSIONS = [
  delivery.full('delivery.carriers.connect', 'Connect delivery companies', 'ربط شركات التوصيل'),
  delivery.view('delivery.carriers.view', 'See delivery companies', 'عرض شركات التوصيل'),
  delivery.sensitive('delivery.carriers.delete', 'Remove delivery companies', 'إزالة شركات التوصيل'),
  delivery.full('delivery.carriers.edit', 'Edit delivery companies', 'تعديل شركات التوصيل'),
  delivery.full('delivery.pricing.create', 'Add delivery rates', 'إضافة أسعار التوصيل'),
  delivery.view('delivery.pricing.view', 'See delivery rates', 'عرض أسعار التوصيل'),
  delivery.sensitive('delivery.pricing.delete', 'Delete delivery rates', 'حذف أسعار التوصيل'),
  delivery.full('delivery.pricing.edit', 'Edit delivery rates', 'تعديل أسعار التوصيل'),
] as const;
