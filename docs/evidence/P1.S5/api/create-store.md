# createStore, then the list; archiveStore, then the list

A new store appears in `switchableStores`; once archived it is gone from it.

### createStore

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($input: CreateStoreInput!) { createStore(input: $input) { id businessId name subdomain language } }",
  "variables": {
    "input": {
      "name": "Evidence store",
      "subdomain": "ev1794274185",
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
      "id": "<STORE_CREATED>",
      "businessId": "<BUSINESS_DEMO>",
      "name": "Evidence store",
      "subdomain": "ev1794274185",
      "language": "fr"
    }
  }
}
```

### switchableStores: the new store is listed

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
        },
        {
          "id": "<STORE_CREATED>",
          "businessId": "<BUSINESS_DEMO>",
          "channelId": "6",
          "name": "Evidence store",
          "subdomain": "ev1794274185",
          "language": "fr"
        }
      ]
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
  "query": "mutation ($id: String!) { archiveStore(id: $id) { id name subdomain } }",
  "variables": {
    "id": "<STORE_CREATED>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "archiveStore": {
      "id": "<STORE_CREATED>",
      "name": "Evidence store",
      "subdomain": "ev1794274185"
    }
  }
}
```

### switchableStores: the archived store is absent

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

