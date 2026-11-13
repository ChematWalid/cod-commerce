# Isolation: stock Vendure data

Live transcripts from `scripts/evidence/P1-isolation.sh`. Ids and store tokens are placeholders; sessions are named, never shown.

### stock.products (A attacks B)

A's owner lists stock products on A's store: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


query { products { totalItems items { id } } }

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
        "products"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### stock.products (B attacks A)

Reverse run: B's owner plays A's part and A is the victim. A's owner lists stock products on A's store: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner B]
vendure-token: <TOKEN_B1>


query { products { totalItems items { id } } }

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
        "products"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### stock.administrator-by-id (A attacks B)

A's owner reads B's owner through the stock administrator(id): FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


query ($id: ID!) { administrator(id: $id) { id emailAddress } }

variables: {
  "id": "<ADMIN_B_OWNER>"
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
          "column": 20
        }
      ],
      "path": [
        "administrator"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": {
    "administrator": null
  }
}
```

### stock.administrator-by-id (B attacks A)

Reverse run: B's owner plays A's part and A is the victim. A's owner reads B's owner through the stock administrator(id): FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner B]
vendure-token: <TOKEN_B1>


query ($id: ID!) { administrator(id: $id) { id emailAddress } }

variables: {
  "id": "<ADMIN_A_OWNER>"
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
          "column": 20
        }
      ],
      "path": [
        "administrator"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": {
    "administrator": null
  }
}
```

### stock.orders (A attacks B)

A's owner lists stock orders on A's store: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


query { orders { totalItems items { id code } } }

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
        "orders"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### stock.customers (A attacks B)

A's owner lists stock customers on A's store: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


query { customers { totalItems items { id emailAddress } } }

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
        "customers"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### stock.assets (A attacks B)

A's owner lists stock assets on A's store: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


query { assets { totalItems items { id source } } }

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
        "assets"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### stock.asset-by-id (A attacks B)

A's owner reads B's logo through the stock asset(id): FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


query ($id: ID!) { asset(id: $id) { id source } }

variables: {
  "id": "<ADMIN_A_OWNER>"
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
          "column": 20
        }
      ],
      "path": [
        "asset"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": {
    "asset": null
  }
}
```

### stock.asset-by-id (B attacks A)

Reverse run: B's owner plays A's part and A is the victim. A's owner reads B's logo through the stock asset(id): FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner B]
vendure-token: <TOKEN_B1>


query ($id: ID!) { asset(id: $id) { id source } }

variables: {
  "id": "<LOGO_A>"
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
          "column": 20
        }
      ],
      "path": [
        "asset"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": {
    "asset": null
  }
}
```

### stock.administrators (A attacks B)

A's owner lists stock administrators on A's store: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


query { administrators { totalItems items { id emailAddress } } }

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
        "administrators"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### stock.roles (A attacks B)

A's owner lists stock roles on A's store: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


query { roles { totalItems items { id code } } }

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
        "roles"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### stock.channels (A attacks B)

A's owner lists stock channels on A's store: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


query { channels { totalItems items { id code token } } }

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
        "channels"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### stock.api-keys (A attacks B)

A's owner lists stock API keys on A's store: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


query { apiKeys { totalItems items { id } } }

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
        "apiKeys"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### stock.api-key-by-id (A attacks B)

A's owner reads a stock API key by id: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


query ($id: ID!) { apiKey(id: $id) { id } }

variables: {
  "id": "<LOGO_A>"
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
          "column": 20
        }
      ],
      "path": [
        "apiKey"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": {
    "apiKey": null
  }
}
```

### stock.sellers (A attacks B)

A's owner lists stock sellers on A's store: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


query { sellers { totalItems items { id name } } }

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
        "sellers"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### stock.slug-for-entity (A attacks B)

A's owner probes whether B's subdomain exists through slugForEntity (D500): FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


query ($input: SlugForEntityInput!) { slugForEntity(input: $input) }

variables: {
  "input": {
    "entityName": "StoreEntity",
    "fieldName": "subdomain",
    "inputValue": "b-ee06632b-1"
  }
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
          "column": 39
        }
      ],
      "path": [
        "slugForEntity"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### stock.active-channel.victim-channel (A attacks B)

A's owner reads the active channel with B's store token: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_B1>


query { activeChannel { id code token } }

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
        "activeChannel"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### stock.active-channel.victim-channel (B attacks A)

Reverse run: B's owner plays A's part and A is the victim. A's owner reads the active channel with B's store token: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner B]
vendure-token: <TOKEN_A1>


query { activeChannel { id code token } }

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
        "activeChannel"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### stock.me.victim-channel (A attacks B)

A's owner reads me with B's store token: A's own store channels only. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_B1>


query { me { id identifier channels { id code token } } }

variables: {}
```

**HTTP 200**

```json
{
  "data": {
    "me": {
      "id": "<ADMIN_A_OWNER>",
      "identifier": "owner-a-ee06632b@example.test",
      "channels": [
        {
          "id": "<ADMIN_A_OWNER>",
          "code": "3578e2a03d816ade7730e49faf2362c8",
          "token": "<TOKEN_A1>"
        },
        {
          "id": "<ADMIN_A_MEMBER>",
          "code": "4968e3afaeaacf174f053cb4c174a4da",
          "token": "<TOKEN_A2>"
        }
      ]
    }
  }
}
```

### stock.active-administrator.victim-channel (A attacks B)

A's owner reads the active administrator with B's store token: A's own, nothing of B. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_B1>


query { activeAdministrator { id emailAddress } }

