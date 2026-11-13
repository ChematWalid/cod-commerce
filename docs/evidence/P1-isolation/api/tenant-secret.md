# Isolation: tenant secret

Live transcripts from `scripts/evidence/P1-isolation.sh`. Ids and store tokens are placeholders; sessions are named, never shown.

### secret.list (A attacks B)

A's owner lists tenant secrets: A's own only, never a value. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


query { tenantSecrets { id provider ref last4 updatedAt } }

variables: {}
```

**HTTP 200**

```json
{
  "data": {
    "tenantSecrets": [
      {
        "id": "<SECRET_A>",
        "provider": "demo-webhook",
        "ref": "signing",
        "last4": "632b",
        "updatedAt": "2026-11-13T14:27:05.556Z"
      }
    ]
  }
}
```

### secret.list (B attacks A)

Reverse run: B's owner plays A's part and A is the victim. A's owner lists tenant secrets: A's own only, never a value. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner B]
vendure-token: <TOKEN_B1>


query { tenantSecrets { id provider ref last4 updatedAt } }

variables: {}
```

**HTTP 200**

```json
{
  "data": {
    "tenantSecrets": [
      {
        "id": "<SECRET_B>",
        "provider": "demo-webhook",
        "ref": "signing",
        "last4": "632b",
        "updatedAt": "2026-11-13T14:27:09.007Z"
      }
    ]
  }
}
```

### secret.delete (A attacks B)

A's owner deletes B's tenant secret by id: tenant-secret.not-found, B's secret survives. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($id: String!) { deleteTenantSecret(id: $id) }

variables: {
  "id": "<SECRET_B>"
}
```

**HTTP 200**

```json
{
  "errors": [
    {
      "message": "No such secret",
      "locations": [
        {
          "line": 1,
          "column": 27
        }
      ],
      "path": [
        "deleteTenantSecret"
      ],
      "extensions": {
        "code": "tenant-secret.not-found"
      }
    }
  ],
  "data": null
}
```

### secret.delete (B attacks A)

Reverse run: B's owner plays A's part and A is the victim. A's owner deletes B's tenant secret by id: tenant-secret.not-found, B's secret survives. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner B]
vendure-token: <TOKEN_B1>


mutation ($id: String!) { deleteTenantSecret(id: $id) }

variables: {
  "id": "<SECRET_A>"
}
```

**HTTP 200**

```json
{
  "errors": [
    {
      "message": "No such secret",
      "locations": [
        {
          "line": 1,
          "column": 27
        }
      ],
      "path": [
        "deleteTenantSecret"
      ],
      "extensions": {
        "code": "tenant-secret.not-found"
      }
    }
  ],
  "data": null
}
```

### secret.victim-channel-list (A attacks B)

A's owner lists tenant secrets with B's store token: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_B1>


query { tenantSecrets { id provider ref last4 updatedAt } }

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
        "tenantSecrets"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### secret.victim-channel-list (B attacks A)

Reverse run: B's owner plays A's part and A is the victim. A's owner lists tenant secrets with B's store token: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner B]
vendure-token: <TOKEN_A1>


query { tenantSecrets { id provider ref last4 updatedAt } }

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
        "tenantSecrets"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### secret.victim-channel-set (A attacks B)

A's owner replaces the demo signing secret with B's store token: FORBIDDEN, B's secret unchanged. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_B1>


mutation ($input: SetTenantSecretInput!) { setTenantSecret(input: $input) { id } }

variables: {
  "input": {
    "provider": "demo-webhook",
    "ref": "signing",
    "value": "isolation-attempt-value-0001"
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
          "column": 44
        }
      ],
      "path": [
        "setTenantSecret"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### secret.victim-channel-delete (A attacks B)

A's owner deletes B's tenant secret with B's store token: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_B1>


mutation ($id: String!) { deleteTenantSecret(id: $id) }

variables: {
  "id": "<SECRET_B>"
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
        "deleteTenantSecret"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```
