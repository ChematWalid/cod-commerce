# Isolation: role

Live transcripts from `scripts/evidence/P1-isolation.sh`. Ids and store tokens are placeholders; sessions are named, never shown.

### role.list (A attacks B)

A's owner lists business roles: A's roles only. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


query { businessRoles { id name description builtInKey permissions memberCount } }

variables: {}
```

**HTTP 200**

```json
{
  "data": {
    "businessRoles": [
      {
        "id": "246894948035596292",
        "name": "Accountant",
        "description": "Can keep the books and read every order, without changing orders.",
        "builtInKey": "accountant",
        "permissions": [
          "finance.expenses.add",
          "finance.expenses.delete",
          "finance.expenses.edit",
          "finance.expenses.view",
          "finance.records.add",
          "finance.records.delete",
          "finance.records.view",
          "orders.customers.view",
          "orders.returns.view",
          "orders.view",
          "orders.view-all"
        ],
        "memberCount": 0
      },
      {
        "id": "246894948035596291",
        "name": "Inventory manager",
        "description": "Can keep products, collections and stock up to date, including purchase prices.",
        "builtInKey": "inventory-manager",
        "permissions": [
          "catalog.collections.create",
          "catalog.collections.delete",
          "catalog.collections.edit",
          "catalog.collections.view",
          "catalog.products.create",
          "catalog.products.delete",
          "catalog.products.edit",
          "catalog.products.view",
          "inventory.buy-prices",
          "inventory.stock.add",
          "inventory.stock.adjust",
          "inventory.stock.view"
        ],
        "memberCount": 0
      },
      {
        "id": "246894948035596289",
        "name": "Manager",
        "description": "Can do everything except delete records, remove members or change business settings.",
        "builtInKey": "manager",
        "permissions": [
          "analytics.view",
          "analytics.visitors.view",
          "apps.cargo.request",
          "apps.cargo.view",
          "apps.connect",
          "apps.manage",
          "apps.view",
          "apps.whatsapp.manage",
          "apps.whatsapp.view",
          "catalog.collections.create",
          "catalog.collections.edit",
          "catalog.collections.view",
          "catalog.products.create",
          "catalog.products.edit",
          "catalog.products.view",
          "delivery.carriers.connect",
          "delivery.carriers.edit",
          "delivery.carriers.view",
          "delivery.pricing.create",
          "delivery.pricing.edit",
          "delivery.pricing.view",
          "finance.expenses.add",
          "finance.expenses.edit",
          "finance.expenses.view",
          "finance.records.add",
          "finance.records.view",
          "inventory.buy-prices",
          "inventory.stock.add",
          "inventory.stock.adjust",
          "inventory.stock.view",
          "offers.create",
          "offers.edit",
          "offers.view",
          "orders.cancel",
          "orders.comment",
          "orders.confirm",
          "orders.create",
          "orders.customers.manage",
          "orders.customers.view",
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
          "settings.business.view",
          "store.builder.open",
          "store.discard",
          "store.domains.connect",
          "store.domains.edit",
          "store.domains.view",
          "store.landing-pages.create",
          "store.landing-pages.edit",
          "store.landing-pages.view",
          "store.pages.edit",
          "store.publish",
          "store.settings.edit",
          "store.stores.create",
          "store.stores.view",
          "team.commissions.edit",
          "team.commissions.set",
          "team.commissions.view",
          "team.members.edit",
          "team.members.invite",
          "team.members.view",
          "team.roles.create",
          "team.roles.edit",
          "team.roles.view",
          "tracking.update",
          "tracking.view",
          "tracking.view-all"
        ],
        "memberCount": 0
      },
      {
        "id": "246894948035596290",
        "name": "Order manager",
        "description": "Can handle orders from creation to delivery, returns and buyers, and nothing else.",
        "builtInKey": "order-manager",
        "permissions": [
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
          "orders.view-all"
        ],
        "memberCount": 0
      },
      {
        "id": "246894948035596293",
        "name": "Order tracker",
        "description": "Can follow shipments and update their status, and nothing else.",
        "builtInKey": "order-tracker",
        "permissions": [
          "tracking.update",
          "tracking.view",
          "tracking.view-all"
        ],
        "memberCount": 0
      },
      {
        "id": "246894948035596288",
        "name": "Owner",
        "description": "Can do everything in the business, including deleting records and changing settings.",
        "builtInKey": "owner",
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
          "store.stores.archive",
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
        "memberCount": 1
      },
      {
        "id": "<ROLE_A>",
        "name": "Role A b8b7305f",
        "description": null,
        "builtInKey": null,
        "permissions": [
          "orders.customers.view",
          "orders.returns.view",
          "orders.view"
        ],
        "memberCount": 1
      },
      {
        "id": "246894948035596294",
        "name": "Store manager",
        "description": "Can run the storefront, its pages and domains, and maintain products and collections.",
        "builtInKey": "store-manager",
        "permissions": [
          "catalog.collections.create",
          "catalog.collections.delete",
          "catalog.collections.edit",
          "catalog.collections.view",
          "catalog.products.create",
          "catalog.products.delete",
          "catalog.products.edit",
          "catalog.products.view",
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
          "store.stores.view"
        ],
        "memberCount": 0
      }
    ]
  }
}
```

### role.list (B attacks A)

A's owner lists business roles: A's roles only. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner B]
vendure-token: <TOKEN_B1>


query { businessRoles { id name description builtInKey permissions memberCount } }

variables: {}
```

