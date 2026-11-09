# Refusals

FORBIDDEN for a missing permission, a refused escalation, the built-in rule, self-assignment and a store outside the member's list.

### businessRoles without team.roles.view: FORBIDDEN

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

### GET /roles without team.roles.view: 403

```http
GET http://127.0.0.1:23100/roles
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 403 Forbidden
content-type: application/json; charset=utf-8

{
  "statusCode": 403,
  "message": "FORBIDDEN: error.forbidden",
  "timestamp": "2026-11-09T17:02:19.830Z",
  "path": "/roles"
}
```

### createBusinessRole by a read-only member: FORBIDDEN

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($input: CreateBusinessRoleInput!) { createBusinessRole(input: $input) { id name description builtInKey isBuiltIn permissionCount memberCount areaLevels { area level } } }",
  "variables": {
    "input": {
      "name": "Refused"
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
          "column": 47
        }
      ],
      "path": [
        "createBusinessRole"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### businessRoles, anonymous: FORBIDDEN

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json

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

### A selected-store member with the other store's token: FORBIDDEN

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

### GET /permissions with the other store's token: 403

```http
GET http://127.0.0.1:23100/permissions
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 403 Forbidden
content-type: application/json; charset=utf-8

{
  "statusCode": 403,
  "message": "FORBIDDEN: error.forbidden",
  "timestamp": "2026-11-09T17:02:20.488Z",
  "path": "/permissions"
}
```

### Editing a built-in role

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: String!, $input: UpdateBusinessRoleInput!) { updateBusinessRole(id: $id, input: $input) { id name description builtInKey isBuiltIn permissionCount memberCount areaLevels { area level } } }",
  "variables": {
    "id": "<ROLE_OWNER>",
    "input": {
      "name": "Renamed owner"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "errors": [
    {
      "message": "A built-in role cannot be changed or deleted.",
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
        "code": "rbac.built-in-immutable"
      }
    }
  ],
  "data": null
}
```

### Deleting a role that still has a member

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: String!) { deleteBusinessRole(id: $id) { success } }",
  "variables": {
    "id": "<ROLE_VIEWER>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "errors": [
    {
      "message": "This role is still assigned to members. Remove it from them first.",
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
        "code": "rbac.role-in-use"
      }
    }
  ],
  "data": null
}
```

### Changing your own access

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($input: SetMemberAccessInput!) { setMemberAccess(input: $input) { administratorId roles { id name } storeAccess storeIds } }",
  "variables": {
    "input": {
      "administratorId": "2",
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
      "message": "You cannot change your own access.",
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
        "code": "rbac.self-assignment"
      }
    }
  ],
  "data": null
}
```

### A member who may create roles asks for permissions they do not hold: refused

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($input: CreateBusinessRoleInput!) { createBusinessRole(input: $input) { id name description builtInKey isBuiltIn permissionCount memberCount areaLevels { area level } } }",
  "variables": {
    "input": {
      "name": "Escalation",
      "areaLevels": [
        {
          "area": "orders",
          "level": "full"
        }
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
      "message": "You cannot grant or change more than you hold.",
      "locations": [
        {
          "line": 1,
          "column": 47
        }
      ],
      "path": [
        "createBusinessRole"
      ],
      "extensions": {
        "code": "rbac.privilege-exceeded"
      }
    }
  ],
  "data": null
}
```

