# Effective permissions

What the caller holds on the active store. The dashboard hides controls from this answer and enforces nothing.

### effectivePermissions, the owner

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query { effectivePermissions { storeId permissions storeAccess } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "effectivePermissions": {
      "storeId": "<STORE_DEMO>",
      "permissions": [
        "analytics.view",
        "analytics.visitors.view",
        "apps.cargo.request",
        "apps.cargo.view",
        "apps.connect",
        "apps.disconnect",
        "apps.manage",
        "apps.view",
        "apps.whatsapp.manage",
        "apps.whatsapp.view",
        "catalog.collections.create",
        "catalog.collections.delete",
        "catalog.collections.edit",
        "catalog.collections.view",
        "catalog.products.create",
        "catalog.products.delete",
        "catalog.products.edit",
        "catalog.products.view",
        "delivery.carriers.connect",
        "delivery.carriers.delete",
        "delivery.carriers.edit",
        "delivery.carriers.view",
        "delivery.pricing.create",
        "delivery.pricing.delete",
        "delivery.pricing.edit",
        "delivery.pricing.view",
        "finance.expenses.add",
        "finance.expenses.delete",
        "finance.expenses.edit",
        "finance.expenses.view",
        "finance.records.add",
        "finance.records.delete",
        "finance.records.view",
        "inventory.buy-prices",
        "inventory.stock.add",
        "inventory.stock.adjust",
        "inventory.stock.view",
        "offers.create",
        "offers.delete",
        "offers.edit",
        "offers.view",
        "orders.cancel",
        "orders.comment",
        "orders.comments.delete",
        "orders.confirm",
        "orders.create",
        "orders.customers.manage",
        "orders.customers.view",
        "orders.delete",
        "orders.discount",
        "orders.dispatch",
        "orders.edit",
        "orders.mark-delivered",
        "orders.print-labels",
        "orders.returns.create",
        "orders.returns.process",
        "orders.returns.view",
        "orders.schedule",
        "orders.view",
        "orders.view-all",
        "settings.activity-log.view",
        "settings.business.edit",
        "settings.business.view",
        "store.builder.open",
        "store.discard",
        "store.domains.connect",
        "store.domains.edit",
        "store.domains.remove",
        "store.domains.view",
        "store.landing-pages.create",
        "store.landing-pages.delete",
        "store.landing-pages.edit",
        "store.landing-pages.view",
        "store.pages.edit",
        "store.publish",
        "store.settings.edit",
        "store.stores.create",
        "store.stores.view",
        "team.commissions.delete",
        "team.commissions.edit",
        "team.commissions.set",
        "team.commissions.view",
        "team.members.edit",
        "team.members.invite",
        "team.members.remove",
        "team.members.view",
        "team.roles.create",
        "team.roles.delete",
        "team.roles.edit",
        "team.roles.view",
        "tracking.update",
        "tracking.view",
        "tracking.view-all"
      ],
      "storeAccess": "all"
    }
  }
}
```

### effectivePermissions, a limited member on a selected store

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query { effectivePermissions { storeId permissions storeAccess } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "effectivePermissions": {
      "storeId": "<STORE_DEMO>",
      "permissions": [
        "settings.activity-log.view",
        "team.roles.view"
      ],
      "storeAccess": "selected"
    }
  }
}
```

### GET /permissions

```http
GET http://127.0.0.1:23100/permissions
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "storeId": "<STORE_DEMO>",
  "permissions": [
    "settings.activity-log.view",
    "team.roles.view"
  ],
  "storeAccess": "selected"
}
```