**HTTP 200**

```json
{
  "data": {
    "businessRoles": [
      {
        "id": "246894962203955204",
        "name": "Accountant",
        "description": "Can keep the books and read every order, without changing orders.",
        "builtInKey": "accountant",
        "permissions": [
          "finance.expenses.add",
          "finance.expenses.delete",
          "finance.expenses.edit",
          "finance.expenses.view",
          "finance.records.add",
          "finance.records.delete",
          "finance.records.view",
          "orders.customers.view",
          "orders.returns.view",
          "orders.view",
          "orders.view-all"
        ],
        "memberCount": 0
      },
      {
        "id": "246894962203955203",
        "name": "Inventory manager",
        "description": "Can keep products, collections and stock up to date, including purchase prices.",
        "builtInKey": "inventory-manager",
        "permissions": [
          "catalog.collections.create",
          "catalog.collections.delete",
          "catalog.collections.edit",
          "catalog.collections.view",
          "catalog.products.create",
          "catalog.products.delete",
          "catalog.products.edit",
          "catalog.products.view",
          "inventory.buy-prices",
          "inventory.stock.add",
          "inventory.stock.adjust",
          "inventory.stock.view"
        ],
        "memberCount": 0
      },
      {
        "id": "246894962203955201",
        "name": "Manager",
        "description": "Can do everything except delete records, remove members or change business settings.",
        "builtInKey": "manager",
        "permissions": [
          "analytics.view",
          "analytics.visitors.view",
          "apps.cargo.request",
          "apps.cargo.view",
          "apps.connect",
          "apps.manage",
          "apps.view",
          "apps.whatsapp.manage",
          "apps.whatsapp.view",
          "catalog.collections.create",
          "catalog.collections.edit",
          "catalog.collections.view",
          "catalog.products.create",
          "catalog.products.edit",
          "catalog.products.view",
          "delivery.carriers.connect",
          "delivery.carriers.edit",
          "delivery.carriers.view",
          "delivery.pricing.create",
          "delivery.pricing.edit",
          "delivery.pricing.view",
          "finance.expenses.add",
          "finance.expenses.edit",
          "finance.expenses.view",
          "finance.records.add",
          "finance.records.view",
          "inventory.buy-prices",
          "inventory.stock.add",
          "inventory.stock.adjust",
          "inventory.stock.view",
          "offers.create",
          "offers.edit",
          "offers.view",
          "orders.cancel",
          "orders.comment",
          "orders.confirm",
          "orders.create",
          "orders.customers.manage",
          "orders.customers.view",
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
          "settings.business.view",
          "store.builder.open",
          "store.discard",
          "store.domains.connect",
          "store.domains.edit",
          "store.domains.view",
          "store.landing-pages.create",
          "store.landing-pages.edit",
          "store.landing-pages.view",
          "store.pages.edit",
          "store.publish",
          "store.settings.edit",
          "store.stores.create",
          "store.stores.view",
          "team.commissions.edit",
          "team.commissions.set",
          "team.commissions.view",
          "team.members.edit",
          "team.members.invite",
          "team.members.view",
          "team.roles.create",
          "team.roles.edit",
          "team.roles.view",
          "tracking.update",
          "tracking.view",
          "tracking.view-all"
        ],
        "memberCount": 0
      },
      {
        "id": "246894962203955202",
        "name": "Order manager",
        "description": "Can handle orders from creation to delivery, returns and buyers, and nothing else.",
        "builtInKey": "order-manager",
        "permissions": [
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
          "orders.view-all"
        ],
        "memberCount": 0
      },
      {
        "id": "246894962203955205",
        "name": "Order tracker",
        "description": "Can follow shipments and update their status, and nothing else.",
        "builtInKey": "order-tracker",
        "permissions": [
          "tracking.update",
          "tracking.view",
          "tracking.view-all"
        ],
        "memberCount": 0
      },
      {
        "id": "246894962203955200",
        "name": "Owner",
        "description": "Can do everything in the business, including deleting records and changing settings.",
        "builtInKey": "owner",
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
          "store.stores.archive",
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
        "memberCount": 1
      },
      {
        "id": "<ROLE_B>",
        "name": "Role B b8b7305f",
        "description": null,
        "builtInKey": null,
        "permissions": [
          "orders.customers.view",
          "orders.returns.view",
          "orders.view"
        ],
        "memberCount": 1
      },
      {
        "id": "246894962203955206",
        "name": "Store manager",
        "description": "Can run the storefront, its pages and domains, and maintain products and collections.",
        "builtInKey": "store-manager",
        "permissions": [
          "catalog.collections.create",
          "catalog.collections.delete",
          "catalog.collections.edit",
          "catalog.collections.view",
          "catalog.products.create",
          "catalog.products.delete",
          "catalog.products.edit",
          "catalog.products.view",
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
          "store.stores.view"
        ],
        "memberCount": 0
      }
    ]
  }
}
```

