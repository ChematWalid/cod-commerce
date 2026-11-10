# switchableStores

The stores the caller can switch to: active stores of the active business on which the caller holds a role. No channel token is returned (D85).

### The owner of business A: both stores

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query { switchableStores { platformDomain stores { id businessId channelId name subdomain language } } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "switchableStores": {
      "platformDomain": "localhost",
      "stores": [
        {
          "id": "<STORE_DEMO>",
          "businessId": "<BUSINESS_DEMO>",
          "channelId": "2",
          "name": "Demo Store",
          "subdomain": "demo",
          "language": "ar"
        },
        {
          "id": "<STORE_DEMO2>",
          "businessId": "<BUSINESS_DEMO>",
          "channelId": "3",
          "name": "Demo Store 2",
          "subdomain": "demo2",
          "language": "en"
        }
      ]
    }
  }
}
```

### The owner of business B: B's two stores, none of A's (asserted on the real ids)

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query { switchableStores { platformDomain stores { id businessId channelId name subdomain language } } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "switchableStores": {
      "platformDomain": "localhost",
      "stores": [
        {
          "id": "<STORE_SECOND>",
          "businessId": "<BUSINESS_SECOND>",
          "channelId": "4",
          "name": "Second Store",
          "subdomain": "second",
          "language": "fr"
        },
        {
          "id": "<STORE_SECOND2>",
          "businessId": "<BUSINESS_SECOND>",
          "channelId": "5",
          "name": "Second Store 2",
          "subdomain": "second2",
          "language": "en"
        }
      ]
    }
  }
}
```

### A member with a role on one selected store: that store only

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query { switchableStores { platformDomain stores { id businessId channelId name subdomain language } } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "switchableStores": {
      "platformDomain": "localhost",
      "stores": [
        {
          "id": "<STORE_DEMO>",
          "businessId": "<BUSINESS_DEMO>",
          "channelId": "2",
          "name": "Demo Store",
          "subdomain": "demo",
          "language": "ar"
        }
      ]
    }
  }
}
```

### Anonymous: FORBIDDEN

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json

{
  "query": "query { switchableStores { platformDomain stores { id businessId channelId name subdomain language } } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

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

### The owner of A with B's channel token: FORBIDDEN

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query { switchableStores { platformDomain stores { id businessId channelId name subdomain language } } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

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

