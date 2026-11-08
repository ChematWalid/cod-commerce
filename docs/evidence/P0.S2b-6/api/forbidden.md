# Permission check

An administrator whose only role grants `ReadCatalog` (plus the implicit `Authenticated`; created below through the Admin API, synthetic data) cannot read notes: `templateNotes` answers `FORBIDDEN`. The password of that account is redacted by the script.

### Superadmin: create a role with only ReadCatalog

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]

{
  "query": "mutation ($input: CreateRoleInput!) { createRole(input: $input) { id code permissions } }",
  "variables": {
    "input": {
      "code": "catalog-reader",
      "description": "catalog-reader",
      "permissions": [
        "ReadCatalog"
      ]
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "createRole": {
      "id": "3",
      "code": "catalog-reader",
      "permissions": [
        "Authenticated",
        "ReadCatalog"
      ]
    }
  }
}
```

### Superadmin: create an administrator with that role

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]

{
  "query": "mutation ($input: CreateAdministratorInput!) { createAdministrator(input: $input) { id emailAddress } }",
  "variables": {
    "input": {
      "firstName": "Catalog",
      "lastName": "Reader",
      "emailAddress": "catalog-reader@example.test",
      "password": "[REDACTED]",
      "roleIds": [
        "3"
      ]
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "createAdministrator": {
      "id": "2",
      "emailAddress": "catalog-reader@example.test"
    }
  }
}
```

### The catalog reader signs in

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json

{
  "query": "mutation Login($username: String!, $password: String!) { login(username: $username, password: $password) { __typename ... on CurrentUser { identifier } ... on ErrorResult { errorCode message } } }",
  "variables": {
    "username": "catalog-reader@example.test",
    "password": "[REDACTED]"
  }
}

HTTP/1.1 200 OK
vendure-auth-token: [REDACTED]
cache-control: no-store
content-type: application/json; charset=utf-8
set-cookie: session=[REDACTED]; path=/; samesite=lax; httponly
set-cookie: session.sig=[REDACTED]; path=/; samesite=lax; httponly

{
  "data": {
    "login": {
      "__typename": "CurrentUser",
      "identifier": "catalog-reader@example.test"
    }
  }
}
```

### The catalog reader: templateNotes

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]

{
  "query": "query ($take: Int, $skip: Int) { templateNotes(take: $take, skip: $skip) { id title body createdAt } }",
  "variables": {
    "take": 10,
    "skip": 0
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
          "column": 34
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