### role.by-id (A attacks B)

A's owner asks for B's role by id: null. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


query ($id: String!) { businessRole(id: $id) { id name description builtInKey permissions memberCount } }

variables: {
  "id": "<ROLE_B>"
}
```

**HTTP 200**

```json
{
  "data": {
    "businessRole": null
  }
}
```

### role.by-id (B attacks A)

A's owner asks for B's role by id: null. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner B]
vendure-token: <TOKEN_B1>


query ($id: String!) { businessRole(id: $id) { id name description builtInKey permissions memberCount } }

variables: {
  "id": "<ROLE_A>"
}
```

**HTTP 200**

```json
{
  "data": {
    "businessRole": null
  }
}
```

### role.create-from-victim (A attacks B)

A's owner creates a role starting from B's role: rbac.role-not-found. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($input: CreateBusinessRoleInput!) { createBusinessRole(input: $input) { id } }

variables: {
  "input": {
    "name": "Copied over",
    "startFromRoleId": "<ROLE_B>"
  }
}
```

**HTTP 200**

```json
{
  "errors": [
    {
      "message": "Role not found.",
      "locations": [
        {
          "line": 1,
          "column": 47
        }
      ],
      "path": [
        "createBusinessRole"
      ],
      "extensions": {
        "code": "rbac.role-not-found"
      }
    }
  ],
  "data": null
}
```

### role.duplicate (A attacks B)

A's owner duplicates B's role: rbac.role-not-found. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($id: String!) { duplicateBusinessRole(id: $id, locale: "en") { id name } }

variables: {
  "id": "<ROLE_B>"
}
```

**HTTP 200**

```json
{
  "errors": [
    {
      "message": "Role not found.",
      "locations": [
        {
          "line": 1,
          "column": 27
        }
      ],
      "path": [
        "duplicateBusinessRole"
      ],
      "extensions": {
        "code": "rbac.role-not-found"
      }
    }
  ],
  "data": null
}
```

### role.update (A attacks B)

A's owner renames B's role: rbac.role-not-found, B's role unchanged. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($id: String!, $input: UpdateBusinessRoleInput!) { updateBusinessRole(id: $id, input: $input) { id } }

