# Isolation: store

Live transcripts from `scripts/evidence/P1-isolation.sh`. Ids and store tokens are placeholders; sessions are named, never shown.

### store.list (A attacks B)

A's owner lists stores: A1 and A2 only. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


query { stores { id businessId name subdomain channelToken } }

variables: {}
```

**HTTP 200**

```json
{
  "data": {
    "stores": [
      {
        "id": "<STORE_A1>",
        "businessId": "<BUSINESS_A>",
        "name": "Store A1 b8b7305f",
        "subdomain": "a-b8b7305f-1",
        "channelToken": "<TOKEN_A1>"
      },
      {
        "id": "<STORE_A2>",
        "businessId": "<BUSINESS_A>",
        "name": "Store A2 b8b7305f",
        "subdomain": "a-b8b7305f-2",
        "channelToken": "<TOKEN_A2>"
      }
    ]
  }
}
```

### store.list (B attacks A)

A's owner lists stores: A1 and A2 only. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner B]
vendure-token: <TOKEN_B1>


query { stores { id businessId name subdomain channelToken } }

variables: {}
```

**HTTP 200**

```json
{
  "data": {
    "stores": [
      {
        "id": "<STORE_B1>",
        "businessId": "<BUSINESS_B>",
        "name": "Store B1 b8b7305f",
        "subdomain": "b-b8b7305f-1",
        "channelToken": "<TOKEN_B1>"
      },
      {
        "id": "<STORE_B2>",
        "businessId": "<BUSINESS_B>",
        "name": "Store B2 b8b7305f",
        "subdomain": "b-b8b7305f-2",
        "channelToken": "<TOKEN_B2>"
      }
    ]
  }
}
```

### store.switcher (A attacks B)

A's owner opens the store switcher: A's stores only. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
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
        },
        {
          "id": "<STORE_A2>",
          "businessId": "<BUSINESS_A>",
          "name": "Store A2 b8b7305f",
          "subdomain": "a-b8b7305f-2"
        }
      ]
    }
  }
}
```

### store.switcher (B attacks A)

A's owner opens the store switcher: A's stores only. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner B]
vendure-token: <TOKEN_B1>


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
          "id": "<STORE_B1>",
          "businessId": "<BUSINESS_B>",
          "name": "Store B1 b8b7305f",
          "subdomain": "b-b8b7305f-1"
        },
        {
          "id": "<STORE_B2>",
          "businessId": "<BUSINESS_B>",
          "name": "Store B2 b8b7305f",
          "subdomain": "b-b8b7305f-2"
        }
      ]
    }
  }
}
```

### store.by-id (A attacks B)

A's owner asks for B's store by id: null. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


query ($id: String!) { store(id: $id) { id businessId name subdomain channelToken } }

variables: {
  "id": "<STORE_B1>"
}
```

**HTTP 200**

```json
{
  "data": {
    "store": null
  }
}
```

### store.by-id (B attacks A)

A's owner asks for B's store by id: null. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner B]
vendure-token: <TOKEN_B1>


query ($id: String!) { store(id: $id) { id businessId name subdomain channelToken } }

variables: {
  "id": "<STORE_A1>"
}
```

**HTTP 200**

```json
{
  "data": {
    "store": null
  }
}
```

### store.update (A attacks B)

A's owner renames B's store: tenancy.store-not-found. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($id: String!, $input: UpdateStoreInput!) { updateStore(id: $id, input: $input) { id } }

variables: {
  "id": "<STORE_B1>",
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
      "message": "The store does not exist",
      "locations": [
        {
          "line": 1,
          "column": 54
        }
      ],
      "path": [
        "updateStore"
      ],
      "extensions": {
        "code": "tenancy.store-not-found"
      }
    }
  ],
  "data": null
}
```

### store.update (B attacks A)

A's owner renames B's store: tenancy.store-not-found. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner B]
vendure-token: <TOKEN_B1>


mutation ($id: String!, $input: UpdateStoreInput!) { updateStore(id: $id, input: $input) { id } }

variables: {
  "id": "<STORE_A1>",
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
      "message": "The store does not exist",
      "locations": [
        {
          "line": 1,
          "column": 54
        }
      ],
      "path": [
        "updateStore"
      ],
      "extensions": {
        "code": "tenancy.store-not-found"
      }
    }
  ],
  "data": null
}
```

### store.change-subdomain (A attacks B)

A's owner changes B's subdomain: tenancy.store-not-found. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($id: String!, $subdomain: String!) { changeStoreSubdomain(id: $id, subdomain: $subdomain) { id } }

