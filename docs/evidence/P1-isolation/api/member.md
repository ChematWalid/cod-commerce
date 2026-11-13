# Isolation: member

Live transcripts from `scripts/evidence/P1-isolation.sh`. Ids and store tokens are placeholders; sessions are named, never shown.

### member.own-access (A attacks B)

A's owner reads A's member access: A's role on A1 only. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


query ($id: String!) { memberAccess(administratorId: $id) { administratorId roles { id name } storeAccess storeIds } }

variables: {
  "id": "<ADMIN_A_MEMBER>"
}
```

**HTTP 200**

```json
{
  "data": {
    "memberAccess": {
      "administratorId": "<ADMIN_A_MEMBER>",
      "roles": [
        {
          "id": "<ROLE_A>",
          "name": "Role A b8b7305f"
        }
      ],
      "storeAccess": "selected",
      "storeIds": [
        "<STORE_A1>"
      ]
    }
  }
}
```

### member.by-id (A attacks B)

A's owner reads B's member access: null. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


query ($id: String!) { memberAccess(administratorId: $id) { administratorId roles { id name } storeAccess storeIds } }

variables: {
  "id": "<ADMIN_B_MEMBER>"
}
```

**HTTP 200**

```json
{
  "data": {
    "memberAccess": null
  }
}
```

### member.by-id (B attacks A)

A's owner reads B's member access: null. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner B]
vendure-token: <TOKEN_B1>


query ($id: String!) { memberAccess(administratorId: $id) { administratorId roles { id name } storeAccess storeIds } }

variables: {
  "id": "<ADMIN_A_MEMBER>"
}
```

**HTTP 200**

```json
{
  "data": {
    "memberAccess": null
  }
}
```

### member.owner-by-id (A attacks B)

A's owner reads B's owner access: null. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


query ($id: String!) { memberAccess(administratorId: $id) { administratorId roles { id name } storeAccess storeIds } }

variables: {
  "id": "<ADMIN_B_OWNER>"
}
```

**HTTP 200**

```json
{
  "data": {
    "memberAccess": null
  }
}
```

### member.set-victim-member (A attacks B)

A's owner gives B's member an A role: rbac.member-not-found, B's member unchanged. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($input: SetMemberAccessInput!) { setMemberAccess(input: $input) { administratorId roles { id name } storeAccess storeIds } }

variables: {
  "input": {
    "administratorId": "<ADMIN_B_MEMBER>",
    "roleIds": [
      "<ROLE_A>"
    ],
    "storeAccess": "all"
  }
}
```

**HTTP 200**

```json
{
  "errors": [
    {
      "message": "Member not found.",
      "locations": [
        {
          "line": 1,
          "column": 44
        }
      ],
      "path": [
        "setMemberAccess"
      ],
      "extensions": {
        "code": "rbac.member-not-found"
      }
    }
  ],
  "data": null
}
```

### member.set-victim-owner (A attacks B)

A's owner gives B's owner an A role: rbac.member-not-found, B's owner unchanged. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($input: SetMemberAccessInput!) { setMemberAccess(input: $input) { administratorId roles { id name } storeAccess storeIds } }

variables: {
  "input": {
    "administratorId": "<ADMIN_B_OWNER>",
    "roleIds": [
      "<ROLE_A>"
    ],
    "storeAccess": "all"
  }
}
```

**HTTP 200**

```json
{
  "errors": [
    {
      "message": "Member not found.",
      "locations": [
        {
          "line": 1,
          "column": 44
        }
      ],
      "path": [
        "setMemberAccess"
      ],
      "extensions": {
        "code": "rbac.member-not-found"
      }
    }
  ],
  "data": null
}
```

### member.set-victim-role (A attacks B)

A's owner gives A's member B's role: rbac.role-not-found. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($input: SetMemberAccessInput!) { setMemberAccess(input: $input) { administratorId roles { id name } storeAccess storeIds } }