variables: {
  "id": "<ROLE_B>",
  "input": {
    "name": "Taken over"
  }
}
```

**HTTP 200**

```json
{
  "errors": [
    {
      "message": "Role not found.",
      "locations": [
        {
          "line": 1,
          "column": 61
        }
      ],
      "path": [
        "updateBusinessRole"
      ],
      "extensions": {
        "code": "rbac.role-not-found"
      }
    }
  ],
  "data": null
}
```

### role.update (B attacks A)

A's owner renames B's role: rbac.role-not-found, B's role unchanged. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner B]
vendure-token: <TOKEN_B1>


mutation ($id: String!, $input: UpdateBusinessRoleInput!) { updateBusinessRole(id: $id, input: $input) { id } }

variables: {
  "id": "<ROLE_A>",
  "input": {
    "name": "Taken over"
  }
}
```

**HTTP 200**

```json
{
  "errors": [
    {
      "message": "Role not found.",
      "locations": [
        {
          "line": 1,
          "column": 61
        }
      ],
      "path": [
        "updateBusinessRole"
      ],
      "extensions": {
        "code": "rbac.role-not-found"
      }
    }
  ],
  "data": null
}
```

### role.delete (A attacks B)

A's owner deletes B's role: rbac.role-not-found, B's role still there. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($id: String!) { deleteBusinessRole(id: $id) { success } }

variables: {
  "id": "<ROLE_B>"
}
```

**HTTP 200**

```json
{
  "errors": [
    {
      "message": "Role not found.",
      "locations": [
        {
          "line": 1,
          "column": 27
        }
      ],
      "path": [
        "deleteBusinessRole"
      ],
      "extensions": {
        "code": "rbac.role-not-found"
      }
    }
  ],
  "data": null
}
```

### role.victim-channel (A attacks B)

A's owner lists business roles with B's store token: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_B1>


query { businessRoles { id name description builtInKey permissions memberCount } }

variables: {}
```

**HTTP 200**

```json
{
  "errors": [
    {
      "message": "You are not currently authorized to perform this action",
      "locations": [
        {
          "line": 1,
          "column": 9
        }
      ],
      "path": [
        "businessRoles"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### role.victim-channel (B attacks A)

A's owner lists business roles with B's store token: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner B]
vendure-token: <TOKEN_A1>


query { businessRoles { id name description builtInKey permissions memberCount } }

variables: {}
```

**HTTP 200**

```json
{
  "errors": [
    {
      "message": "You are not currently authorized to perform this action",
      "locations": [
        {
          "line": 1,
          "column": 9
        }
      ],
      "path": [
        "businessRoles"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### role.rest-list (A attacks B)

A's owner lists roles over REST: A's roles only. **Pass.**

```http
GET /roles
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>