variables: {}
```

**HTTP 200**

```json
{
  "data": {
    "activeAdministrator": {
      "id": "<ADMIN_A_OWNER>",
      "emailAddress": "owner-a-ee06632b@example.test"
    }
  }
}
```

### stock.create-channel (A attacks B)

A's owner creates a stock channel carrying B's store token: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($input: CreateChannelInput!) { createChannel(input: $input) { __typename } }

variables: {
  "input": {
    "code": "intruder",
    "defaultLanguageCode": "en",
    "pricesIncludeTax": true,
    "defaultCurrencyCode": "USD",
    "defaultTaxZoneId": "<LOGO_A>",
    "defaultShippingZoneId": "<LOGO_A>",
    "token": "<TOKEN_B1>"
  }
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
          "column": 42
        }
      ],
      "path": [
        "createChannel"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### stock.update-channel (A attacks B)

A's owner renames the default stock channel: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($input: UpdateChannelInput!) { updateChannel(input: $input) { __typename } }

variables: {
  "input": {
    "id": "<LOGO_A>",
    "code": "intruder"
  }
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
          "column": 42
        }
      ],
      "path": [
        "updateChannel"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### stock.create-role (A attacks B)

A's owner creates a stock SuperAdmin role: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($input: CreateRoleInput!) { createRole(input: $input) { id } }

variables: {
  "input": {
    "code": "intruder",
    "description": "intruder",
    "permissions": [
      "SuperAdmin"
    ]
  }
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
          "column": 39
        }
      ],
      "path": [
        "createRole"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### stock.create-role (B attacks A)

Reverse run: B's owner plays A's part and A is the victim. A's owner creates a stock SuperAdmin role: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner B]
vendure-token: <TOKEN_B1>


mutation ($input: CreateRoleInput!) { createRole(input: $input) { id } }

variables: {
  "input": {
    "code": "intruder",
    "description": "intruder",
    "permissions": [
      "SuperAdmin"
    ]
  }
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
          "column": 39
        }
      ],
      "path": [
        "createRole"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### stock.update-role (A attacks B)

A's owner edits the stock SuperAdmin role: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($input: UpdateRoleInput!) { updateRole(input: $input) { id } }

variables: {
  "input": {
    "id": "<LOGO_A>",
    "description": "intruder"
  }
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
          "column": 39
        }
      ],
      "path": [
        "updateRole"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### stock.delete-role (A attacks B)

A's owner deletes a stock role: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($id: ID!) { deleteRole(id: $id) { result } }

variables: {
  "id": "<LOGO_A>"
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
          "column": 23
        }
      ],
      "path": [
        "deleteRole"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### stock.create-administrator (A attacks B)

A's owner creates a stock administrator: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($input: CreateAdministratorInput!) { createAdministrator(input: $input) { id } }

variables: {
  "input": {
    "firstName": "Intruder",
    "lastName": "A",
    "emailAddress": "intruder-a@example.test",
    "password": "intruder-password",
    "roleIds": []
  }
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
          "column": 48
        }
      ],
      "path": [
        "createAdministrator"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### stock.update-administrator (A attacks B)

A's owner renames B's owner through the stock updateAdministrator: FORBIDDEN, B's owner unchanged. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($input: UpdateAdministratorInput!) { updateAdministrator(input: $input) { id } }

variables: {
  "input": {
    "id": "<ADMIN_B_OWNER>",
    "lastName": "Taken over"
  }
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
          "column": 48
        }
      ],
      "path": [
        "updateAdministrator"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### stock.assign-role (A attacks B)

A's owner gives B's owner the stock SuperAdmin role: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($administratorId: ID!, $roleId: ID!) { assignRoleToAdministrator(administratorId: $administratorId, roleId: $roleId) { id } }

variables: {
  "administratorId": "<ADMIN_B_OWNER>",
  "roleId": "<LOGO_A>"
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
          "column": 50
        }
      ],
      "path": [
        "assignRoleToAdministrator"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### stock.create-api-key (A attacks B)

A's owner creates a stock API key: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($input: CreateApiKeyInput!) { createApiKey(input: $input) { apiKey entityId } }

variables: {
  "input": {
    "roleIds": [],
    "translations": [
      {
        "languageCode": "en",
        "name": "intruder"
      }
    ]
  }
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
          "column": 41
        }
      ],
      "path": [
        "createApiKey"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### stock.delete-api-keys (A attacks B)

A's owner deletes stock API keys: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($ids: [ID!]!) { deleteApiKeys(ids: $ids) { result } }

variables: {
  "ids": [
    "<LOGO_A>"
  ]
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
          "column": 27
        }
      ],
      "path": [
        "deleteApiKeys"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### stock.create-seller (A attacks B)

A's owner creates a stock seller: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($input: CreateSellerInput!) { createSeller(input: $input) { id } }

variables: {
  "input": {
    "name": "Intruder"
  }
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
          "column": 41
        }
      ],
      "path": [
        "createSeller"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### stock.create-customer (A attacks B)

A's owner creates a stock customer: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($input: CreateCustomerInput!) { createCustomer(input: $input) { __typename } }

variables: {
  "input": {
    "firstName": "Intruder",
    "lastName": "A",
    "emailAddress": "intruder-customer-a@example.test"
  }
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
          "column": 43
        }
      ],
      "path": [
        "createCustomer"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### stock.update-global-settings (A attacks B)

A's owner changes the platform's global settings: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($input: UpdateGlobalSettingsInput!) { updateGlobalSettings(input: $input) { __typename } }

variables: {
  "input": {
    "outOfStockThreshold": 0
  }
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
          "column": 49
        }
      ],
      "path": [
        "updateGlobalSettings"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```
