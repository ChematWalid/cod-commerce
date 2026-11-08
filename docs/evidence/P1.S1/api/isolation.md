# Cross-tenant not-found

The owner of Demo (A), on A's channel, asks for ids of Second (B). Reads answer null, writes answer a not-found error; B's data never appears.

### A: business(id of B) is null

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($id: String!) { business(id: $id) { id name status } }",
  "variables": {
    "id": "<BUSINESS_B_ID>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "business": null
  }
}
```

### A: store(id of B's store) is null

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($id: String!) { store(id: $id) { id businessId name description language subdomain soldOutBehavior showAddressField status } }",
  "variables": {
    "id": "<STORE_B_ID>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "store": null
  }
}
```

### A: updateStore on B's store

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: String!, $input: UpdateStoreInput!) { updateStore(id: $id, input: $input) { id businessId name description language subdomain soldOutBehavior showAddressField status } }",
  "variables": {
    "id": "<STORE_B_ID>",
    "input": {
      "description": "x"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "errors": [
    {
      "message": "The store does not exist",
      "locations": [
        {
          "line": 1,
          "column": 5<ADMIN_C_ID>
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

### A: archiveStore on B's store

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: String!) { archiveStore(id: $id) { id subdomain status } }",
  "variables": {
    "id": "<STORE_B_ID>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

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

### A: changeStoreSubdomain on B's store

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: String!, $subdomain: String!) { changeStoreSubdomain(id: $id, subdomain: $subdomain) { id subdomain status } }",
  "variables": {
    "id": "<STORE_B_ID>",
    "subdomain": "stolen"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "errors": [
    {
      "message": "The store does not exist",
      "locations": [
        {
          "line": 1,
          "column": <ADMIN_C_ID>8
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

### A: templateNotes lists A's notes only

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query { templateNotes(take: 10) { id title } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "templateNotes": [
      {
        "id": "<NOTE_A2_ID>",
        "title": "مكالمة المورد"
      },
      {
        "id": "<NOTE_A1_ID>",
        "title": "Call supplier"
      }
    ]
  }
}
```

