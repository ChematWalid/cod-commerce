# FORBIDDEN

Permission refusals. Another business's channel token is Vendure's FORBIDDEN at the auth guard (D8); the owner role holds no ReadChannel, so `channels` cannot list every store's token (A1).

### A's owner on B's channel: stores

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

### A's owner: channels

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query { channels { items { id code token } } }",
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

### A's owner: provisionBusiness (SuperAdmin only)

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($input: ProvisionBusinessInput!) { provisionBusiness(input: $input) { business { id name status } store { id subdomain language status } administratorId } }",
  "variables": {
    "input": {
      "name": "Third",
      "owner": {
        "emailAddress": "owner@third.example.test",
        "firstName": "Third",
        "lastName": "Owner",
        "password": "[REDACTED]"
      },
      "store": {
        "name": "Third Store",
        "subdomain": "third",
        "language": "ar"
      }
    }
  }
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
          "column": <ADMIN_C_ID>6
        }
      ],
      "path": [
        "provisionBusiness"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### Anonymous: stores

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json

{
  "query": "query { stores { id businessId name description language subdomain soldOutBehavior showAddressField status channelToken } }",
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

### Superadmin on the default channel: templateNotes (no tenant)

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]

{
  "query": "query { templateNotes(take: 10) { id title } }",
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
        "templateNotes"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

