# Envelope-encrypted tenant secrets

A secret is encrypted under the business's own data key, itself wrapped by the key-encryption key from the environment (D114). The value is write-only: no field returns it, only its last four characters.

### setTenantSecret again for the same provider and ref: the id is kept, last4 follows the new value

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($input: SetTenantSecretInput!) { setTenantSecret(input: $input) { id provider ref last4 updatedAt } }",
  "variables": {
    "input": {
      "provider": "demo-webhook",
      "ref": "signing",
      "value": "[REDACTED]"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "setTenantSecret": {
      "id": "<SECRET_A>",
      "provider": "demo-webhook",
      "ref": "signing",
      "last4": "0002",
      "updatedAt": "2026-11-12T21:01:33.654Z"
    }
  }
}
```

### tenantSecrets of A: one secret, last4 only

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query { tenantSecrets { id provider ref last4 } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "tenantSecrets": [
      {
        "id": "<SECRET_A>",
        "provider": "demo-webhook",
        "ref": "signing",
        "last4": "0002"
      }
    ]
  }
}
```

### tenantSecrets of B: empty, A's secret is not visible

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query { tenantSecrets { id provider ref last4 } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "tenantSecrets": []
  }
}
```

### B stores its own secret under the same provider and ref

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($input: SetTenantSecretInput!) { setTenantSecret(input: $input) { id provider ref last4 updatedAt } }",
  "variables": {
    "input": {
      "provider": "demo-webhook",
      "ref": "signing",
      "value": "[REDACTED]"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "setTenantSecret": {
      "id": "<SECRET_B>",
      "provider": "demo-webhook",
      "ref": "signing",
      "last4": "0001",
      "updatedAt": "2026-11-12T21:01:34.330Z"
    }
  }
}
```

### tenantSecrets of B: only B's own

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query { tenantSecrets { id provider ref last4 } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "tenantSecrets": [
      {
        "id": "<SECRET_B>",
        "provider": "demo-webhook",
        "ref": "signing",
        "last4": "0001"
      }
    ]
  }
}
```

### B deletes A's secret id: not found

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: String!) { deleteTenantSecret(id: $id) }",
  "variables": {
    "id": "<SECRET_A>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

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

### tenantSecrets of A afterwards: A's secret survived

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query { tenantSecrets { id provider ref last4 } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "tenantSecrets": [
      {
        "id": "<SECRET_A>",
        "provider": "demo-webhook",
        "ref": "signing",
        "last4": "0002"
      }
    ]
  }
}
```

### At rest: ciphertext, iv and tag only, no plaintext column (lengths shown, never bytes)

```sql
select provider, ref, last4, length(iv) as iv_bytes, length(ciphertext) as ciphertext_bytes, length(tag) as tag_bytes from tenant_secret order by "businessId";
```

```text
   provider   |   ref   | last4 | iv_bytes | ciphertext_bytes | tag_bytes 
--------------+---------+-------+----------+------------------+-----------
 demo-webhook | signing | 0002  |       12 |               48 |        16
 demo-webhook | signing | 0001  |       12 |               48 |        16
(2 rows)
```