variables: {
  "id": "<STORE_B2>",
  "subdomain": "hijack-b-b8b7305f-2"
}
```

**HTTP 200**

```json
{
  "errors": [
    {
      "message": "The store does not exist",
      "locations": [
        {
          "line": 1,
          "column": 48
        }
      ],
      "path": [
        "changeStoreSubdomain"
      ],
      "extensions": {
        "code": "tenancy.store-not-found"
      }
    }
  ],
  "data": null
}
```

### store.archive (A attacks B)

A's owner archives B's store: tenancy.store-not-found. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($id: String!) { archiveStore(id: $id) { id } }

variables: {
  "id": "<STORE_B2>"
}
```

**HTTP 200**

```json
{
  "errors": [
    {
      "message": "The store does not exist",
      "locations": [
        {
          "line": 1,
          "column": 27
        }
      ],
      "path": [
        "archiveStore"
      ],
      "extensions": {
        "code": "tenancy.store-not-found"
      }
    }
  ],
  "data": null
}
```

### store.victim-channel (A attacks B)

A's owner lists stores with B's store token: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_B1>


query { stores { id businessId name subdomain channelToken } }

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
        "stores"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### store.switcher-victim-channel (A attacks B)

A's owner opens the store switcher with B's store token: FORBIDDEN (Authenticated is per channel). **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_B1>


query { switchableStores { stores { id businessId name subdomain } } }

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
        "switchableStores"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### store.by-id-victim-channel (A attacks B)

A's owner asks for B1 by id with B1's store token: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_B1>


query ($id: String!) { store(id: $id) { id businessId name subdomain channelToken } }

variables: {
  "id": "<STORE_B1>"
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
        "store"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": {
    "store": null
  }
}
```

### store.public-by-id (A attacks B)

A's owner reads B1 through the storefront lookup with no internal signature: 404, empty body. **Pass.**

```http
GET /store/by-id/<STORE_B1>
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>

```

**HTTP 404**

```json

```

### store.public-by-id (B attacks A)

A's owner reads B1 through the storefront lookup with no internal signature: 404, empty body. **Pass.**

```http
GET /store/by-id/<STORE_A1>
authorization: Bearer [session of owner B]
vendure-token: <TOKEN_B1>

```

**HTTP 404**

```json

```

### store.public-resolve (A attacks B)

A's owner resolves B1's host through the storefront lookup with no internal signature: 404, empty body. **Pass.**

```http
GET /store/resolve?host=b-b8b7305f-1.localhost
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>

```

**HTTP 404**

```json

```

### store.create-taken-subdomain (A attacks B)

A's owner opens a store on B1's subdomain: tenancy.subdomain-taken, B1 keeps it. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($input: CreateStoreInput!) { createStore(input: $input) { id subdomain } }

variables: {
  "input": {
    "name": "Intruder store A",
    "subdomain": "b-b8b7305f-1",
    "language": "ar"
  }
}
```

**HTTP 200**

```json
{
  "errors": [
    {
      "message": "This subdomain is already taken",
      "locations": [
        {
          "line": 1,
          "column": 40
        }
      ],
      "path": [
        "createStore"
      ],
      "extensions": {
        "code": "tenancy.subdomain-taken"
      }
    }
  ],
  "data": null
}
```

### store.create-victim-channel (A attacks B)

A's owner opens a store with B's store token: FORBIDDEN, no store opened for B. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_B1>


mutation ($input: CreateStoreInput!) { createStore(input: $input) { id subdomain } }

variables: {
  "input": {
    "name": "Intruder store A",
    "subdomain": "a-b8b7305f-1-chan",
    "language": "ar"
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
          "column": 40
        }
      ],
      "path": [
        "createStore"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### store.change-subdomain-taken (A attacks B)

A's owner moves A2 onto B2's subdomain: tenancy.subdomain-taken, B2 keeps it. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($id: String!, $subdomain: String!) { changeStoreSubdomain(id: $id, subdomain: $subdomain) { id subdomain } }

variables: {
  "id": "<STORE_A2>",
  "subdomain": "b-b8b7305f-2"
}
```

**HTTP 200**

```json
{
  "errors": [
    {
      "message": "This subdomain is already taken",
      "locations": [
        {
          "line": 1,
          "column": 48
        }
      ],
      "path": [
        "changeStoreSubdomain"
      ],
      "extensions": {
        "code": "tenancy.subdomain-taken"
      }
    }
  ],
  "data": null
}
```

### store.update-victim-channel (A attacks B)

A's owner renames A1 with B's store token: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_B1>


mutation ($id: String!, $input: UpdateStoreInput!) { updateStore(id: $id, input: $input) { id name } }

variables: {
  "id": "<STORE_A1>",
  "input": {
    "name": "Renamed via B"
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
          "column": 54
        }
      ],
      "path": [
        "updateStore"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### store.archive-victim-channel (A attacks B)

A's owner archives B2 with B's store token: FORBIDDEN, B2 still active. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_B1>


mutation ($id: String!) { archiveStore(id: $id) { id } }

variables: {
  "id": "<STORE_B2>"
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
        "archiveStore"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```
