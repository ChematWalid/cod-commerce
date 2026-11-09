# Two businesses: cross-tenant

A's owner with B's ids and B's channel token. A foreign id is not found; a foreign token is FORBIDDEN.

### A's owner on B's channel: FORBIDDEN

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query { businessRoles { id name description builtInKey isBuiltIn permissionCount memberCount areaLevels { area level } } }",
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
        "businessRoles"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### A reads B's role id: null

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($id: String!) { businessRole(id: $id) { id name description builtInKey isBuiltIn permissionCount memberCount areaLevels { area level } } }",
  "variables": {
    "id": "<ROLE_OTHER_BUSINESS>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "businessRole": null
  }
}
```

### A updates B's role: not found

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: String!, $input: UpdateBusinessRoleInput!) { updateBusinessRole(id: $id, input: $input) { id name description builtInKey isBuiltIn permissionCount memberCount areaLevels { area level } } }",
  "variables": {
    "id": "<ROLE_OTHER_BUSINESS>",
    "input": {
      "name": "Taken over"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "errors": [
    {
      "message": "Role not found.",
      "locations": [
        {
          "line": 1,
          "column": 61
        }
      ],
      "path": [
        "updateBusinessRole"
      ],
      "extensions": {
        "code": "rbac.role-not-found"
      }
    }
  ],
  "data": null
}
```

### A deletes B's role: not found

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: String!) { deleteBusinessRole(id: $id) { success } }",
  "variables": {
    "id": "<ROLE_OTHER_BUSINESS>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "errors": [
    {
      "message": "Role not found.",
      "locations": [
        {
          "line": 1,
          "column": 27
        }
      ],
      "path": [
        "deleteBusinessRole"
      ],
      "extensions": {
        "code": "rbac.role-not-found"
      }
    }
  ],
  "data": null
}
```

### GET /roles/:id with B's id: 404

```http
GET http://127.0.0.1:23100/roles/<ROLE_OTHER_BUSINESS>
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 404 Not Found
content-type: application/json; charset=utf-8

{
  "statusCode": 404,
  "code": "rbac.role-not-found",
  "message": "Role not found",
  "path": "/roles/<ROLE_OTHER_BUSINESS>"
}
```

### A reads B's member: null

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($administratorId: String!) { memberAccess(administratorId: $administratorId) { administratorId roles { id name } storeAccess storeIds } }",
  "variables": {
    "administratorId": "3"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "memberAccess": null
  }
}
```

### A changes B's member: not found

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($input: SetMemberAccessInput!) { setMemberAccess(input: $input) { administratorId roles { id name } storeAccess storeIds } }",
  "variables": {
    "input": {
      "administratorId": "3",
      "roleIds": [
        "<ROLE_VIEWER>"
      ],
      "storeAccess": "all"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "errors": [
    {
      "message": "Member not found.",
      "locations": [
        {
          "line": 1,
          "column": 44
        }
      ],
      "path": [
        "setMemberAccess"
      ],
      "extensions": {
        "code": "rbac.member-not-found"
      }
    }
  ],
  "data": null
}
```

### A gives a member B's store: refused

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($input: SetMemberAccessInput!) { setMemberAccess(input: $input) { administratorId roles { id name } storeAccess storeIds } }",
  "variables": {
    "input": {
      "administratorId": "4",
      "roleIds": [
        "<ROLE_VIEWER>"
      ],
      "storeAccess": "selected",
      "storeIds": [
        "<STORE_SECOND>"
      ]
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "errors": [
    {
      "message": "That store is not accessible.",
      "locations": [
        {
          "line": 1,
          "column": 44
        }
      ],
      "path": [
        "setMemberAccess"
      ],
      "extensions": {
        "code": "rbac.store-not-accessible"
      }
    }
  ],
  "data": null
}
```

### B's activity log holds nothing of A's (asserted on the real ids)

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($input: ActivityLogInput) { activityLog(input: $input) { items { id action entityType entityId summary diff actor { id name } storeId createdAt } nextCursor } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "activityLog": {
      "items": [],
      "nextCursor": null
    }
  }
}
```

