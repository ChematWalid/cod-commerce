# A change takes effect on the member's next request, on another api process

The owner's writes go to port 23100, the member's reads to the separately running process on port 23101. Each read is the first request after the write, with no wait.

### Second api, before: the member reads roles (their session is now cached)

```http
POST http://127.0.0.1:23101/admin-api?languageCode=en
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
  "data": {
    "businessRoles": [
      {
        "id": "245593672379277316",
        "name": "Accountant",
        "description": "Can keep the books and read every order, without changing orders.",
        "builtInKey": "accountant",
        "isBuiltIn": true,
        "permissionCount": 11,
        "memberCount": 0,
        "areaLevels": [
          {
            "area": "orders",
            "level": "custom"
          },
          {
            "area": "tracking",
            "level": "none"
          },
          {
            "area": "catalog",
            "level": "none"
          },
          {
            "area": "offers",
            "level": "none"
          },
          {
            "area": "inventory",
            "level": "none"
          },
          {
            "area": "finance",
            "level": "full"
          },
          {
            "area": "analytics",
            "level": "none"
          },
          {
            "area": "team",
            "level": "none"
          },
          {
            "area": "delivery",
            "level": "none"
          },
          {
            "area": "store",
            "level": "none"
          },
          {
            "area": "apps",
            "level": "none"
          },
          {
            "area": "settings",
            "level": "none"
          }
        ]
      },
      {
        "id": "<ROLE_CLERK>",
        "name": "Demo orders clerk",
        "description": null,
        "builtInKey": null,
        "isBuiltIn": false,
        "permissionCount": 1,
        "memberCount": 1,
        "areaLevels": [
          {
            "area": "orders",
            "level": "custom"
          },
          {
            "area": "tracking",
            "level": "none"
          },
          {
            "area": "catalog",
            "level": "none"
          },
          {
            "area": "offers",
            "level": "none"
          },
          {
            "area": "inventory",
            "level": "none"
          },
          {
            "area": "finance",
            "level": "none"
          },
          {
            "area": "analytics",
            "level": "none"
          },
          {
            "area": "team",
            "level": "none"
          },
          {
            "area": "delivery",
            "level": "none"
          },
          {
            "area": "store",
            "level": "none"
          },
          {
            "area": "apps",
            "level": "none"
          },
          {
            "area": "settings",
            "level": "none"
          }
        ]
      },
      {
        "id": "<ROLE_VIEWER>",
        "name": "Demo viewer",
        "description": null,
        "builtInKey": null,
        "isBuiltIn": false,
        "permissionCount": 2,
        "memberCount": 1,
        "areaLevels": [
          {
            "area": "orders",
            "level": "none"
          },
          {
            "area": "tracking",
            "level": "none"
          },
          {
            "area": "catalog",
            "level": "none"
          },
          {
            "area": "offers",
            "level": "none"
          },
          {
            "area": "inventory",
            "level": "none"
          },
          {
            "area": "finance",
            "level": "none"
          },
          {
            "area": "analytics",
            "level": "none"
          },
          {
            "area": "team",
            "level": "custom"
          },
          {
            "area": "delivery",
            "level": "none"
          },
          {
            "area": "store",
            "level": "none"
          },
          {
            "area": "apps",
            "level": "none"
          },
          {
            "area": "settings",
            "level": "custom"
          }
        ]
      },
      {
        "id": "245593672379277315",
        "name": "Inventory manager",
        "description": "Can keep products, collections and stock up to date, including purchase prices.",
        "builtInKey": "inventory-manager",
        "isBuiltIn": true,
        "permissionCount": 12,
        "memberCount": 0,
        "areaLevels": [
          {
            "area": "orders",
            "level": "none"
          },
          {
            "area": "tracking",
            "level": "none"
          },
          {
            "area": "catalog",
            "level": "full"
          },
          {
            "area": "offers",
            "level": "none"
          },
          {
            "area": "inventory",
            "level": "full"
          },
          {
            "area": "finance",
            "level": "none"
          },
          {
            "area": "analytics",
            "level": "none"
          },
          {
            "area": "team",
            "level": "none"
          },
          {
            "area": "delivery",
            "level": "none"
          },
          {
            "area": "store",
            "level": "none"
          },
          {
            "area": "apps",
            "level": "none"
          },
          {
            "area": "settings",
            "level": "none"
          }
        ]
      },
      {
        "id": "245593672379277313",
        "name": "Manager",
        "description": "Can do everything except delete records, remove members or change business settings.",
        "builtInKey": "manager",
        "isBuiltIn": true,
        "permissionCount": 77,
        "memberCount": 0,
        "areaLevels": [
          {
            "area": "orders",
            "level": "custom"
          },
          {
            "area": "tracking",
            "level": "full"
          },
          {
            "area": "catalog",
            "level": "custom"
          },
          {
            "area": "offers",
            "level": "custom"
          },
          {
            "area": "inventory",
            "level": "full"
          },
          {
            "area": "finance",
            "level": "custom"
          },
          {
            "area": "analytics",
            "level": "full"
          },
          {
            "area": "team",
            "level": "custom"
          },
          {
            "area": "delivery",
            "level": "custom"
          },
          {
            "area": "store",
            "level": "custom"
          },
          {
            "area": "apps",
            "level": "custom"
          },
          {
            "area": "settings",
            "level": "view"
          }
        ]
      },
      {
        "id": "245593672379277314",
        "name": "Order manager",
        "description": "Can handle orders from creation to delivery, returns and buyers, and nothing else.",
        "builtInKey": "order-manager",
        "isBuiltIn": true,
        "permissionCount": 19,
        "memberCount": 0,
        "areaLevels": [
          {
            "area": "orders",
            "level": "full"
          },
          {
            "area": "tracking",
            "level": "none"
          },
          {
            "area": "catalog",
            "level": "none"
          },
          {
            "area": "offers",
            "level": "none"
          },
          {
            "area": "inventory",
            "level": "none"
          },
          {
            "area": "finance",
            "level": "none"
          },
          {
            "area": "analytics",
            "level": "none"
          },
          {
            "area": "team",
            "level": "none"
          },
          {
            "area": "delivery",
            "level": "none"
          },
          {
            "area": "store",
            "level": "none"
          },
          {
            "area": "apps",
            "level": "none"
          },
          {
            "area": "settings",
            "level": "none"
          }
        ]
      },
      {
        "id": "245593672379277317",
        "name": "Order tracker",
        "description": "Can follow shipments and update their status, and nothing else.",
        "builtInKey": "order-tracker",
        "isBuiltIn": true,
        "permissionCount": 3,
        "memberCount": 0,
        "areaLevels": [
          {
            "area": "orders",
            "level": "none"
          },
          {
            "area": "tracking",
            "level": "full"
          },
          {
            "area": "catalog",
            "level": "none"
          },
          {
            "area": "offers",
            "level": "none"
          },
          {
            "area": "inventory",
            "level": "none"
          },
          {
            "area": "finance",
            "level": "none"
          },
          {
            "area": "analytics",
            "level": "none"
          },
          {
            "area": "team",
            "level": "none"
          },
          {
            "area": "delivery",
            "level": "none"
          },
          {
            "area": "store",
            "level": "none"
          },
          {
            "area": "apps",
            "level": "none"
          },
          {
            "area": "settings",
            "level": "none"
          }
        ]
      },
      {
        "id": "<ROLE_OWNER>",
        "name": "Owner",
        "description": "Can do everything in the business, including deleting records and changing settings.",
        "builtInKey": "owner",
        "isBuiltIn": true,
        "permissionCount": 93,
        "memberCount": 1,
        "areaLevels": [
          {
            "area": "orders",
            "level": "full"
          },
          {
            "area": "tracking",
            "level": "full"
          },
          {
            "area": "catalog",
            "level": "full"
          },
          {
            "area": "offers",
            "level": "full"
          },
          {
            "area": "inventory",
            "level": "full"
          },
          {
            "area": "finance",
            "level": "full"
          },
          {
            "area": "analytics",
            "level": "full"
          },
          {
            "area": "team",
            "level": "full"
          },
          {
            "area": "delivery",
            "level": "full"
          },
          {
            "area": "store",
            "level": "full"
          },
          {
            "area": "apps",
            "level": "full"
          },
          {
            "area": "settings",
            "level": "full"
          }
        ]
      },
      {
        "id": "245593672379277318",
        "name": "Store manager",
        "description": "Can run the storefront, its pages and domains, and maintain products and collections.",
        "builtInKey": "store-manager",
        "isBuiltIn": true,
        "permissionCount": 23,
        "memberCount": 0,
        "areaLevels": [
          {
            "area": "orders",
            "level": "none"
          },
          {
            "area": "tracking",
            "level": "none"
          },
          {
            "area": "catalog",
            "level": "full"
          },
          {
            "area": "offers",
            "level": "none"
          },
          {
            "area": "inventory",
            "level": "none"
          },
          {
            "area": "finance",
            "level": "none"
          },
          {
            "area": "analytics",
            "level": "none"
          },
          {
            "area": "team",
            "level": "none"
          },
          {
            "area": "delivery",
            "level": "none"
          },
          {
            "area": "store",
            "level": "full"
          },
          {
            "area": "apps",
            "level": "none"
          },
          {
            "area": "settings",
            "level": "none"
          }
        ]
      }
    ]
  }
}
```

