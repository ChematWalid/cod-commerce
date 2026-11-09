import { definitionsFor } from './define';

const { view, full, sensitive } = definitionsFor('orders');

export const ORDERS_PERMISSIONS = [
  full('orders.create', 'Create orders', 'إنشاء الطلبات'),
  view('orders.view', 'See own orders', 'عرض الطلبات الخاصة'),
  sensitive('orders.view-all', "See every member's orders", 'عرض طلبات جميع الأعضاء'),
  sensitive('orders.delete', 'Delete orders', 'حذف الطلبات'),
  full('orders.edit', 'Edit order details', 'تعديل تفاصيل الطلب'),
  full('orders.dispatch', 'Send orders out for delivery', 'إرسال الطلبات للتوصيل'),
  full('orders.mark-delivered', 'Mark orders as delivered', 'تأكيد تسليم الطلبات'),
  full('orders.print-labels', 'Print shipping labels', 'طباعة بطاقات الشحن'),
  full('orders.confirm', 'Confirm orders with buyers', 'تأكيد الطلبات مع المشترين'),
  sensitive('orders.cancel', 'Cancel orders', 'إلغاء الطلبات'),
  full('orders.schedule', 'Schedule order delivery', 'جدولة موعد التسليم'),
  sensitive('orders.returns.create', 'Open a return', 'فتح طلب إرجاع'),
  full('orders.returns.process', 'Process returns', 'معالجة المرتجعات'),
  view('orders.returns.view', 'See returns', 'عرض المرتجعات'),
  full('orders.comment', 'Add notes to orders', 'إضافة ملاحظات على الطلبات'),
  sensitive('orders.comments.delete', 'Delete order notes', 'حذف ملاحظات الطلبات'),
  sensitive('orders.discount', 'Change order prices and discounts', 'تغيير أسعار الطلبات وخصوماتها'),
  view('orders.customers.view', 'See buyers', 'عرض المشترين'),
  full('orders.customers.manage', 'Manage buyers', 'إدارة المشترين'),
] as const;