```

**HTTP 200**

```json
[
  {
    "id": "246894948035596292",
    "name": "Accountant",
    "description": "Can keep the books and read every order, without changing orders.",
    "builtInKey": "accountant",
    "isBuiltIn": true,
    "permissions": [
      "finance.expenses.add",
      "finance.expenses.delete",
      "finance.expenses.edit",
      "finance.expenses.view",
      "finance.records.add",
      "finance.records.delete",
      "finance.records.view",
      "orders.customers.view",
      "orders.returns.view",
      "orders.view",
      "orders.view-all"
    ],
    "areaLevels": [
      {
        "area": "orders",
        "level": "custom"
      },
      {
        "area": "tracking",
        "level": "none"
      },
      {
        "area": "catalog",
        "level": "none"
      },
      {
        "area": "offers",
        "level": "none"
      },
      {
        "area": "inventory",
        "level": "none"
      },
      {
        "area": "finance",
        "level": "full"
      },
      {
        "area": "analytics",
        "level": "none"
      },
      {
        "area": "team",
        "level": "none"
      },
      {
        "area": "delivery",
        "level": "none"
      },
      {
        "area": "store",
        "level": "none"
      },
      {
        "area": "apps",
        "level": "none"
      },
      {
        "area": "settings",
        "level": "none"
      }
    ],
    "permissionCount": 11,
    "memberCount": 0,
    "updatedAt": "2026-11-13T07:12:22.698Z"
  },
  {
    "id": "246894948035596291",
    "name": "Inventory manager",
    "description": "Can keep products, collections and stock up to date, including purchase prices.",
    "builtInKey": "inventory-manager",
    "isBuiltIn": true,
    "permissions": [
      "catalog.collections.create",
      "catalog.collections.delete",
      "catalog.collections.edit",
      "catalog.collections.view",
      "catalog.products.create",
      "catalog.products.delete",
      "catalog.products.edit",
      "catalog.products.view",
      "inventory.buy-prices",
      "inventory.stock.add",
      "inventory.stock.adjust",
      "inventory.stock.view"
    ],
    "areaLevels": [
      {
        "area": "orders",
        "level": "none"
      },
      {
        "area": "tracking",
        "level": "none"
      },
      {
        "area": "catalog",
        "level": "full"
      },
      {
        "area": "offers",
        "level": "none"
      },
      {
        "area": "inventory",
        "level": "full"
      },
      {
        "area": "finance",
        "level": "none"
      },
      {
        "area": "analytics",
        "level": "none"
      },
      {
        "area": "team",
        "level": "none"
      },
      {
        "area": "delivery",
        "level": "none"
      },
      {
        "area": "store",
        "level": "none"
      },
      {
        "area": "apps",
        "level": "none"
      },
      {
        "area": "settings",
        "level": "none"
      }
    ],
    "permissionCount": 12,
    "memberCount": 0,
    "updatedAt": "2026-11-13T07:12:22.698Z"
  },
  {
    "id": "246894948035596289",
    "name": "Manager",
    "description": "Can do everything except delete records, remove members or change business settings.",
    "builtInKey": "manager",
    "isBuiltIn": true,
    "permissions": [
      "analytics.view",
      "analytics.visitors.view",
      "apps.cargo.request",
      "apps.cargo.view",
      "apps.connect",
      "apps.manage",
      "apps.view",
      "apps.whatsapp.manage",
      "apps.whatsapp.view",
      "catalog.collections.create",
      "catalog.collections.edit",
      "catalog.collections.view",
      "catalog.products.create",
      "catalog.products.edit",
      "catalog.products.view",
      "delivery.carriers.connect",
      "delivery.carriers.edit",
      "delivery.carriers.view",
      "delivery.pricing.create",
      "delivery.pricing.edit",
      "delivery.pricing.view",
      "finance.expenses.add",
      "finance.expenses.edit",
      "finance.expenses.view",
      "finance.records.add",
      "finance.records.view",
      "inventory.buy-prices",
      "inventory.stock.add",
      "inventory.stock.adjust",
      "inventory.stock.view",
      "offers.create",
      "offers.edit",
      "offers.view",
      "orders.cancel",
      "orders.comment",
      "orders.confirm",
      "orders.create",
      "orders.customers.manage",
      "orders.customers.view",
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
      "settings.business.view",
      "store.builder.open",
      "store.discard",
      "store.domains.connect",
      "store.domains.edit",
      "store.domains.view",
      "store.landing-pages.create",
      "store.landing-pages.edit",
      "store.landing-pages.view",
      "store.pages.edit",
      "store.publish",
      "store.settings.edit",
      "store.stores.create",
      "store.stores.view",
      "team.commissions.edit",
      "team.commissions.set",
      "team.commissions.view",
      "team.members.edit",
      "team.members.invite",
      "team.members.view",
      "team.roles.create",
      "team.roles.edit",
      "team.roles.view",
      "tracking.update",
      "tracking.view",
      "tracking.view-all"
    ],
    "areaLevels": [
      {
        "area": "orders",
        "level": "custom"
      },
      {
        "area": "tracking",
        "level": "full"
      },
      {
        "area": "catalog",
        "level": "custom"
      },
      {
        "area": "offers",
        "level": "custom"
      },
      {
        "area": "inventory",
        "level": "full"
      },
      {
        "area": "finance",
        "level": "custom"
      },
      {
        "area": "analytics",
        "level": "full"
      },
      {
        "area": "team",
        "level": "custom"
      },
      {
        "area": "delivery",
        "level": "custom"
      },
      {
        "area": "store",
        "level": "custom"
      },
      {
        "area": "apps",
        "level": "custom"
      },
      {
        "area": "settings",
        "level": "view"
      }
    ],
    "permissionCount": 77,
    "memberCount": 0,
    "updatedAt": "2026-11-13T07:12:22.698Z"
  },
  {
    "id": "246894948035596290",
    "name": "Order manager",
    "description": "Can handle orders from creation to delivery, returns and buyers, and nothing else.",
    "builtInKey": "order-manager",
    "isBuiltIn": true,
    "permissions": [
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
      "orders.view-all"
    ],
    "areaLevels": [
      {
        "area": "orders",
        "level": "full"
      },
      {
        "area": "tracking",
        "level": "none"
      },
      {
        "area": "catalog",
        "level": "none"
      },
      {
        "area": "offers",
        "level": "none"
      },
      {
        "area": "inventory",
        "level": "none"
      },
      {
        "area": "finance",
        "level": "none"
      },
      {
        "area": "analytics",
        "level": "none"
      },
      {
        "area": "team",
        "level": "none"
      },
      {
        "area": "delivery",
        "level": "none"
      },
      {
        "area": "store",
        "level": "none"
      },
      {
        "area": "apps",
        "level": "none"
      },
      {
        "area": "settings",
        "level": "none"
      }
    ],
    "permissionCount": 19,
    "memberCount": 0,
    "updatedAt": "2026-11-13T07:12:22.698Z"
  },
  {
    "id": "246894948035596293",
    "name": "Order tracker",
    "description": "Can follow shipments and update their status, and nothing else.",
    "builtInKey": "order-tracker",
    "isBuiltIn": true,
    "permissions": [
      "tracking.update",
      "tracking.view",
      "tracking.view-all"
    ],
    "areaLevels": [
      {
        "area": "orders",
        "level": "none"
      },
      {
        "area": "tracking",
        "level": "full"
      },
      {
        "area": "catalog",
        "level": "none"
      },
      {
        "area": "offers",
        "level": "none"
      },
      {
        "area": "inventory",
        "level": "none"
      },
      {
        "area": "finance",
        "level": "none"
      },
      {
        "area": "analytics",
        "level": "none"
      },
      {
        "area": "team",
        "level": "none"
      },
      {
        "area": "delivery",
        "level": "none"
      },
      {
        "area": "store",
        "level": "none"
      },
      {
        "area": "apps",
        "level": "none"
      },
      {
        "area": "settings",
        "level": "none"
      }
    ],
    "permissionCount": 3,
    "memberCount": 0,
    "updatedAt": "2026-11-13T07:12:22.698Z"
  },
  {
    "id": "246894948035596288",
    "name": "Owner",
    "description": "Can do everything in the business, including deleting records and changing settings.",
    "builtInKey": "owner",
    "isBuiltIn": true,
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
      "store.stores.archive",
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
    "areaLevels": [
      {
        "area": "orders",
        "level": "full"
      },
      {
        "area": "tracking",
        "level": "full"
      },
      {
        "area": "catalog",
        "level": "full"
      },
      {
        "area": "offers",
        "level": "full"
      },
      {
        "area": "inventory",
        "level": "full"
      },
      {
        "area": "finance",
        "level": "full"
      },
      {
        "area": "analytics",
        "level": "full"
      },
      {
        "area": "team",
        "level": "full"
      },
      {
        "area": "delivery",
        "level": "full"
      },
      {
        "area": "store",
        "level": "full"
      },
      {
        "area": "apps",
        "level": "full"
      },
      {
        "area": "settings",
        "level": "full"
      }
    ],
    "permissionCount": 94,
    "memberCount": 1,
    "updatedAt": "2026-11-13T07:12:22.698Z"
  },
  {
    "id": "<ROLE_A>",
    "name": "Role A b8b7305f",
    "description": null,
    "builtInKey": null,
    "isBuiltIn": false,
    "permissions": [
      "orders.customers.view",
      "orders.returns.view",
      "orders.view"
    ],
    "areaLevels": [
      {
        "area": "orders",
        "level": "view"
      },
      {
        "area": "tracking",
        "level": "none"
      },
      {
        "area": "catalog",
        "level": "none"
      },
      {
        "area": "offers",
        "level": "none"
      },
      {
        "area": "inventory",
        "level": "none"
      },
      {
        "area": "finance",
        "level": "none"
      },
      {
        "area": "analytics",
        "level": "none"
      },
      {
        "area": "team",
        "level": "none"
      },
      {
        "area": "delivery",
        "level": "none"
      },
      {
        "area": "store",
        "level": "none"
      },
      {
        "area": "apps",
        "level": "none"
      },
      {
        "area": "settings",
        "level": "none"
      }
    ],
    "permissionCount": 3,
    "memberCount": 1,
    "updatedAt": "2026-11-13T07:12:24.701Z"
  },
  {
    "id": "246894948035596294",
    "name": "Store manager",
    "description": "Can run the storefront, its pages and domains, and maintain products and collections.",
    "builtInKey": "store-manager",
    "isBuiltIn": true,
    "permissions": [
      "catalog.collections.create",
      "catalog.collections.delete",
      "catalog.collections.edit",
      "catalog.collections.view",
      "catalog.products.create",
      "catalog.products.delete",
      "catalog.products.edit",
      "catalog.products.view",
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
      "store.stores.view"
    ],
    "areaLevels": [
      {
        "area": "orders",
        "level": "none"
      },
      {
        "area": "tracking",
        "level": "none"
      },
      {
        "area": "catalog",
        "level": "full"
      },
      {
        "area": "offers",
        "level": "none"
      },
      {
        "area": "inventory",
        "level": "none"
      },
      {
        "area": "finance",
        "level": "none"
      },
      {
        "area": "analytics",
        "level": "none"
      },
      {
        "area": "team",
        "level": "none"
      },
      {
        "area": "delivery",
        "level": "none"
      },
      {
        "area": "store",
        "level": "custom"
      },
      {
        "area": "apps",
        "level": "none"
      },
      {
        "area": "settings",
        "level": "none"
      }
    ],
    "permissionCount": 23,
    "memberCount": 0,
    "updatedAt": "2026-11-13T07:12:22.698Z"
  }
]
```

### role.rest-by-id (A attacks B)

A's owner reads B's role over REST: 404 rbac.role-not-found. **Pass.**

```http
GET /roles/<ROLE_B>
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>