### First api: the owner removes team.roles.view from the role

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: String!, $input: UpdateBusinessRoleInput!) { updateBusinessRole(id: $id, input: $input) { id name description builtInKey isBuiltIn permissionCount memberCount areaLevels { area level } } }",
  "variables": {
    "id": "<ROLE_VIEWER>",
    "input": {
      "revokes": [
        "team.roles.view"
      ]
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "updateBusinessRole": {
      "id": "<ROLE_VIEWER>",
      "name": "Demo viewer",
      "description": null,
      "builtInKey": null,
      "isBuiltIn": false,
      "permissionCount": 1,
      "memberCount": 1,
      "areaLevels": [
        {
          "area": "orders",
          "level": "none"
        },
        {
          "area": "tracking",
          "level": "none"
        },
        {
          "area": "catalog",
          "level": "none"
        },
        {
          "area": "offers",
          "level": "none"
        },
        {
          "area": "inventory",
          "level": "none"
        },
        {
          "area": "finance",
          "level": "none"
        },
        {
          "area": "analytics",
          "level": "none"
        },
        {
          "area": "team",
          "level": "none"
        },
        {
          "area": "delivery",
          "level": "none"
        },
        {
          "area": "store",
          "level": "none"
        },
        {
          "area": "apps",
          "level": "none"
        },
        {
          "area": "settings",
          "level": "custom"
        }
      ]
    }
  }
}
```

### Second api, next request: FORBIDDEN

```http
POST http://127.0.0.1:23101/admin-api?languageCode=en
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

