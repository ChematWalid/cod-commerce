# Isolation: business

Live transcripts from `scripts/evidence/P1-isolation.sh`. Ids and store tokens are placeholders; sessions are named, never shown.

### business.active (A attacks B)

A's owner reads the active business: A's own. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


query { activeBusiness { id name } }

variables: {}
```

**HTTP 200**

```json
{
  "data": {
    "activeBusiness": {
      "id": "<BUSINESS_A>",
      "name": "Business A ee06632b"
    }
  }
}
```

### business.active (B attacks A)

Reverse run: B's owner plays A's part and A is the victim. A's owner reads the active business: A's own. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner B]
vendure-token: <TOKEN_B1>


query { activeBusiness { id name } }

variables: {}
```

**HTTP 200**

```json
{
  "data": {
    "activeBusiness": {
      "id": "<BUSINESS_B>",
      "name": "Business B ee06632b"
    }
  }
}
```

### business.by-id (A attacks B)

A's owner asks for B's business by id: null. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


query ($id: String!) { business(id: $id) { id name } }

variables: {
  "id": "<BUSINESS_B>"
}
```

**HTTP 200**

```json
{
  "data": {
    "business": null
  }
}
```

### business.by-id (B attacks A)

Reverse run: B's owner plays A's part and A is the victim. A's owner asks for B's business by id: null. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner B]
vendure-token: <TOKEN_B1>


query ($id: String!) { business(id: $id) { id name } }

variables: {
  "id": "<BUSINESS_A>"
}
```

**HTTP 200**

```json
{
  "data": {
    "business": null
  }
}
```

### business.victim-channel (A attacks B)

A's owner sends B's store token: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_B1>


query { activeBusiness { id name } }

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
        "activeBusiness"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### business.victim-channel (B attacks A)

Reverse run: B's owner plays A's part and A is the victim. A's owner sends B's store token: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner B]
vendure-token: <TOKEN_A1>


query { activeBusiness { id name } }

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
        "activeBusiness"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### business.by-id-victim-channel (A attacks B)

A's owner asks for B's business by id with B's store token: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_B1>


query ($id: String!) { business(id: $id) { id name } }

variables: {
  "id": "<BUSINESS_B>"
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
        "business"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": {
    "business": null
  }
}
```

### business.update-victim-channel (A attacks B)

A's owner renames the business with B's store token: FORBIDDEN, B's business unchanged. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_B1>


mutation ($input: UpdateBusinessInput!) { updateBusiness(input: $input) { id name } }

variables: {
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
      "message": "You are not currently authorized to perform this action",
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
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### business.provision (A attacks B)

A's owner provisions a business, a platform-only operation: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($input: ProvisionBusinessInput!) { provisionBusiness(input: $input) { business { id } store { id } } }

variables: {
  "input": {
    "name": "Intruder business A",
    "owner": {
      "emailAddress": "intruder-owner-a-ee06632b-1-prov@example.test",
      "firstName": "Intruder",
      "lastName": "A",
      "password": "intruder-password"
    },
    "store": {
      "name": "Intruder store A",
      "subdomain": "a-ee06632b-1-prov",
      "language": "ar"
    }
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
          "column": 46
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
