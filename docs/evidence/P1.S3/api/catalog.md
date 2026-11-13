# Permission catalog

Every signed-in member reads it. 94 permissions in 12 areas.

### permissionCatalog

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query { permissionCatalog { areas { id order label { en ar fr } } permissions { key area level sensitive label { en ar fr } } } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "permissionCatalog": {
      "areas": [
        {
          "id": "orders",
          "order": 1,
          "label": {
            "en": "Orders",
            "ar": "الطلبات",
            "fr": "Orders"
          }
        },
        {
          "id": "tracking",
          "order": 2,
          "label": {
            "en": "Order tracking",
            "ar": "تتبّع الطلبات",
            "fr": "Order tracking"
          }
        },
        {
          "id": "catalog",
          "order": 3,
          "label": {
            "en": "Products and catalog",
            "ar": "المنتجات والفهرس",
            "fr": "Products and catalog"
          }
        },
        {
          "id": "offers",
          "order": 4,
          "label": {
            "en": "Offers",
            "ar": "العروض",
            "fr": "Offers"
          }
        },
        {
          "id": "inventory",
          "order": 5,
          "label": {
            "en": "Inventory",
            "ar": "المخزون",
            "fr": "Inventory"
          }
        },
        {
          "id": "finance",
          "order": 6,
          "label": {
            "en": "Finance",
            "ar": "المالية",
            "fr": "Finance"
          }
        },
        {
          "id": "analytics",
          "order": 7,
          "label": {
            "en": "Analytics",
            "ar": "التحليلات",
            "fr": "Analytics"
          }
        },
        {
          "id": "team",
          "order": 8,
          "label": {
            "en": "Team",
            "ar": "الفريق",
            "fr": "Team"
          }
        },
        {
          "id": "delivery",
          "order": 9,
          "label": {
            "en": "Delivery",
            "ar": "التوصيل",
            "fr": "Delivery"
          }
        },
        {
          "id": "store",
          "order": 10,
          "label": {
            "en": "Store and storefront",
            "ar": "المتجر وواجهته",
            "fr": "Store and storefront"
          }
        },
        {
          "id": "apps",
          "order": 11,
          "label": {
            "en": "Apps and integrations",
            "ar": "التطبيقات والتكاملات",
            "fr": "Apps and integrations"
          }
        },
        {
          "id": "settings",
          "order": 12,
          "label": {
            "en": "Business settings",
            "ar": "إعدادات النشاط",
            "fr": "Business settings"
          }
        }
      ],
      "permissions": [
        {
          "key": "orders.create",
          "area": "orders",
          "level": "full",
          "sensitive": false,
          "label": {
            "en": "Create orders",
            "ar": "إنشاء الطلبات",
            "fr": "Create orders"
          }
        },
        {
          "key": "orders.view",
          "area": "orders",
          "level": "view",
          "sensitive": false,
          "label": {
            "en": "See own orders",
            "ar": "عرض الطلبات الخاصة",
            "fr": "See own orders"
          }
        },
        {
          "key": "orders.view-all",
          "area": "orders",
          "level": "full",
          "sensitive": true,
          "label": {
            "en": "See every member's orders",
            "ar": "عرض طلبات جميع الأعضاء",
            "fr": "See every member's orders"
          }
        },
        {
          "key": "orders.delete",
          "area": "orders",
          "level": "full",
          "sensitive": true,
          "label": {
            "en": "Delete orders",
            "ar": "حذف الطلبات",
            "fr": "Delete orders"
          }
        },
        {
          "key": "orders.edit",
          "area": "orders",
          "level": "full",
          "sensitive": false,
          "label": {
            "en": "Edit order details",
            "ar": "تعديل تفاصيل الطلب",
            "fr": "Edit order details"
          }
        },
        {
          "key": "orders.dispatch",
          "area": "orders",
          "level": "full",
          "sensitive": false,
          "label": {
            "en": "Send orders out for delivery",
            "ar": "إرسال الطلبات للتوصيل",
            "fr": "Send orders out for delivery"
          }
        },
        {
          "key": "orders.mark-delivered",
          "area": "orders",
          "level": "full",
          "sensitive": false,
          "label": {
            "en": "Mark orders as delivered",
            "ar": "تأكيد تسليم الطلبات",
            "fr": "Mark orders as delivered"
          }
        },
        {
          "key": "orders.print-labels",
          "area": "orders",
          "level": "full",
          "sensitive": false,
          "label": {
            "en": "Print shipping labels",
            "ar": "طباعة بطاقات الشحن",
            "fr": "Print shipping labels"
          }
        },
        {
          "key": "orders.confirm",
          "area": "orders",
          "level": "full",
          "sensitive": false,
          "label": {
            "en": "Confirm orders with buyers",
            "ar": "تأكيد الطلبات مع المشترين",
            "fr": "Confirm orders with buyers"
          }
        },
        {
          "key": "orders.cancel",
          "area": "orders",
          "level": "full",
          "sensitive": true,
          "label": {
            "en": "Cancel orders",
            "ar": "إلغاء الطلبات",
            "fr": "Cancel orders"
          }
        },
        {
          "key": "orders.schedule",
          "area": "orders",
          "level": "full",
          "sensitive": false,
          "label": {
            "en": "Schedule order delivery",
            "ar": "جدولة موعد التسليم",
            "fr": "Schedule order delivery"
          }
        },
        {
          "key": "orders.returns.create",
          "area": "orders",
          "level": "full",
          "sensitive": true,
          "label": {
            "en": "Open a return",
            "ar": "فتح طلب إرجاع",
            "fr": "Open a return"
          }
        },
        {
          "key": "orders.returns.process",
          "area": "orders",
          "level": "full",
          "sensitive": false,
          "label": {
            "en": "Process returns",
            "ar": "معالجة المرتجعات",
            "fr": "Process returns"
          }
        },
        {
          "key": "orders.returns.view",
          "area": "orders",
          "level": "view",
          "sensitive": false,
          "label": {
            "en": "See returns",
            "ar": "عرض المرتجعات",
            "fr": "See returns"
          }
        },
        {
          "key": "orders.comment",
          "area": "orders",
          "level": "full",
          "sensitive": false,
          "label": {
            "en": "Add notes to orders",
            "ar": "إضافة ملاحظات على الطلبات",
            "fr": "Add notes to orders"
          }
        },
        {
          "key": "orders.comments.delete",
          "area": "orders",
          "level": "full",
          "sensitive": true,
          "label": {
            "en": "Delete order notes",
            "ar": "حذف ملاحظات الطلبات",
            "fr": "Delete order notes"
          }
        },
        {
          "key": "orders.discount",
          "area": "orders",
          "level": "full",
          "sensitive": true,
          "label": {
            "en": "Change order prices and discounts",
            "ar": "تغيير أسعار الطلبات وخصوماتها",
            "fr": "Change order prices and discounts"
          }
        },
        {
          "key": "orders.customers.view",
          "area": "orders",
          "level": "view",
          "sensitive": false,
          "label": {
            "en": "See buyers",
            "ar": "عرض المشترين",
            "fr": "See buyers"
          }
        },
        {
          "key": "orders.customers.manage",
          "area": "orders",
          "level": "full",
          "sensitive": false,
          "label": {
            "en": "Manage buyers",
            "ar": "إدارة المشترين",
            "fr": "Manage buyers"
          }
        },
        {
          "key": "tracking.view",
          "area": "tracking",
          "level": "view",
          "sensitive": false,
          "label": {
            "en": "Follow own shipments",
            "ar": "متابعة الشحنات الخاصة",
            "fr": "Follow own shipments"
          }
        },
        {
          "key": "tracking.view-all",
          "area": "tracking",
          "level": "full",
          "sensitive": true,
          "label": {
            "en": "Follow every member's shipments",
            "ar": "متابعة شحنات جميع الأعضاء",
            "fr": "Follow every member's shipments"
          }
        },
        {
          "key": "tracking.update",
          "area": "tracking",
          "level": "full",
          "sensitive": false,
          "label": {
            "en": "Update shipment status",
            "ar": "تحديث حالة الشحنة",
            "fr": "Update shipment status"
          }
        },
        {
          "key": "catalog.products.create",
          "area": "catalog",
          "level": "full",
          "sensitive": false,
          "label": {
            "en": "Add products",
            "ar": "إضافة منتجات",
            "fr": "Add products"
          }
        },
        {
          "key": "catalog.products.view",
          "area": "catalog",
          "level": "view",
          "sensitive": false,
          "label": {
            "en": "See products",
            "ar": "عرض المنتجات",
            "fr": "See products"
          }
        },
        {
          "key": "catalog.products.delete",
          "area": "catalog",
          "level": "full",
          "sensitive": true,
          "label": {
            "en": "Delete products",
            "ar": "حذف المنتجات",
            "fr": "Delete products"
          }
        },
        {
          "key": "catalog.products.edit",
          "area": "catalog",
          "level": "full",
          "sensitive": false,
          "label": {
            "en": "Edit products",
            "ar": "تعديل المنتجات",
            "fr": "Edit products"
          }
        },
        {
          "key": "catalog.collections.create",
          "area": "catalog",
          "level": "full",
          "sensitive": false,
          "label": {
            "en": "Add collections",
            "ar": "إضافة تشكيلات",
            "fr": "Add collections"
          }
        },
        {
          "key": "catalog.collections.view",
          "area": "catalog",
          "level": "view",
          "sensitive": false,
          "label": {
            "en": "See collections",
            "ar": "عرض التشكيلات",
            "fr": "See collections"
          }
        },
        {
          "key": "catalog.collections.delete",
          "area": "catalog",
          "level": "full",
          "sensitive": true,
          "label": {
            "en": "Delete collections",
            "ar": "حذف التشكيلات",
            "fr": "Delete collections"
          }
        },
        {
          "key": "catalog.collections.edit",
          "area": "catalog",
          "level": "full",
          "sensitive": false,
          "label": {
            "en": "Edit collections",
            "ar": "تعديل التشكيلات",
            "fr": "Edit collections"
          }
        },
        {
          "key": "offers.create",
          "area": "offers",
          "level": "full",
          "sensitive": false,
          "label": {
            "en": "Create offers",
            "ar": "إنشاء عروض",
            "fr": "Create offers"
          }
        },
        {
          "key": "offers.view",
          "area": "offers",
          "level": "view",
          "sensitive": false,
          "label": {
            "en": "See offers",
            "ar": "عرض العروض",
            "fr": "See offers"
          }
        },
        {
          "key": "offers.delete",
          "area": "offers",
          "level": "full",
          "sensitive": true,
          "label": {
            "en": "Delete offers",
            "ar": "حذف العروض",
            "fr": "Delete offers"
          }
        },
        {
          "key": "offers.edit",
          "area": "offers",
          "level": "full",
          "sensitive": false,
          "label": {
            "en": "Edit offers",
            "ar": "تعديل العروض",
            "fr": "Edit offers"
          }
        },
        {
          "key": "inventory.stock.add",
          "area": "inventory",
          "level": "full",
          "sensitive": false,
          "label": {
            "en": "Receive new stock",
            "ar": "إدخال مخزون جديد",
            "fr": "Receive new stock"
          }
        },
        {
          "key": "inventory.stock.view",
          "area": "inventory",
          "level": "view",
          "sensitive": false,
          "label": {
            "en": "See stock levels",
            "ar": "عرض مستويات المخزون",
            "fr": "See stock levels"
          }
        },
        {
          "key": "inventory.stock.adjust",
          "area": "inventory",
          "level": "full",
          "sensitive": false,
          "label": {
            "en": "Correct stock counts",
            "ar": "تصحيح كميات المخزون",
            "fr": "Correct stock counts"
          }
        },
        {
          "key": "inventory.buy-prices",
          "area": "inventory",
          "level": "full",
          "sensitive": true,
          "label": {
            "en": "See purchase prices",
            "ar": "الاطلاع على أسعار الشراء",
            "fr": "See purchase prices"
          }
        },
        {
          "key": "finance.records.add",
          "area": "finance",
          "level": "full",
          "sensitive": false,
          "label": {
            "en": "Record income",
            "ar": "تسجيل الإيرادات",
            "fr": "Record income"
          }
        },
        {
          "key": "finance.records.view",
          "area": "finance",
          "level": "view",
          "sensitive": false,
          "label": {
            "en": "See income records",
            "ar": "عرض سجلات الإيرادات",
            "fr": "See income records"
          }
        },
        {
          "key": "finance.records.delete",
          "area": "finance",
          "level": "full",
          "sensitive": true,
          "label": {
            "en": "Delete income records",
            "ar": "حذف سجلات الإيرادات",
            "fr": "Delete income records"
          }
        },
        {
          "key": "finance.expenses.add",
          "area": "finance",
          "level": "full",
          "sensitive": false,
          "label": {
            "en": "Record expenses",
            "ar": "تسجيل المصاريف",
            "fr": "Record expenses"
          }
        },
        {
          "key": "finance.expenses.view",
          "area": "finance",
          "level": "view",
          "sensitive": false,
          "label": {
            "en": "See expenses",
            "ar": "عرض المصاريف",
            "fr": "See expenses"
          }
        },
        {
          "key": "finance.expenses.delete",
          "area": "finance",
          "level": "full",
          "sensitive": true,
          "label": {
            "en": "Delete expenses",
            "ar": "حذف المصاريف",
            "fr": "Delete expenses"
          }
        },
        {
          "key": "finance.expenses.edit",
          "area": "finance",
          "level": "full",
          "sensitive": false,
          "label": {
            "en": "Edit expenses",
            "ar": "تعديل المصاريف",
            "fr": "Edit expenses"
          }
        },
        {
          "key": "analytics.view",
          "area": "analytics",
          "level": "view",
          "sensitive": false,
          "label": {
            "en": "See sales figures",
            "ar": "عرض أرقام المبيعات",
            "fr": "See sales figures"
          }
        },
        {
          "key": "analytics.visitors.view",
          "area": "analytics",
          "level": "view",
          "sensitive": false,
          "label": {
            "en": "See visitor figures",
            "ar": "عرض أرقام الزوار",
            "fr": "See visitor figures"
          }
        },
        {
          "key": "team.members.invite",
          "area": "team",
          "level": "full",
          "sensitive": false,
          "label": {
            "en": "Invite members",
            "ar": "دعوة أعضاء",
            "fr": "Invite members"
          }
        },
        {
          "key": "team.members.view",
          "area": "team",
          "level": "view",
          "sensitive": false,
          "label": {
            "en": "See members",
            "ar": "عرض الأعضاء",
            "fr": "See members"
          }
        },
        {
          "key": "team.members.remove",
          "area": "team",
          "level": "full",
          "sensitive": true,
          "label": {
            "en": "Remove members",
            "ar": "إزالة الأعضاء",
            "fr": "Remove members"
          }
        },
        {
          "key": "team.members.edit",
          "area": "team",
          "level": "full",
          "sensitive": false,
          "label": {
            "en": "Change member access",
            "ar": "تغيير صلاحيات الأعضاء",
            "fr": "Change member access"
          }
        },
        {
          "key": "team.roles.create",
          "area": "team",
          "level": "full",
          "sensitive": false,
          "label": {
            "en": "Create roles",
            "ar": "إنشاء أدوار",
            "fr": "Create roles"
          }
        },
        {
          "key": "team.roles.view",
          "area": "team",
          "level": "view",
          "sensitive": false,
          "label": {
            "en": "See roles",
            "ar": "عرض الأدوار",
            "fr": "See roles"
          }
        },
        {
          "key": "team.roles.delete",
          "area": "team",
          "level": "full",
          "sensitive": true,
          "label": {
            "en": "Delete roles",
            "ar": "حذف الأدوار",
            "fr": "Delete roles"
          }
        },
        {
          "key": "team.roles.edit",
          "area": "team",
          "level": "full",
          "sensitive": false,
          "label": {
            "en": "Edit roles",
            "ar": "تعديل الأدوار",
            "fr": "Edit roles"
          }
        },
        {
          "key": "team.commissions.set",
          "area": "team",
          "level": "full",
          "sensitive": false,
          "label": {
            "en": "Set commission rates",
            "ar": "تحديد نسب العمولات",
            "fr": "Set commission rates"
          }
        },
        {
          "key": "team.commissions.view",
          "area": "team",
          "level": "view",
          "sensitive": false,
          "label": {
            "en": "See commission rates",
            "ar": "عرض نسب العمولات",
            "fr": "See commission rates"
          }
        },
        {
          "key": "team.commissions.delete",
          "area": "team",
          "level": "full",
          "sensitive": true,
          "label": {
            "en": "Delete commission rates",
            "ar": "حذف نسب العمولات",
            "fr": "Delete commission rates"
          }
        },
        {
          "key": "team.commissions.edit",
          "area": "team",
          "level": "full",
          "sensitive": false,
          "label": {
            "en": "Edit commission rates",
            "ar": "تعديل نسب العمولات",
            "fr": "Edit commission rates"
          }
        },
        {
          "key": "delivery.carriers.connect",
          "area": "delivery",
          "level": "full",
          "sensitive": false,
          "label": {
            "en": "Connect delivery companies",
            "ar": "ربط شركات التوصيل",
            "fr": "Connect delivery companies"
          }
        },
        {
          "key": "delivery.carriers.view",
          "area": "delivery",
          "level": "view",
          "sensitive": false,
          "label": {
            "en": "See delivery companies",
            "ar": "عرض شركات التوصيل",
            "fr": "See delivery companies"
          }
        },
        {
          "key": "delivery.carriers.delete",
          "area": "delivery",
          "level": "full",
          "sensitive": true,
          "label": {
            "en": "Remove delivery companies",
            "ar": "إزالة شركات التوصيل",
            "fr": "Remove delivery companies"
          }
        },
        {
          "key": "delivery.carriers.edit",
          "area": "delivery",
          "level": "full",
          "sensitive": false,
          "label": {
            "en": "Edit delivery companies",
            "ar": "تعديل شركات التوصيل",
            "fr": "Edit delivery companies"
          }
        },
        {
          "key": "delivery.pricing.create",
          "area": "delivery",
          "level": "full",
          "sensitive": false,
          "label": {
            "en": "Add delivery rates",
            "ar": "إضافة أسعار التوصيل",
            "fr": "Add delivery rates"
          }
        },
        {
          "key": "delivery.pricing.view",
          "area": "delivery",
          "level": "view",
          "sensitive": false,
          "label": {
            "en": "See delivery rates",
            "ar": "عرض أسعار التوصيل",
            "fr": "See delivery rates"
          }
        },
        {
          "key": "delivery.pricing.delete",
          "area": "delivery",
          "level": "full",
          "sensitive": true,
          "label": {
            "en": "Delete delivery rates",
            "ar": "حذف أسعار التوصيل",
            "fr": "Delete delivery rates"
          }
        },
        {
          "key": "delivery.pricing.edit",
          "area": "delivery",
          "level": "full",
          "sensitive": false,
          "label": {
            "en": "Edit delivery rates",
            "ar": "تعديل أسعار التوصيل",
            "fr": "Edit delivery rates"
          }
        },
        {
          "key": "store.stores.create",
          "area": "store",
          "level": "full",
          "sensitive": false,
          "label": {
            "en": "Open new stores",
            "ar": "فتح متاجر جديدة",
            "fr": "Open new stores"
          }
        },
        {
          "key": "store.stores.view",
          "area": "store",
          "level": "view",
          "sensitive": false,
          "label": {
            "en": "See stores",
            "ar": "عرض المتاجر",
            "fr": "See stores"
          }
        },
        {
          "key": "store.stores.archive",
          "area": "store",
          "level": "full",
          "sensitive": true,
          "label": {
            "en": "Archive stores",
            "ar": "أرشفة المتاجر",
            "fr": "Archive stores"
          }
        },
        {
          "key": "store.settings.edit",
          "area": "store",
          "level": "full",
          "sensitive": false,
          "label": {
            "en": "Edit store settings",
            "ar": "تعديل إعدادات المتجر",
            "fr": "Edit store settings"
          }
        },
        {
          "key": "store.builder.open",
          "area": "store",
          "level": "full",
          "sensitive": false,
          "label": {
            "en": "Open the store builder",
            "ar": "فتح أداة تصميم المتجر",
            "fr": "Open the store builder"
          }
        },
        {
          "key": "store.pages.edit",
          "area": "store",
          "level": "full",
          "sensitive": false,
          "label": {
            "en": "Edit store pages",
            "ar": "تعديل صفحات المتجر",
            "fr": "Edit store pages"
          }
        },
        {
          "key": "store.publish",
          "area": "store",
          "level": "full",
          "sensitive": true,
          "label": {
            "en": "Publish the store",
            "ar": "نشر المتجر",
            "fr": "Publish the store"
          }
        },
        {
          "key": "store.discard",
          "area": "store",
          "level": "full",
          "sensitive": true,
          "label": {
            "en": "Discard unpublished changes",
            "ar": "التخلي عن التغييرات غير المنشورة",
            "fr": "Discard unpublished changes"
          }
        },
        {
          "key": "store.landing-pages.create",
          "area": "store",
          "level": "full",
          "sensitive": false,
          "label": {
            "en": "Create landing pages",
            "ar": "إنشاء صفحات هبوط",
            "fr": "Create landing pages"
          }
        },
        {
          "key": "store.landing-pages.view",
          "area": "store",
          "level": "view",
          "sensitive": false,
          "label": {
            "en": "See landing pages",
            "ar": "عرض صفحات الهبوط",
            "fr": "See landing pages"
          }
        },
        {
          "key": "store.landing-pages.delete",
          "area": "store",
          "level": "full",
          "sensitive": true,
          "label": {
            "en": "Delete landing pages",
            "ar": "حذف صفحات الهبوط",
            "fr": "Delete landing pages"
          }
        },
        {
          "key": "store.landing-pages.edit",
          "area": "store",
          "level": "full",
          "sensitive": false,
          "label": {
            "en": "Edit landing pages",
            "ar": "تعديل صفحات الهبوط",
            "fr": "Edit landing pages"
          }
        },
        {
          "key": "store.domains.connect",
          "area": "store",
          "level": "full",
          "sensitive": false,
          "label": {
            "en": "Connect domains",
            "ar": "ربط النطاقات",
            "fr": "Connect domains"
          }
        },
        {
          "key": "store.domains.view",
          "area": "store",
          "level": "view",
          "sensitive": false,
          "label": {
            "en": "See domains",
            "ar": "عرض النطاقات",
            "fr": "See domains"
          }
        },
        {
          "key": "store.domains.remove",
          "area": "store",
          "level": "full",
          "sensitive": true,
          "label": {
            "en": "Remove domains",
            "ar": "إزالة النطاقات",
            "fr": "Remove domains"
          }
        },
        {
          "key": "store.domains.edit",
          "area": "store",
          "level": "full",
          "sensitive": false,
          "label": {
            "en": "Edit domains",
            "ar": "تعديل النطاقات",
            "fr": "Edit domains"
          }
        },
        {
          "key": "apps.view",
          "area": "apps",
          "level": "view",
          "sensitive": false,
          "label": {
            "en": "See apps",
            "ar": "عرض التطبيقات",
            "fr": "See apps"
          }
        },
        {
          "key": "apps.connect",
          "area": "apps",
          "level": "full",
          "sensitive": false,
          "label": {
            "en": "Connect apps",
            "ar": "ربط التطبيقات",
            "fr": "Connect apps"
          }
        },
        {
          "key": "apps.manage",
          "area": "apps",
          "level": "full",
          "sensitive": false,
          "label": {
            "en": "Manage connected apps",
            "ar": "إدارة التطبيقات المرتبطة",
            "fr": "Manage connected apps"
          }
        },
        {
          "key": "apps.disconnect",
          "area": "apps",
          "level": "full",
          "sensitive": true,
          "label": {
            "en": "Disconnect apps",
            "ar": "فصل التطبيقات",
            "fr": "Disconnect apps"
          }
        },
        {
          "key": "apps.whatsapp.view",
          "area": "apps",
          "level": "view",
          "sensitive": false,
          "label": {
            "en": "See messaging setup",
            "ar": "عرض إعداد المراسلة",
            "fr": "See messaging setup"
          }
        },
        {
          "key": "apps.whatsapp.manage",
          "area": "apps",
          "level": "full",
          "sensitive": false,
          "label": {
            "en": "Manage messaging",
            "ar": "إدارة المراسلة",
            "fr": "Manage messaging"
          }
        },
        {
          "key": "apps.cargo.request",
          "area": "apps",
          "level": "full",
          "sensitive": false,
          "label": {
            "en": "Request freight pickups",
            "ar": "طلب خدمة نقل البضائع",
            "fr": "Request freight pickups"
          }
        },
        {
          "key": "apps.cargo.view",
          "area": "apps",
          "level": "view",
          "sensitive": false,
          "label": {
            "en": "See freight requests",
            "ar": "عرض طلبات نقل البضائع",
            "fr": "See freight requests"
          }
        },
        {
          "key": "settings.business.view",
          "area": "settings",
          "level": "view",
          "sensitive": false,
          "label": {
            "en": "See business settings",
            "ar": "عرض إعدادات النشاط",
            "fr": "See business settings"
          }
        },
        {
          "key": "settings.business.edit",
          "area": "settings",
          "level": "full",
          "sensitive": true,
          "label": {
            "en": "Edit business settings",
            "ar": "تعديل إعدادات النشاط",
            "fr": "Edit business settings"
          }
        },
        {
          "key": "settings.activity-log.view",
          "area": "settings",
          "level": "view",
          "sensitive": false,
          "label": {
            "en": "See the activity log",
            "ar": "عرض سجل النشاط",
            "fr": "See the activity log"
          }
        }
      ]
    }
  }
}
```

### GET /permissions/catalog

```http
GET http://127.0.0.1:23100/permissions/catalog
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "areas": [
    {
      "id": "orders",
      "order": 1,
      "label": {
        "en": "Orders",
        "ar": "الطلبات",
        "fr": "Orders"
      }
    },
    {
      "id": "tracking",
      "order": 2,
      "label": {
        "en": "Order tracking",
        "ar": "تتبّع الطلبات",
        "fr": "Order tracking"
      }
    },
    {
      "id": "catalog",
      "order": 3,
      "label": {
        "en": "Products and catalog",
        "ar": "المنتجات والفهرس",
        "fr": "Products and catalog"
      }
    },
    {
      "id": "offers",
      "order": 4,
      "label": {
        "en": "Offers",
        "ar": "العروض",
        "fr": "Offers"
      }
    },
    {
      "id": "inventory",
      "order": 5,
      "label": {
        "en": "Inventory",
        "ar": "المخزون",
        "fr": "Inventory"
      }
    },
    {
      "id": "finance",
      "order": 6,
      "label": {
        "en": "Finance",
        "ar": "المالية",
        "fr": "Finance"
      }
    },
    {
      "id": "analytics",
      "order": 7,
      "label": {
        "en": "Analytics",
        "ar": "التحليلات",
        "fr": "Analytics"
      }
    },
    {
      "id": "team",
      "order": 8,
      "label": {
        "en": "Team",
        "ar": "الفريق",
        "fr": "Team"
      }
    },
    {
      "id": "delivery",
      "order": 9,
      "label": {
        "en": "Delivery",
        "ar": "التوصيل",
        "fr": "Delivery"
      }
    },
    {
      "id": "store",
      "order": 10,
      "label": {
        "en": "Store and storefront",
        "ar": "المتجر وواجهته",
        "fr": "Store and storefront"
      }
    },
    {
      "id": "apps",
      "order": 11,
      "label": {
        "en": "Apps and integrations",
        "ar": "التطبيقات والتكاملات",
        "fr": "Apps and integrations"
      }
    },
    {
      "id": "settings",
      "order": 12,
      "label": {
        "en": "Business settings",
        "ar": "إعدادات النشاط",
        "fr": "Business settings"
      }
    }
  ],
  "permissions": [
    {
      "key": "orders.create",
      "area": "orders",
      "level": "full",
      "sensitive": false,
      "label": {
        "en": "Create orders",
        "ar": "إنشاء الطلبات",
        "fr": "Create orders"
      }
    },
    {
      "key": "orders.view",
      "area": "orders",
      "level": "view",
      "sensitive": false,
      "label": {
        "en": "See own orders",
        "ar": "عرض الطلبات الخاصة",
        "fr": "See own orders"
      }
    },
    {
      "key": "orders.view-all",
      "area": "orders",
      "level": "full",
      "sensitive": true,
      "label": {
        "en": "See every member's orders",
        "ar": "عرض طلبات جميع الأعضاء",
        "fr": "See every member's orders"
      }
    },
    {
      "key": "orders.delete",
      "area": "orders",
      "level": "full",
      "sensitive": true,
      "label": {
        "en": "Delete orders",
        "ar": "حذف الطلبات",
        "fr": "Delete orders"
      }
    },
    {
      "key": "orders.edit",
      "area": "orders",
      "level": "full",
      "sensitive": false,
      "label": {
        "en": "Edit order details",
        "ar": "تعديل تفاصيل الطلب",
        "fr": "Edit order details"
      }
    },
    {
      "key": "orders.dispatch",
      "area": "orders",
      "level": "full",
      "sensitive": false,
      "label": {
        "en": "Send orders out for delivery",
        "ar": "إرسال الطلبات للتوصيل",
        "fr": "Send orders out for delivery"
      }
    },
    {
      "key": "orders.mark-delivered",
      "area": "orders",
      "level": "full",
      "sensitive": false,
      "label": {
        "en": "Mark orders as delivered",
        "ar": "تأكيد تسليم الطلبات",
        "fr": "Mark orders as delivered"
      }
    },
    {
      "key": "orders.print-labels",
      "area": "orders",
      "level": "full",
      "sensitive": false,
      "label": {
        "en": "Print shipping labels",
        "ar": "طباعة بطاقات الشحن",
        "fr": "Print shipping labels"
      }
    },
    {
      "key": "orders.confirm",
      "area": "orders",
      "level": "full",
      "sensitive": false,
      "label": {
        "en": "Confirm orders with buyers",
        "ar": "تأكيد الطلبات مع المشترين",
        "fr": "Confirm orders with buyers"
      }
    },
    {
      "key": "orders.cancel",
      "area": "orders",
      "level": "full",
      "sensitive": true,
      "label": {
        "en": "Cancel orders",
        "ar": "إلغاء الطلبات",
        "fr": "Cancel orders"
      }
    },
    {
      "key": "orders.schedule",
      "area": "orders",
      "level": "full",
      "sensitive": false,
      "label": {
        "en": "Schedule order delivery",
        "ar": "جدولة موعد التسليم",
        "fr": "Schedule order delivery"
      }
    },
    {
      "key": "orders.returns.create",
      "area": "orders",
      "level": "full",
      "sensitive": true,
      "label": {
        "en": "Open a return",
        "ar": "فتح طلب إرجاع",
        "fr": "Open a return"
      }
    },
    {
      "key": "orders.returns.process",
      "area": "orders",
      "level": "full",
      "sensitive": false,
      "label": {
        "en": "Process returns",
        "ar": "معالجة المرتجعات",
        "fr": "Process returns"
      }
    },
    {
      "key": "orders.returns.view",
      "area": "orders",
      "level": "view",
      "sensitive": false,
      "label": {
        "en": "See returns",
        "ar": "عرض المرتجعات",
        "fr": "See returns"
      }
    },
    {
      "key": "orders.comment",
      "area": "orders",
      "level": "full",
      "sensitive": false,
      "label": {
        "en": "Add notes to orders",
        "ar": "إضافة ملاحظات على الطلبات",
        "fr": "Add notes to orders"
      }
    },
    {
      "key": "orders.comments.delete",
      "area": "orders",
      "level": "full",
      "sensitive": true,
      "label": {
        "en": "Delete order notes",
        "ar": "حذف ملاحظات الطلبات",
        "fr": "Delete order notes"
      }
    },
    {
      "key": "orders.discount",
      "area": "orders",
      "level": "full",
      "sensitive": true,
      "label": {
        "en": "Change order prices and discounts",
        "ar": "تغيير أسعار الطلبات وخصوماتها",
        "fr": "Change order prices and discounts"
      }
    },
    {
      "key": "orders.customers.view",
      "area": "orders",
      "level": "view",
      "sensitive": false,
      "label": {
        "en": "See buyers",
        "ar": "عرض المشترين",
        "fr": "See buyers"
      }
    },
    {
      "key": "orders.customers.manage",
      "area": "orders",
      "level": "full",
      "sensitive": false,
      "label": {
        "en": "Manage buyers",
        "ar": "إدارة المشترين",
        "fr": "Manage buyers"
      }
    },
    {
      "key": "tracking.view",
      "area": "tracking",
      "level": "view",
      "sensitive": false,
      "label": {
        "en": "Follow own shipments",
        "ar": "متابعة الشحنات الخاصة",
        "fr": "Follow own shipments"
      }
    },
    {
      "key": "tracking.view-all",
      "area": "tracking",
      "level": "full",
      "sensitive": true,
      "label": {
        "en": "Follow every member's shipments",
        "ar": "متابعة شحنات جميع الأعضاء",
        "fr": "Follow every member's shipments"
      }
    },
    {
      "key": "tracking.update",
      "area": "tracking",
      "level": "full",
      "sensitive": false,
      "label": {
        "en": "Update shipment status",
        "ar": "تحديث حالة الشحنة",
        "fr": "Update shipment status"
      }
    },
    {
      "key": "catalog.products.create",
      "area": "catalog",
      "level": "full",
      "sensitive": false,
      "label": {
        "en": "Add products",
        "ar": "إضافة منتجات",
        "fr": "Add products"
      }
    },
    {
      "key": "catalog.products.view",
      "area": "catalog",
      "level": "view",
      "sensitive": false,
      "label": {
        "en": "See products",
        "ar": "عرض المنتجات",
        "fr": "See products"
      }
    },
    {
      "key": "catalog.products.delete",
      "area": "catalog",
      "level": "full",
      "sensitive": true,
      "label": {
        "en": "Delete products",
        "ar": "حذف المنتجات",
        "fr": "Delete products"
      }
    },
    {
      "key": "catalog.products.edit",
      "area": "catalog",
      "level": "full",
      "sensitive": false,
      "label": {
        "en": "Edit products",
        "ar": "تعديل المنتجات",
        "fr": "Edit products"
      }
    },
    {
      "key": "catalog.collections.create",
      "area": "catalog",
      "level": "full",
      "sensitive": false,
      "label": {
        "en": "Add collections",
        "ar": "إضافة تشكيلات",
        "fr": "Add collections"
      }
    },
    {
      "key": "catalog.collections.view",
      "area": "catalog",
      "level": "view",
      "sensitive": false,
      "label": {
        "en": "See collections",
        "ar": "عرض التشكيلات",
        "fr": "See collections"
      }
    },
    {
      "key": "catalog.collections.delete",
      "area": "catalog",
      "level": "full",
      "sensitive": true,
      "label": {
        "en": "Delete collections",
        "ar": "حذف التشكيلات",
        "fr": "Delete collections"
      }
    },
    {
      "key": "catalog.collections.edit",
      "area": "catalog",
      "level": "full",
      "sensitive": false,
      "label": {
        "en": "Edit collections",
        "ar": "تعديل التشكيلات",
        "fr": "Edit collections"
      }
    },
    {
      "key": "offers.create",
      "area": "offers",
      "level": "full",
      "sensitive": false,
      "label": {
        "en": "Create offers",
        "ar": "إنشاء عروض",
        "fr": "Create offers"
      }
    },
    {
      "key": "offers.view",
      "area": "offers",
      "level": "view",
      "sensitive": false,
      "label": {
        "en": "See offers",
        "ar": "عرض العروض",
        "fr": "See offers"
      }
    },
    {
      "key": "offers.delete",
      "area": "offers",
      "level": "full",
      "sensitive": true,
      "label": {
        "en": "Delete offers",
        "ar": "حذف العروض",
        "fr": "Delete offers"
      }
    },
    {
      "key": "offers.edit",
      "area": "offers",
      "level": "full",
      "sensitive": false,
      "label": {
        "en": "Edit offers",
        "ar": "تعديل العروض",
        "fr": "Edit offers"
      }
    },
    {
      "key": "inventory.stock.add",
      "area": "inventory",
      "level": "full",
      "sensitive": false,
      "label": {
        "en": "Receive new stock",
        "ar": "إدخال مخزون جديد",
        "fr": "Receive new stock"
      }
    },
    {
      "key": "inventory.stock.view",
      "area": "inventory",
      "level": "view",
      "sensitive": false,
      "label": {
        "en": "See stock levels",
        "ar": "عرض مستويات المخزون",
        "fr": "See stock levels"
      }
    },
    {
      "key": "inventory.stock.adjust",
      "area": "inventory",
      "level": "full",
      "sensitive": false,
      "label": {
        "en": "Correct stock counts",
        "ar": "تصحيح كميات المخزون",
        "fr": "Correct stock counts"
      }
    },
    {
      "key": "inventory.buy-prices",
      "area": "inventory",
      "level": "full",
      "sensitive": true,
      "label": {
        "en": "See purchase prices",
        "ar": "الاطلاع على أسعار الشراء",
        "fr": "See purchase prices"
      }
    },
    {
      "key": "finance.records.add",
      "area": "finance",
      "level": "full",
      "sensitive": false,
      "label": {
        "en": "Record income",
        "ar": "تسجيل الإيرادات",
        "fr": "Record income"
      }
    },
    {
      "key": "finance.records.view",
      "area": "finance",
      "level": "view",
      "sensitive": false,
      "label": {
        "en": "See income records",
        "ar": "عرض سجلات الإيرادات",
        "fr": "See income records"
      }
    },
    {
      "key": "finance.records.delete",
      "area": "finance",
      "level": "full",
      "sensitive": true,
      "label": {
        "en": "Delete income records",
        "ar": "حذف سجلات الإيرادات",
        "fr": "Delete income records"
      }
    },
    {
      "key": "finance.expenses.add",
      "area": "finance",
      "level": "full",
      "sensitive": false,
      "label": {
        "en": "Record expenses",
        "ar": "تسجيل المصاريف",
        "fr": "Record expenses"
      }
    },
    {
      "key": "finance.expenses.view",
      "area": "finance",
      "level": "view",
      "sensitive": false,
      "label": {
        "en": "See expenses",
        "ar": "عرض المصاريف",
        "fr": "See expenses"
      }
    },
    {
      "key": "finance.expenses.delete",
      "area": "finance",
      "level": "full",
      "sensitive": true,
      "label": {
        "en": "Delete expenses",
        "ar": "حذف المصاريف",
        "fr": "Delete expenses"
      }
    },
    {
      "key": "finance.expenses.edit",
      "area": "finance",
      "level": "full",
      "sensitive": false,
      "label": {
        "en": "Edit expenses",
        "ar": "تعديل المصاريف",
        "fr": "Edit expenses"
      }
    },
    {
      "key": "analytics.view",
      "area": "analytics",
      "level": "view",
      "sensitive": false,
      "label": {
        "en": "See sales figures",
        "ar": "عرض أرقام المبيعات",
        "fr": "See sales figures"
      }
    },
    {
      "key": "analytics.visitors.view",
      "area": "analytics",
      "level": "view",
      "sensitive": false,
      "label": {
        "en": "See visitor figures",
        "ar": "عرض أرقام الزوار",
        "fr": "See visitor figures"
      }
    },
    {
      "key": "team.members.invite",
      "area": "team",
      "level": "full",
      "sensitive": false,
      "label": {
        "en": "Invite members",
        "ar": "دعوة أعضاء",
        "fr": "Invite members"
      }
    },
    {
      "key": "team.members.view",
      "area": "team",
      "level": "view",
      "sensitive": false,
      "label": {
        "en": "See members",
        "ar": "عرض الأعضاء",
        "fr": "See members"
      }
    },
    {
      "key": "team.members.remove",
      "area": "team",
      "level": "full",
      "sensitive": true,
      "label": {
        "en": "Remove members",
        "ar": "إزالة الأعضاء",
        "fr": "Remove members"
      }
    },
    {
      "key": "team.members.edit",
      "area": "team",
      "level": "full",
      "sensitive": false,
      "label": {
        "en": "Change member access",
        "ar": "تغيير صلاحيات الأعضاء",
        "fr": "Change member access"
      }
    },
    {
      "key": "team.roles.create",
      "area": "team",
      "level": "full",
      "sensitive": false,
      "label": {
        "en": "Create roles",
        "ar": "إنشاء أدوار",
        "fr": "Create roles"
      }
    },
    {
      "key": "team.roles.view",
      "area": "team",
      "level": "view",
      "sensitive": false,
      "label": {
        "en": "See roles",
        "ar": "عرض الأدوار",
        "fr": "See roles"
      }
    },
    {
      "key": "team.roles.delete",
      "area": "team",
      "level": "full",
      "sensitive": true,
      "label": {
        "en": "Delete roles",
        "ar": "حذف الأدوار",
        "fr": "Delete roles"
      }
    },
    {
      "key": "team.roles.edit",
      "area": "team",
      "level": "full",
      "sensitive": false,
      "label": {
        "en": "Edit roles",
        "ar": "تعديل الأدوار",
        "fr": "Edit roles"
      }
    },
    {
      "key": "team.commissions.set",
      "area": "team",
      "level": "full",
      "sensitive": false,
      "label": {
        "en": "Set commission rates",
        "ar": "تحديد نسب العمولات",
        "fr": "Set commission rates"
      }
    },
    {
      "key": "team.commissions.view",
      "area": "team",
      "level": "view",
      "sensitive": false,
      "label": {
        "en": "See commission rates",
        "ar": "عرض نسب العمولات",
        "fr": "See commission rates"
      }
    },
    {
      "key": "team.commissions.delete",
      "area": "team",
      "level": "full",
      "sensitive": true,
      "label": {
        "en": "Delete commission rates",
        "ar": "حذف نسب العمولات",
        "fr": "Delete commission rates"
      }
    },
    {
      "key": "team.commissions.edit",
      "area": "team",
      "level": "full",
      "sensitive": false,
      "label": {
        "en": "Edit commission rates",
        "ar": "تعديل نسب العمولات",
        "fr": "Edit commission rates"
      }
    },
    {
      "key": "delivery.carriers.connect",
      "area": "delivery",
      "level": "full",
      "sensitive": false,
      "label": {
        "en": "Connect delivery companies",
        "ar": "ربط شركات التوصيل",
        "fr": "Connect delivery companies"
      }
    },
    {
      "key": "delivery.carriers.view",
      "area": "delivery",
      "level": "view",
      "sensitive": false,
      "label": {
        "en": "See delivery companies",
        "ar": "عرض شركات التوصيل",
        "fr": "See delivery companies"
      }
    },
    {
      "key": "delivery.carriers.delete",
      "area": "delivery",
      "level": "full",
      "sensitive": true,
      "label": {
        "en": "Remove delivery companies",
        "ar": "إزالة شركات التوصيل",
        "fr": "Remove delivery companies"
      }
    },
    {
      "key": "delivery.carriers.edit",
      "area": "delivery",
      "level": "full",
      "sensitive": false,
      "label": {
        "en": "Edit delivery companies",
        "ar": "تعديل شركات التوصيل",
        "fr": "Edit delivery companies"
      }
    },
    {
      "key": "delivery.pricing.create",
      "area": "delivery",
      "level": "full",
      "sensitive": false,
      "label": {
        "en": "Add delivery rates",
        "ar": "إضافة أسعار التوصيل",
        "fr": "Add delivery rates"
      }
    },
    {
      "key": "delivery.pricing.view",
      "area": "delivery",
      "level": "view",
      "sensitive": false,
      "label": {
        "en": "See delivery rates",
        "ar": "عرض أسعار التوصيل",
        "fr": "See delivery rates"
      }
    },
    {
      "key": "delivery.pricing.delete",
      "area": "delivery",
      "level": "full",
      "sensitive": true,
      "label": {
        "en": "Delete delivery rates",
        "ar": "حذف أسعار التوصيل",
        "fr": "Delete delivery rates"
      }
    },
    {
      "key": "delivery.pricing.edit",
      "area": "delivery",
      "level": "full",
      "sensitive": false,
      "label": {
        "en": "Edit delivery rates",
        "ar": "تعديل أسعار التوصيل",
        "fr": "Edit delivery rates"
      }
    },
    {
      "key": "store.stores.create",
      "area": "store",
      "level": "full",
      "sensitive": false,
      "label": {
        "en": "Open new stores",
        "ar": "فتح متاجر جديدة",
        "fr": "Open new stores"
      }
    },
    {
      "key": "store.stores.view",
      "area": "store",
      "level": "view",
      "sensitive": false,
      "label": {
        "en": "See stores",
        "ar": "عرض المتاجر",
        "fr": "See stores"
      }
    },
    {
      "key": "store.stores.archive",
      "area": "store",
      "level": "full",
      "sensitive": true,
      "label": {
        "en": "Archive stores",
        "ar": "أرشفة المتاجر",
        "fr": "Archive stores"
      }
    },
    {
      "key": "store.settings.edit",
      "area": "store",
      "level": "full",
      "sensitive": false,
      "label": {
        "en": "Edit store settings",
        "ar": "تعديل إعدادات المتجر",
        "fr": "Edit store settings"
      }
    },
    {
      "key": "store.builder.open",
      "area": "store",
      "level": "full",
      "sensitive": false,
      "label": {
        "en": "Open the store builder",
        "ar": "فتح أداة تصميم المتجر",
        "fr": "Open the store builder"
      }
    },
    {
      "key": "store.pages.edit",
      "area": "store",
      "level": "full",
      "sensitive": false,
      "label": {
        "en": "Edit store pages",
        "ar": "تعديل صفحات المتجر",
        "fr": "Edit store pages"
      }
    },
    {
      "key": "store.publish",
      "area": "store",
      "level": "full",
      "sensitive": true,
      "label": {
        "en": "Publish the store",
        "ar": "نشر المتجر",
        "fr": "Publish the store"
      }
    },
    {
      "key": "store.discard",
      "area": "store",
      "level": "full",
      "sensitive": true,
      "label": {
        "en": "Discard unpublished changes",
        "ar": "التخلي عن التغييرات غير المنشورة",
        "fr": "Discard unpublished changes"
      }
    },
    {
      "key": "store.landing-pages.create",
      "area": "store",
      "level": "full",
      "sensitive": false,
      "label": {
        "en": "Create landing pages",
        "ar": "إنشاء صفحات هبوط",
        "fr": "Create landing pages"
      }
    },
    {
      "key": "store.landing-pages.view",
      "area": "store",
      "level": "view",
      "sensitive": false,
      "label": {
        "en": "See landing pages",
        "ar": "عرض صفحات الهبوط",
        "fr": "See landing pages"
      }
    },
    {
      "key": "store.landing-pages.delete",
      "area": "store",
      "level": "full",
      "sensitive": true,
      "label": {
        "en": "Delete landing pages",
        "ar": "حذف صفحات الهبوط",
        "fr": "Delete landing pages"
      }
    },
    {
      "key": "store.landing-pages.edit",
      "area": "store",
      "level": "full",
      "sensitive": false,
      "label": {
        "en": "Edit landing pages",
        "ar": "تعديل صفحات الهبوط",
        "fr": "Edit landing pages"
      }
    },
    {
      "key": "store.domains.connect",
      "area": "store",
      "level": "full",
      "sensitive": false,
      "label": {
        "en": "Connect domains",
        "ar": "ربط النطاقات",
        "fr": "Connect domains"
      }
    },
    {
      "key": "store.domains.view",
      "area": "store",
      "level": "view",
      "sensitive": false,
      "label": {
        "en": "See domains",
        "ar": "عرض النطاقات",
        "fr": "See domains"
      }
    },
    {
      "key": "store.domains.remove",
      "area": "store",
      "level": "full",
      "sensitive": true,
      "label": {
        "en": "Remove domains",
        "ar": "إزالة النطاقات",
        "fr": "Remove domains"
      }
    },
    {
      "key": "store.domains.edit",
      "area": "store",
      "level": "full",
      "sensitive": false,
      "label": {
        "en": "Edit domains",
        "ar": "تعديل النطاقات",
        "fr": "Edit domains"
      }
    },
    {
      "key": "apps.view",
      "area": "apps",
      "level": "view",
      "sensitive": false,
      "label": {
        "en": "See apps",
        "ar": "عرض التطبيقات",
        "fr": "See apps"
      }
    },
    {
      "key": "apps.connect",
      "area": "apps",
      "level": "full",
      "sensitive": false,
      "label": {
        "en": "Connect apps",
        "ar": "ربط التطبيقات",
        "fr": "Connect apps"
      }
    },
    {
      "key": "apps.manage",
      "area": "apps",
      "level": "full",
      "sensitive": false,
      "label": {
        "en": "Manage connected apps",
        "ar": "إدارة التطبيقات المرتبطة",
        "fr": "Manage connected apps"
      }
    },
    {
      "key": "apps.disconnect",
      "area": "apps",
      "level": "full",
      "sensitive": true,
      "label": {
        "en": "Disconnect apps",
        "ar": "فصل التطبيقات",
        "fr": "Disconnect apps"
      }
    },
    {
      "key": "apps.whatsapp.view",
      "area": "apps",
      "level": "view",
      "sensitive": false,
      "label": {
        "en": "See messaging setup",
        "ar": "عرض إعداد المراسلة",
        "fr": "See messaging setup"
      }
    },
    {
      "key": "apps.whatsapp.manage",
      "area": "apps",
      "level": "full",
      "sensitive": false,
      "label": {
        "en": "Manage messaging",
        "ar": "إدارة المراسلة",
        "fr": "Manage messaging"
      }
    },
    {
      "key": "apps.cargo.request",
      "area": "apps",
      "level": "full",
      "sensitive": false,
      "label": {
        "en": "Request freight pickups",
        "ar": "طلب خدمة نقل البضائع",
        "fr": "Request freight pickups"
      }
    },
    {
      "key": "apps.cargo.view",
      "area": "apps",
      "level": "view",
      "sensitive": false,
      "label": {
        "en": "See freight requests",
        "ar": "عرض طلبات نقل البضائع",
        "fr": "See freight requests"
      }
    },
    {
      "key": "settings.business.view",
      "area": "settings",
      "level": "view",
      "sensitive": false,
      "label": {
        "en": "See business settings",
        "ar": "عرض إعدادات النشاط",
        "fr": "See business settings"
      }
    },
    {
      "key": "settings.business.edit",
      "area": "settings",
      "level": "full",
      "sensitive": true,
      "label": {
        "en": "Edit business settings",
        "ar": "تعديل إعدادات النشاط",
        "fr": "Edit business settings"
      }
    },
    {
      "key": "settings.activity-log.view",
      "area": "settings",
      "level": "view",
      "sensitive": false,
      "label": {
        "en": "See the activity log",
        "ar": "عرض سجل النشاط",
        "fr": "See the activity log"
      }
    }
  ]
}
```