### First api: the owner gives it back

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: String!, $input: UpdateBusinessRoleInput!) { updateBusinessRole(id: $id, input: $input) { id name description builtInKey isBuiltIn permissionCount memberCount areaLevels { area level } } }",
  "variables": {
    "id": "<ROLE_VIEWER>",
    "input": {
      "grants": [
        "team.roles.view"
      ]
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "updateBusinessRole": {
      "id": "<ROLE_VIEWER>",
      "name": "Demo viewer",
      "description": null,
      "builtInKey": null,
      "isBuiltIn": false,
      "permissionCount": 2,
      "memberCount": 1,
      "areaLevels": [
        {
          "area": "orders",
          "level": "none"
        },
        {
          "area": "tracking",
          "level": "none"
        },
        {
          "area": "catalog",
          "level": "none"
        },
        {
          "area": "offers",
          "level": "none"
        },
        {
          "area": "inventory",
          "level": "none"
        },
        {
          "area": "finance",
          "level": "none"
        },
        {
          "area": "analytics",
          "level": "none"
        },
        {
          "area": "team",
          "level": "custom"
        },
        {
          "area": "delivery",
          "level": "none"
        },
        {
          "area": "store",
          "level": "none"
        },
        {
          "area": "apps",
          "level": "none"
        },
        {
          "area": "settings",
          "level": "custom"
        }
      ]
    }
  }
}
```

### Second api, next request: answered

```http
POST http://127.0.0.1:23101/admin-api?languageCode=en
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
  "data": {
    "businessRoles": [
      {
        "id": "245593672379277316",
        "name": "Accountant",
        "description": "Can keep the books and read every order, without changing orders.",
        "builtInKey": "accountant",
        "isBuiltIn": true,
        "permissionCount": 11,
        "memberCount": 0,
        "areaLevels": [
          {
            "area": "orders",
            "level": "custom"
          },
          {
            "area": "tracking",
            "level": "none"
          },
          {
            "area": "catalog",
            "level": "none"
          },
          {
            "area": "offers",
            "level": "none"
          },
          {
            "area": "inventory",
            "level": "none"
          },
          {
            "area": "finance",
            "level": "full"
          },
          {
            "area": "analytics",
            "level": "none"
          },
          {
            "area": "team",
            "level": "none"
          },
          {
            "area": "delivery",
            "level": "none"
          },
          {
            "area": "store",
            "level": "none"
          },
          {
            "area": "apps",
            "level": "none"
          },
          {
            "area": "settings",
            "level": "none"
          }
        ]
      },
      {
        "id": "<ROLE_CLERK>",
        "name": "Demo orders clerk",
        "description": null,
        "builtInKey": null,
        "isBuiltIn": false,
        "permissionCount": 1,
        "memberCount": 1,
        "areaLevels": [
          {
            "area": "orders",
            "level": "custom"
          },
          {
            "area": "tracking",
            "level": "none"
          },
          {
            "area": "catalog",
            "level": "none"
          },
          {
            "area": "offers",
            "level": "none"
          },
          {
            "area": "inventory",
            "level": "none"
          },
          {
            "area": "finance",
            "level": "none"
          },
          {
            "area": "analytics",
            "level": "none"
          },
          {
            "area": "team",
            "level": "none"
          },
          {
            "area": "delivery",
            "level": "none"
          },
          {
            "area": "store",
            "level": "none"
          },
          {
            "area": "apps",
            "level": "none"
          },
          {
            "area": "settings",
            "level": "none"
          }
        ]
      },
      {
        "id": "<ROLE_VIEWER>",
        "name": "Demo viewer",
        "description": null,
        "builtInKey": null,
        "isBuiltIn": false,
        "permissionCount": 2,
        "memberCount": 1,
        "areaLevels": [
          {
            "area": "orders",
            "level": "none"
          },
          {
            "area": "tracking",
            "level": "none"
          },
          {
            "area": "catalog",
            "level": "none"
          },
          {
            "area": "offers",
            "level": "none"
          },
          {
            "area": "inventory",
            "level": "none"
          },
          {
            "area": "finance",
            "level": "none"
          },
          {
            "area": "analytics",
            "level": "none"
          },
          {
            "area": "team",
            "level": "custom"
          },
          {
            "area": "delivery",
            "level": "none"
          },
          {
            "area": "store",
            "level": "none"
          },
          {
            "area": "apps",
            "level": "none"
          },
          {
            "area": "settings",
            "level": "custom"
          }
        ]
      },
      {
        "id": "245593672379277315",
        "name": "Inventory manager",
        "description": "Can keep products, collections and stock up to date, including purchase prices.",
        "builtInKey": "inventory-manager",
        "isBuiltIn": true,
        "permissionCount": 12,
        "memberCount": 0,
        "areaLevels": [
          {
            "area": "orders",
            "level": "none"
          },
          {
            "area": "tracking",
            "level": "none"
          },
          {
            "area": "catalog",
            "level": "full"
          },
          {
            "area": "offers",
            "level": "none"
          },
          {
            "area": "inventory",
            "level": "full"
          },
          {
            "area": "finance",
            "level": "none"
          },
          {
            "area": "analytics",
            "level": "none"
          },
          {
            "area": "team",
            "level": "none"
          },
          {
            "area": "delivery",
            "level": "none"
          },
          {
            "area": "store",
            "level": "none"
          },
          {
            "area": "apps",
            "level": "none"
          },
          {
            "area": "settings",
            "level": "none"
          }
        ]
      },
      {
        "id": "245593672379277313",
        "name": "Manager",
        "description": "Can do everything except delete records, remove members or change business settings.",
        "builtInKey": "manager",
        "isBuiltIn": true,
        "permissionCount": 77,
        "memberCount": 0,
        "areaLevels": [
          {
            "area": "orders",
            "level": "custom"
          },
          {
            "area": "tracking",
            "level": "full"
          },
          {
            "area": "catalog",
            "level": "custom"
          },
          {
            "area": "offers",
            "level": "custom"
          },
          {
            "area": "inventory",
            "level": "full"
          },
          {
            "area": "finance",
            "level": "custom"
          },
          {
            "area": "analytics",
            "level": "full"
          },
          {
            "area": "team",
            "level": "custom"
          },
          {
            "area": "delivery",
            "level": "custom"
          },
          {
            "area": "store",
            "level": "custom"
          },
          {
            "area": "apps",
            "level": "custom"
          },
          {
            "area": "settings",
            "level": "view"
          }
        ]
      },
      {
        "id": "245593672379277314",
        "name": "Order manager",
        "description": "Can handle orders from creation to delivery, returns and buyers, and nothing else.",
        "builtInKey": "order-manager",
        "isBuiltIn": true,
        "permissionCount": 19,
        "memberCount": 0,
        "areaLevels": [
          {
            "area": "orders",
            "level": "full"
          },
          {
            "area": "tracking",
            "level": "none"
          },
          {
            "area": "catalog",
            "level": "none"
          },
          {
            "area": "offers",
            "level": "none"
          },
          {
            "area": "inventory",
            "level": "none"
          },
          {
            "area": "finance",
            "level": "none"
          },
          {
            "area": "analytics",
            "level": "none"
          },
          {
            "area": "team",
            "level": "none"
          },
          {
            "area": "delivery",
            "level": "none"
          },
          {
            "area": "store",
            "level": "none"
          },
          {
            "area": "apps",
            "level": "none"
          },
          {
            "area": "settings",
            "level": "none"
          }
        ]
      },
      {
        "id": "245593672379277317",
        "name": "Order tracker",
        "description": "Can follow shipments and update their status, and nothing else.",
        "builtInKey": "order-tracker",
        "isBuiltIn": true,
        "permissionCount": 3,
        "memberCount": 0,
        "areaLevels": [
          {
            "area": "orders",
            "level": "none"
          },
          {
            "area": "tracking",
            "level": "full"
          },
          {
            "area": "catalog",
            "level": "none"
          },
          {
            "area": "offers",
            "level": "none"
          },
          {
            "area": "inventory",
            "level": "none"
          },
          {
            "area": "finance",
            "level": "none"
          },
          {
            "area": "analytics",
            "level": "none"
          },
          {
            "area": "team",
            "level": "none"
          },
          {
            "area": "delivery",
            "level": "none"
          },
          {
            "area": "store",
            "level": "none"
          },
          {
            "area": "apps",
            "level": "none"
          },
          {
            "area": "settings",
            "level": "none"
          }
        ]
      },
      {
        "id": "<ROLE_OWNER>",
        "name": "Owner",
        "description": "Can do everything in the business, including deleting records and changing settings.",
        "builtInKey": "owner",
        "isBuiltIn": true,
        "permissionCount": 93,
        "memberCount": 1,
        "areaLevels": [
          {
            "area": "orders",
            "level": "full"
          },
          {
            "area": "tracking",
            "level": "full"
          },
          {
            "area": "catalog",
            "level": "full"
          },
          {
            "area": "offers",
            "level": "full"
          },
          {
            "area": "inventory",
            "level": "full"
          },
          {
            "area": "finance",
            "level": "full"
          },
          {
            "area": "analytics",
            "level": "full"
          },
          {
            "area": "team",
            "level": "full"
          },
          {
            "area": "delivery",
            "level": "full"
          },
          {
            "area": "store",
            "level": "full"
          },
          {
            "area": "apps",
            "level": "full"
          },
          {
            "area": "settings",
            "level": "full"
          }
        ]
      },
      {
        "id": "245593672379277318",
        "name": "Store manager",
        "description": "Can run the storefront, its pages and domains, and maintain products and collections.",
        "builtInKey": "store-manager",
        "isBuiltIn": true,
        "permissionCount": 23,
        "memberCount": 0,
        "areaLevels": [
          {
            "area": "orders",
            "level": "none"
          },
          {
            "area": "tracking",
            "level": "none"
          },
          {
            "area": "catalog",
            "level": "full"
          },
          {
            "area": "offers",
            "level": "none"
          },
          {
            "area": "inventory",
            "level": "none"
          },
          {
            "area": "finance",
            "level": "none"
          },
          {
            "area": "analytics",
            "level": "none"
          },
          {
            "area": "team",
            "level": "none"
          },
          {
            "area": "delivery",
            "level": "none"
          },
          {
            "area": "store",
            "level": "full"
          },
          {
            "area": "apps",
            "level": "none"
          },
          {
            "area": "settings",
            "level": "none"
          }
        ]
      }
    ]
  }
}
```

### First api: the member is moved to a role without team.roles.view

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
        "<ROLE_CLERK>"
      ],
      "storeAccess": "selected",
      "storeIds": [
        "<STORE_DEMO>"
      ]
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "setMemberAccess": {
      "administratorId": "4",
      "roles": [
        {
          "id": "<ROLE_CLERK>",
          "name": "Demo orders clerk"
        }
      ],
      "storeAccess": "selected",
      "storeIds": [
        "<STORE_DEMO>"
      ]
    }
  }
}
```

### Second api, next request: FORBIDDEN

```http
POST http://127.0.0.1:23101/admin-api?languageCode=en
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

