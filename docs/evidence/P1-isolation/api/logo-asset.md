# Isolation: logo asset

Live transcripts from `scripts/evidence/P1-isolation.sh`. Ids and store tokens are placeholders; sessions are named, never shown.

### business.update-with-victim-logo (A attacks B)

A's owner sets B's logo asset as A's logo: refused, B's asset untouched. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($input: UpdateBusinessInput!) { updateBusiness(input: $input) { id } }

variables: {
  "input": {
    "logoAssetId": "<ADMIN_A_OWNER>"
  }
}
```

**HTTP 200**

```json
{
  "errors": [
    {
      "message": "The asset is not available to this store",
      "locations": [
        {
          "line": 1,
          "column": 43
        }
      ],
      "path": [
        "updateBusiness"
      ],
      "extensions": {
        "code": "tenancy.asset-not-available"
      }
    }
  ],
  "data": null
}
```

### store.create-with-victim-logo (A attacks B)

A's owner opens a store with B's logo asset: tenancy.asset-not-available, no store opened. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($input: CreateStoreInput!) { createStore(input: $input) { id subdomain } }

variables: {
  "input": {
    "name": "Intruder store A",
    "subdomain": "a-ee06632b-1-logo",
    "language": "ar",
    "logoAssetId": "<ADMIN_A_OWNER>"
  }
}
```

**HTTP 200**

```json
{
  "errors": [
    {
      "message": "The asset is not available to this store",
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
        "code": "tenancy.asset-not-available"
      }
    }
  ],
  "data": null
}
```

### logo.update-store-with-victim-logo (A attacks B)

A's owner sets B's logo asset as A's store logo: tenancy.asset-not-available. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($id: String!, $input: UpdateStoreInput!) { updateStore(id: $id, input: $input) { id } }

variables: {
  "id": "<STORE_A1>",
  "input": {
    "logoAssetId": "<ADMIN_A_OWNER>"
  }
}
```

**HTTP 200**

```json
{
  "errors": [
    {
      "message": "The asset is not available to this store",
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
        "code": "tenancy.asset-not-available"
      }
    }
  ],
  "data": null
}
```
