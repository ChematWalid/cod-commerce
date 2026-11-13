# Store queries and mutations

The demo owner, on the Arabic store's channel. Channel tokens and ids are placeholders.

### stores: the two stores of the business

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query { stores { id businessId name description language subdomain soldOutBehavior showAddressField status channelToken } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "stores": [
      {
        "id": "<STORE_A_ID>",
        "businessId": "<BUSINESS_A_ID>",
        "name": "Demo Store",
        "description": "",
        "language": "ar",
        "subdomain": "demo",
        "soldOutBehavior": "keep",
        "showAddressField": true,
        "status": "active",
        "channelToken": "<CHANNEL_TOKEN_A>"
      },
      {
        "id": "<STORE_A2_ID>",
        "businessId": "<BUSINESS_A_ID>",
        "name": "Demo Store 2",
        "description": "",
        "language": "en",
        "subdomain": "demo2",
        "soldOutBehavior": "keep",
        "showAddressField": true,
        "status": "active",
        "channelToken": "<CHANNEL_TOKEN_A2>"
      }
    ]
  }
}
```

### store(id)

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($id: String!) { store(id: $id) { id businessId name description language subdomain soldOutBehavior showAddressField status } }",
  "variables": {
    "id": "<STORE_A_ID>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "store": {
      "id": "<STORE_A_ID>",
      "businessId": "<BUSINESS_A_ID>",
      "name": "Demo Store",
      "description": "",
      "language": "ar",
      "subdomain": "demo",
      "soldOutBehavior": "keep",
      "showAddressField": true,
      "status": "active"
    }
  }
}
```

### createStore

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($input: CreateStoreInput!) { createStore(input: $input) { id businessId name description language subdomain soldOutBehavior showAddressField status } }",
  "variables": {
    "input": {
      "name": "Demo Store 3",
      "subdomain": "demo3",
      "language": "fr"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "createStore": {
      "id": "<STORE_A3_ID>",
      "businessId": "<BUSINESS_A_ID>",
      "name": "Demo Store 3",
      "description": "",
      "language": "fr",
      "subdomain": "demo3",
      "soldOutBehavior": "keep",
      "showAddressField": true,
      "status": "active"
    }
  }
}
```

### createStore with a taken subdomain: a typed error, nothing created

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($input: CreateStoreInput!) { createStore(input: $input) { id businessId name description language subdomain soldOutBehavior showAddressField status } }",
  "variables": {
    "input": {
      "name": "Demo Store 3",
      "subdomain": "demo3",
      "language": "fr"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

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

### updateStore

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: String!, $input: UpdateStoreInput!) { updateStore(id: $id, input: $input) { id businessId name description language subdomain soldOutBehavior showAddressField status } }",
  "variables": {
    "id": "<STORE_A3_ID>",
    "input": {
      "description": "Evidence store",
      "soldOutBehavior": "hide"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "updateStore": {
      "id": "<STORE_A3_ID>",
      "businessId": "<BUSINESS_A_ID>",
      "name": "Demo Store 3",
      "description": "Evidence store",
      "language": "fr",
      "subdomain": "demo3",
      "soldOutBehavior": "hide",
      "showAddressField": true,
      "status": "active"
    }
  }
}
```

### archiveStore

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: String!) { archiveStore(id: $id) { id subdomain status } }",
  "variables": {
    "id": "<STORE_A3_ID>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "archiveStore": {
      "id": "<STORE_A3_ID>",
      "subdomain": "demo3",
      "status": "archived"
    }
  }
}
```

### The archived store's host no longer resolves

```http
GET http://127.0.0.1:23100/store/resolve?host=demo3.localhost
x-internal-kid: k1
x-internal-ts: <unix seconds>
x-internal-sig: [REDACTED]

HTTP/1.1 404 Not Found
content-type: application/json; charset=utf-8

{
  "statusCode": 404,
  "message": "Not Found",
  "timestamp": "2026-11-13T11:27:03.253Z",
  "path": "/store/resolve?host=demo3.localhost"
}
```