```

**HTTP 404**

```json
{
  "statusCode": 404,
  "code": "rbac.role-not-found",
  "message": "Role not found",
  "path": "/roles/<ROLE_B>"
}
```

### role.rest-create-from-victim (A attacks B)

A's owner creates a role from B's role over REST: 404 rbac.role-not-found. **Pass.**

```http
POST /roles
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


{
  "name": "Copied over REST",
  "startFromRoleId": "<ROLE_B>"
}
```

**HTTP 404**

```json
{
  "statusCode": 404,
  "code": "rbac.role-not-found",
  "message": "Role not found",
  "path": "/roles"
}
```

### role.rest-update (A attacks B)

A's owner renames B's role over REST: 404 rbac.role-not-found. **Pass.**

```http
PATCH /roles/<ROLE_B>
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


{
  "name": "Taken over"
}
```

**HTTP 404**

```json
{
  "statusCode": 404,
  "code": "rbac.role-not-found",
  "message": "Role not found",
  "path": "/roles/<ROLE_B>"
}
```

### role.rest-delete (A attacks B)

A's owner deletes B's role over REST: 404 rbac.role-not-found. **Pass.**

```http
DELETE /roles/<ROLE_B>
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>

```

**HTTP 404**

```json
{
  "statusCode": 404,
  "code": "rbac.role-not-found",
  "message": "Role not found",
  "path": "/roles/<ROLE_B>"
}
```

### role.rest-duplicate (A attacks B)

A's owner duplicates B's role over REST: 404 rbac.role-not-found. **Pass.**

```http
POST /roles/<ROLE_B>/duplicate
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


{
  "locale": "en"
}
```

**HTTP 404**

```json
{
  "statusCode": 404,
  "code": "rbac.role-not-found",
  "message": "Role not found",
  "path": "/roles/<ROLE_B>/duplicate"
}
```

### role.rest-victim-channel (A attacks B)

A's owner lists roles over REST with B's store token: 403. **Pass.**

```http
GET /roles
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_B1>

```

**HTTP 403**

```json
{
  "statusCode": 403,
  "message": "FORBIDDEN: error.forbidden",
  "timestamp": "2026-11-13T07:12:37.229Z",
  "path": "/roles"
}
```
