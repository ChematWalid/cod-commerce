# Business queries and updateBusiness

The demo owner, on the Arabic store's channel.

### activeBusiness

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query { activeBusiness { id name status } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "activeBusiness": {
      "id": "<BUSINESS_A_ID>",
      "name": "Demo",
      "status": "active"
    }
  }
}
```

### business(id) of the caller's own business

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($id: String!) { business(id: $id) { id name status } }",
  "variables": {
    "id": "<BUSINESS_A_ID>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "business": {
      "id": "<BUSINESS_A_ID>",
      "name": "Demo",
      "status": "active"
    }
  }
}
```

### updateBusiness

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($input: UpdateBusinessInput!) { updateBusiness(input: $input) { id name status } }",
  "variables": {
    "input": {
      "name": "Demo"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "updateBusiness": {
      "id": "<BUSINESS_A_ID>",
      "name": "Demo",
      "status": "active"
    }
  }
}
```