variables: {
  "input": {
    "administratorId": "<ADMIN_A_MEMBER>",
    "roleIds": [
      "<ROLE_B>"
    ],
    "storeAccess": "selected",
    "storeIds": [
      "<STORE_A1>"
    ]
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
          "column": 44
        }
      ],
      "path": [
        "setMemberAccess"
      ],
      "extensions": {
        "code": "rbac.role-not-found"
      }
    }
  ],
  "data": null
}
```

### member.set-victim-store (A attacks B)

A's owner gives A's member B's store: rbac.store-not-accessible. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($input: SetMemberAccessInput!) { setMemberAccess(input: $input) { administratorId roles { id name } storeAccess storeIds } }

variables: {
  "input": {
    "administratorId": "<ADMIN_A_MEMBER>",
    "roleIds": [
      "<ROLE_A>"
    ],
    "storeAccess": "selected",
    "storeIds": [
      "<STORE_B1>"
    ]
  }
}
```

**HTTP 200**

```json
{
  "errors": [
    {
      "message": "That store is not accessible.",
      "locations": [
        {
          "line": 1,
          "column": 44
        }
      ],
      "path": [
        "setMemberAccess"
      ],
      "extensions": {
        "code": "rbac.store-not-accessible"
      }
    }
  ],
  "data": null
}
```

### member.victim-channel (A attacks B)

A's owner reads A's member access with B's store token: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_B1>


query ($id: String!) { memberAccess(administratorId: $id) { administratorId roles { id name } storeAccess storeIds } }

variables: {
  "id": "<ADMIN_A_MEMBER>"
}
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
          "column": 24
        }
      ],
      "path": [
        "memberAccess"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": {
    "memberAccess": null
  }
}
```

### member.effective-own (A attacks B)

A's owner reads what it holds over REST: A1's permissions. **Pass.**

```http
GET /permissions
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>

```

**HTTP 200**

```json
{
  "storeId": "<STORE_A1>",
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
  "storeAccess": "all"
}
```

### member.effective-victim-channel (A attacks B)

A's owner asks what it holds with B's store token: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_B1>


query { effectivePermissions { storeId permissions storeAccess } }

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
        "effectivePermissions"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### member.catalog-victim-channel (A attacks B)

A's owner reads the permission catalog with B's store token: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_B1>


query { permissionCatalog { areas { id } } }

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
        "permissionCatalog"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### member.rest-effective-victim-channel (A attacks B)

A's owner reads what it holds over REST with B's store token: 403. **Pass.**

```http
GET /permissions
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_B1>

```

**HTTP 403**

```json
{
  "statusCode": 403,
  "message": "FORBIDDEN: error.forbidden",
  "timestamp": "2026-11-13T07:12:37.575Z",
  "path": "/permissions"
}
```

### member.rest-catalog-victim-channel (A attacks B)

A's owner reads the permission catalog over REST with B's store token: 403. **Pass.**

```http
GET /permissions/catalog
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_B1>

```

**HTTP 403**

```json
{
  "statusCode": 403,
  "message": "FORBIDDEN: error.forbidden",
  "timestamp": "2026-11-13T07:12:37.579Z",
  "path": "/permissions/catalog"
}
```

### member.switcher (A attacks B)

A's member opens the store switcher: A's store, nothing of B. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of member A]
vendure-token: <TOKEN_A1>


query { switchableStores { stores { id businessId name subdomain } } }

variables: {}
```

**HTTP 200**

```json
{
  "data": {
    "switchableStores": {
      "stores": [
        {
          "id": "<STORE_A1>",
          "businessId": "<BUSINESS_A>",
          "name": "Store A1 b8b7305f",
          "subdomain": "a-b8b7305f-1"
        }
      ]
    }
  }
}
```

### member.member-effective-victim-channel (A attacks B)

A's member asks what it holds with B's store token: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of member A]
vendure-token: <TOKEN_B1>


query { effectivePermissions { storeId permissions storeAccess } }

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
        "effectivePermissions"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```
