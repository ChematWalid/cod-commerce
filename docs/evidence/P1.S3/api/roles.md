# Roles

GraphQL and REST for create, read, update, duplicate and delete, each followed by the activity row it wrote.

### businessRoles: 7 built-ins and the seeded custom roles

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
  "data": {
    "businessRoles": [
      {
        "id": "247026518507659268",
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
        "id": "247026527185674240",
        "name": "Demo first store catalog",
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
            "level": "custom"
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
        "id": "247026524450988032",
        "name": "Demo no view",
        "description": null,
        "builtInKey": null,
        "isBuiltIn": false,
        "permissionCount": 0,
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
        "id": "247026525801553920",
        "name": "Demo settings viewer",
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
            "level": "none"
          },
          {
            "area": "delivery",
            "level": "none"
          },
          {
            "area": "store",
            "level": "custom"
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
        "id": "247026518507659267",
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
        "id": "247026518507659265",
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
        "id": "247026518507659266",
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
        "id": "247026518507659269",
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
        "permissionCount": 94,
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
        "id": "247026518507659270",
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
            "level": "custom"
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

### GET /roles

```http
GET http://127.0.0.1:23100/roles
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

[
  {
    "id": "247026518507659268",
    "name": "Accountant",
    "description": "Can keep the books and read every order, without changing orders.",
    "builtInKey": "accountant",
    "isBuiltIn": true,
    "permissions": [
      "finance.expenses.add",
      "finance.expenses.delete",
      "finance.expenses.edit",
      "finance.expenses.view",
      "finance.records.add",
      "finance.records.delete",
      "finance.records.view",
      "orders.customers.view",
      "orders.returns.view",
      "orders.view",
      "orders.view-all"
    ],
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
    ],
    "permissionCount": 11,
    "memberCount": 0,
    "updatedAt": "2026-11-13T15:55:11.543Z"
  },
  {
    "id": "247026527185674240",
    "name": "Demo first store catalog",
    "description": null,
    "builtInKey": null,
    "isBuiltIn": false,
    "permissions": [
      "catalog.products.view"
    ],
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
        "level": "custom"
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
    ],
    "permissionCount": 1,
    "memberCount": 1,
    "updatedAt": "2026-11-13T15:55:13.612Z"
  },
  {
    "id": "247026524450988032",
    "name": "Demo no view",
    "description": null,
    "builtInKey": null,
    "isBuiltIn": false,
    "permissions": [],
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
        "level": "none"
      }
    ],
    "permissionCount": 0,
    "memberCount": 1,
    "updatedAt": "2026-11-13T15:55:12.960Z"
  },
  {
    "id": "<ROLE_CLERK>",
    "name": "Demo orders clerk",
    "description": null,
    "builtInKey": null,
    "isBuiltIn": false,
    "permissions": [
      "orders.view"
    ],
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
    ],
    "permissionCount": 1,
    "memberCount": 1,
    "updatedAt": "2026-11-13T15:55:12.653Z"
  },
  {
    "id": "247026525801553920",
    "name": "Demo settings viewer",
    "description": null,
    "builtInKey": null,
    "isBuiltIn": false,
    "permissions": [
      "settings.business.view",
      "store.stores.view"
    ],
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
        "level": "custom"
      },
      {
        "area": "apps",
        "level": "none"
      },
      {
        "area": "settings",
        "level": "custom"
      }
    ],
    "permissionCount": 2,
    "memberCount": 1,
    "updatedAt": "2026-11-13T15:55:13.282Z"
  },
  {
    "id": "<ROLE_VIEWER>",
    "name": "Demo viewer",
    "description": null,
    "builtInKey": null,
    "isBuiltIn": false,
    "permissions": [
      "settings.activity-log.view",
      "team.roles.view"
    ],
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
    ],
    "permissionCount": 2,
    "memberCount": 1,
    "updatedAt": "2026-11-13T15:55:12.340Z"
  },
  {
    "id": "247026518507659267",
    "name": "Inventory manager",
    "description": "Can keep products, collections and stock up to date, including purchase prices.",
    "builtInKey": "inventory-manager",
    "isBuiltIn": true,
    "permissions": [
      "catalog.collections.create",
      "catalog.collections.delete",
      "catalog.collections.edit",
      "catalog.collections.view",
      "catalog.products.create",
      "catalog.products.delete",
      "catalog.products.edit",
      "catalog.products.view",
      "inventory.buy-prices",
      "inventory.stock.add",
      "inventory.stock.adjust",
      "inventory.stock.view"
    ],
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
    ],
    "permissionCount": 12,
    "memberCount": 0,
    "updatedAt": "2026-11-13T15:55:11.543Z"
  },
  {
    "id": "247026518507659265",
    "name": "Manager",
    "description": "Can do everything except delete records, remove members or change business settings.",
    "builtInKey": "manager",
    "isBuiltIn": true,
    "permissions": [
      "analytics.view",
      "analytics.visitors.view",
      "apps.cargo.request",
      "apps.cargo.view",
      "apps.connect",
      "apps.manage",
      "apps.view",
      "apps.whatsapp.manage",
      "apps.whatsapp.view",
      "catalog.collections.create",
      "catalog.collections.edit",
      "catalog.collections.view",
      "catalog.products.create",
      "catalog.products.edit",
      "catalog.products.view",
      "delivery.carriers.connect",
      "delivery.carriers.edit",
      "delivery.carriers.view",
      "delivery.pricing.create",
      "delivery.pricing.edit",
      "delivery.pricing.view",
      "finance.expenses.add",
      "finance.expenses.edit",
      "finance.expenses.view",
      "finance.records.add",
      "finance.records.view",
      "inventory.buy-prices",
      "inventory.stock.add",
      "inventory.stock.adjust",
      "inventory.stock.view",
      "offers.create",
      "offers.edit",
      "offers.view",
      "orders.cancel",
      "orders.comment",
      "orders.confirm",
      "orders.create",
      "orders.customers.manage",
      "orders.customers.view",
      "orders.discount",
      "orders.dispatch",
      "orders.edit",
      "orders.mark-delivered",
      "orders.print-labels",
      "orders.returns.create",
      "orders.returns.process",
      "orders.returns.view",
      "orders.schedule",
      "orders.view",
      "orders.view-all",
      "settings.activity-log.view",
      "settings.business.view",
      "store.builder.open",
      "store.discard",
      "store.domains.connect",
      "store.domains.edit",
      "store.domains.view",
      "store.landing-pages.create",
      "store.landing-pages.edit",
      "store.landing-pages.view",
      "store.pages.edit",
      "store.publish",
      "store.settings.edit",
      "store.stores.create",
      "store.stores.view",
      "team.commissions.edit",
      "team.commissions.set",
      "team.commissions.view",
      "team.members.edit",
      "team.members.invite",
      "team.members.view",
      "team.roles.create",
      "team.roles.edit",
      "team.roles.view",
      "tracking.update",
      "tracking.view",
      "tracking.view-all"
    ],
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
    ],
    "permissionCount": 77,
    "memberCount": 0,
    "updatedAt": "2026-11-13T15:55:11.543Z"
  },
  {
    "id": "247026518507659266",
    "name": "Order manager",
    "description": "Can handle orders from creation to delivery, returns and buyers, and nothing else.",
    "builtInKey": "order-manager",
    "isBuiltIn": true,
    "permissions": [
      "orders.cancel",
      "orders.comment",
      "orders.comments.delete",
      "orders.confirm",
      "orders.create",
      "orders.customers.manage",
      "orders.customers.view",
      "orders.delete",
      "orders.discount",
      "orders.dispatch",
      "orders.edit",
      "orders.mark-delivered",
      "orders.print-labels",
      "orders.returns.create",
      "orders.returns.process",
      "orders.returns.view",
      "orders.schedule",
      "orders.view",
      "orders.view-all"
    ],
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
    ],
    "permissionCount": 19,
    "memberCount": 0,
    "updatedAt": "2026-11-13T15:55:11.543Z"
  },
  {
    "id": "247026518507659269",
    "name": "Order tracker",
    "description": "Can follow shipments and update their status, and nothing else.",
    "builtInKey": "order-tracker",
    "isBuiltIn": true,
    "permissions": [
      "tracking.update",
      "tracking.view",
      "tracking.view-all"
    ],
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
    ],
    "permissionCount": 3,
    "memberCount": 0,
    "updatedAt": "2026-11-13T15:55:11.543Z"
  },
  {
    "id": "<ROLE_OWNER>",
    "name": "Owner",
    "description": "Can do everything in the business, including deleting records and changing settings.",
    "builtInKey": "owner",
    "isBuiltIn": true,
    "permissions": [
      "analytics.view",
      "analytics.visitors.view",
      "apps.cargo.request",
      "apps.cargo.view",
      "apps.connect",
      "apps.disconnect",
      "apps.manage",
      "apps.view",
      "apps.whatsapp.manage",
      "apps.whatsapp.view",
      "catalog.collections.create",
      "catalog.collections.delete",
      "catalog.collections.edit",
      "catalog.collections.view",
      "catalog.products.create",
      "catalog.products.delete",
      "catalog.products.edit",
      "catalog.products.view",
      "delivery.carriers.connect",
      "delivery.carriers.delete",
      "delivery.carriers.edit",
      "delivery.carriers.view",
      "delivery.pricing.create",
      "delivery.pricing.delete",
      "delivery.pricing.edit",
      "delivery.pricing.view",
      "finance.expenses.add",
      "finance.expenses.delete",
      "finance.expenses.edit",
      "finance.expenses.view",
      "finance.records.add",
      "finance.records.delete",
      "finance.records.view",
      "inventory.buy-prices",
      "inventory.stock.add",
      "inventory.stock.adjust",
      "inventory.stock.view",
      "offers.create",
      "offers.delete",
      "offers.edit",
      "offers.view",
      "orders.cancel",
      "orders.comment",
      "orders.comments.delete",
      "orders.confirm",
      "orders.create",
      "orders.customers.manage",
      "orders.customers.view",
      "orders.delete",
      "orders.discount",
      "orders.dispatch",
      "orders.edit",
      "orders.mark-delivered",
      "orders.print-labels",
      "orders.returns.create",
      "orders.returns.process",
      "orders.returns.view",
      "orders.schedule",
      "orders.view",
      "orders.view-all",
      "settings.activity-log.view",
      "settings.business.edit",
      "settings.business.view",
      "store.builder.open",
      "store.discard",
      "store.domains.connect",
      "store.domains.edit",
      "store.domains.remove",
      "store.domains.view",
      "store.landing-pages.create",
      "store.landing-pages.delete",
      "store.landing-pages.edit",
      "store.landing-pages.view",
      "store.pages.edit",
      "store.publish",
      "store.settings.edit",
      "store.stores.archive",
      "store.stores.create",
      "store.stores.view",
      "team.commissions.delete",
      "team.commissions.edit",
      "team.commissions.set",
      "team.commissions.view",
      "team.members.edit",
      "team.members.invite",
      "team.members.remove",
      "team.members.view",
      "team.roles.create",
      "team.roles.delete",
      "team.roles.edit",
      "team.roles.view",
      "tracking.update",
      "tracking.view",
      "tracking.view-all"
    ],
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
    ],
    "permissionCount": 94,
    "memberCount": 1,
    "updatedAt": "2026-11-13T15:55:11.543Z"
  },
  {
    "id": "247026518507659270",
    "name": "Store manager",
    "description": "Can run the storefront, its pages and domains, and maintain products and collections.",
    "builtInKey": "store-manager",
    "isBuiltIn": true,
    "permissions": [
      "catalog.collections.create",
      "catalog.collections.delete",
      "catalog.collections.edit",
      "catalog.collections.view",
      "catalog.products.create",
      "catalog.products.delete",
      "catalog.products.edit",
      "catalog.products.view",
      "store.builder.open",
      "store.discard",
      "store.domains.connect",
      "store.domains.edit",
      "store.domains.remove",
      "store.domains.view",
      "store.landing-pages.create",
      "store.landing-pages.delete",
      "store.landing-pages.edit",
      "store.landing-pages.view",
      "store.pages.edit",
      "store.publish",
      "store.settings.edit",
      "store.stores.create",
      "store.stores.view"
    ],
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
        "level": "custom"
      },
      {
        "area": "apps",
        "level": "none"
      },
      {
        "area": "settings",
        "level": "none"
      }
    ],
    "permissionCount": 23,
    "memberCount": 0,
    "updatedAt": "2026-11-13T15:55:11.543Z"
  }
]
```

### businessRole

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($id: String!) { businessRole(id: $id) { id name description builtInKey isBuiltIn permissionCount memberCount areaLevels { area level } } }",
  "variables": {
    "id": "<ROLE_VIEWER>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "businessRole": {
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

### GET /roles/:id

```http
GET http://127.0.0.1:23100/roles/<ROLE_VIEWER>
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "id": "<ROLE_VIEWER>",
  "name": "Demo viewer",
  "description": null,
  "builtInKey": null,
  "isBuiltIn": false,
  "permissions": [
    "settings.activity-log.view",
    "team.roles.view"
  ],
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
  ],
  "permissionCount": 2,
  "memberCount": 1,
  "updatedAt": "2026-11-13T15:55:12.340Z"
}
```

### createBusinessRole: Orders at View plus one sensitive grant

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($input: CreateBusinessRoleInput!) { createBusinessRole(input: $input) { id name description builtInKey isBuiltIn permissionCount memberCount areaLevels { area level } } }",
  "variables": {
    "input": {
      "name": "Evidence role",
      "areaLevels": [
        {
          "area": "orders",
          "level": "view"
        }
      ],
      "grants": [
        "orders.cancel"
      ]
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "createBusinessRole": {
      "id": "<ROLE_CREATED>",
      "name": "Evidence role",
      "description": null,
      "builtInKey": null,
      "isBuiltIn": false,
      "permissionCount": 4,
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
    }
  }
}
```

### activityLog: the row of that create

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($input: ActivityLogInput) { activityLog(input: $input) { items { id action entityType entityId summary diff actor { id name } storeId createdAt } nextCursor } }",
  "variables": {
    "input": {
      "entityId": "<ROLE_CREATED>"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "activityLog": {
      "items": [
        {
          "id": "247026652284981248",
          "action": "rbac.role.created",
          "entityType": "role",
          "entityId": "<ROLE_CREATED>",
          "summary": "Role Evidence role created",
          "diff": {
            "name": "Evidence role",
            "permissions": {
              "added": [
                "orders.cancel",
                "orders.customers.view",
                "orders.returns.view",
                "orders.view"
              ],
              "removed": []
            }
          },
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": null,
          "createdAt": "2026-11-13T15:55:43.438Z"
        }
      ],
      "nextCursor": null
    }
  }
}
```

### updateBusinessRole

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: String!, $input: UpdateBusinessRoleInput!) { updateBusinessRole(id: $id, input: $input) { id name description builtInKey isBuiltIn permissionCount memberCount areaLevels { area level } } }",
  "variables": {
    "id": "<ROLE_CREATED>",
    "input": {
      "name": "Evidence role renamed",
      "revokes": [
        "orders.cancel"
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
      "id": "<ROLE_CREATED>",
      "name": "Evidence role renamed",
      "description": null,
      "builtInKey": null,
      "isBuiltIn": false,
      "permissionCount": 3,
      "memberCount": 0,
      "areaLevels": [
        {
          "area": "orders",
          "level": "view"
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
    }
  }
}
```

### activityLog: the row of that update

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($input: ActivityLogInput) { activityLog(input: $input) { items { id action entityType entityId summary diff actor { id name } storeId createdAt } nextCursor } }",
  "variables": {
    "input": {
      "entityId": "<ROLE_CREATED>"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "activityLog": {
      "items": [
        {
          "id": "247026654973530112",
          "action": "rbac.role.updated",
          "entityType": "role",
          "entityId": "<ROLE_CREATED>",
          "summary": "Role Evidence role renamed updated",
          "diff": {
            "name": {
              "after": "Evidence role renamed",
              "before": "Evidence role"
            },
            "description": {
              "after": null,
              "before": null
            },
            "permissions": {
              "added": [],
              "removed": [
                "orders.cancel"
              ]
            }
          },
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": null,
          "createdAt": "2026-11-13T15:55:44.079Z"
        },
        {
          "id": "247026652284981248",
          "action": "rbac.role.created",
          "entityType": "role",
          "entityId": "<ROLE_CREATED>",
          "summary": "Role Evidence role created",
          "diff": {
            "name": "Evidence role",
            "permissions": {
              "added": [
                "orders.cancel",
                "orders.customers.view",
                "orders.returns.view",
                "orders.view"
              ],
              "removed": []
            }
          },
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": null,
          "createdAt": "2026-11-13T15:55:43.438Z"
        }
      ],
      "nextCursor": null
    }
  }
}
```

### duplicateBusinessRole

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: String!, $locale: String) { duplicateBusinessRole(id: $id, locale: $locale) { id name description builtInKey isBuiltIn permissionCount memberCount areaLevels { area level } } }",
  "variables": {
    "id": "<ROLE_CREATED>",
    "locale": "en"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "duplicateBusinessRole": {
      "id": "<ROLE_COPY>",
      "name": "Evidence role renamed (copy)",
      "description": null,
      "builtInKey": null,
      "isBuiltIn": false,
      "permissionCount": 3,
      "memberCount": 0,
      "areaLevels": [
        {
          "area": "orders",
          "level": "view"
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
    }
  }
}
```

### activityLog: the row of that duplicate

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($input: ActivityLogInput) { activityLog(input: $input) { items { id action entityType entityId summary diff actor { id name } storeId createdAt } nextCursor } }",
  "variables": {
    "input": {
      "entityId": "<ROLE_COPY>"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "activityLog": {
      "items": [
        {
          "id": "247026657158762496",
          "action": "rbac.role.duplicated",
          "entityType": "role",
          "entityId": "<ROLE_COPY>",
          "summary": "Role Evidence role renamed (copy) created",
          "diff": {
            "name": "Evidence role renamed (copy)",
            "permissions": {
              "added": [
                "orders.customers.view",
                "orders.returns.view",
                "orders.view"
              ],
              "removed": []
            }
          },
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": null,
          "createdAt": "2026-11-13T15:55:44.600Z"
        }
      ],
      "nextCursor": null
    }
  }
}
```

### deleteBusinessRole

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: String!) { deleteBusinessRole(id: $id) { success } }",
  "variables": {
    "id": "<ROLE_COPY>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "deleteBusinessRole": {
      "success": true
    }
  }
}
```

### activityLog: the row of that delete

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($input: ActivityLogInput) { activityLog(input: $input) { items { id action entityType entityId summary diff actor { id name } storeId createdAt } nextCursor } }",
  "variables": {
    "input": {
      "entityId": "<ROLE_COPY>"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "activityLog": {
      "items": [
        {
          "id": "247026659583070208",
          "action": "rbac.role.deleted",
          "entityType": "role",
          "entityId": "<ROLE_COPY>",
          "summary": "Role Evidence role renamed (copy) deleted",
          "diff": {
            "name": "Evidence role renamed (copy)",
            "permissions": {
              "added": [],
              "removed": [
                "orders.customers.view",
                "orders.returns.view",
                "orders.view"
              ]
            }
          },
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": null,
          "createdAt": "2026-11-13T15:55:45.179Z"
        },
        {
          "id": "247026657158762496",
          "action": "rbac.role.duplicated",
          "entityType": "role",
          "entityId": "<ROLE_COPY>",
          "summary": "Role Evidence role renamed (copy) created",
          "diff": {
            "name": "Evidence role renamed (copy)",
            "permissions": {
              "added": [
                "orders.customers.view",
                "orders.returns.view",
                "orders.view"
              ],
              "removed": []
            }
          },
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": null,
          "createdAt": "2026-11-13T15:55:44.600Z"
        }
      ],
      "nextCursor": null
    }
  }
}
```

### POST /roles

```http
POST http://127.0.0.1:23100/roles
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "name": "Evidence rest role",
  "areaLevels": [
    {
      "area": "finance",
      "level": "view"
    }
  ]
}

HTTP/1.1 201 Created
content-type: application/json; charset=utf-8

{
  "id": "<ROLE_REST>",
  "name": "Evidence rest role",
  "description": null,
  "builtInKey": null,
  "isBuiltIn": false,
  "permissions": [
    "finance.expenses.view",
    "finance.records.view"
  ],
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
      "level": "view"
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
  ],
  "permissionCount": 2,
  "memberCount": 0,
  "updatedAt": "2026-11-13T15:55:45.830Z"
}
```

### PATCH /roles/:id

```http
PATCH http://127.0.0.1:23100/roles/<ROLE_REST>
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "description": "Changed through REST"
}

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "id": "<ROLE_REST>",
  "name": "Evidence rest role",
  "description": "Changed through REST",
  "builtInKey": null,
  "isBuiltIn": false,
  "permissions": [
    "finance.expenses.view",
    "finance.records.view"
  ],
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
      "level": "view"
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
  ],
  "permissionCount": 2,
  "memberCount": 0,
  "updatedAt": "2026-11-13T15:55:45.947Z"
}
```

### POST /roles/:id/duplicate

```http
POST http://127.0.0.1:23100/roles/<ROLE_REST>/duplicate
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{}

HTTP/1.1 201 Created
content-type: application/json; charset=utf-8

{
  "id": "<ROLE_REST_COPY>",
  "name": "Evidence rest role (copy)",
  "description": "Changed through REST",
  "builtInKey": null,
  "isBuiltIn": false,
  "permissions": [
    "finance.expenses.view",
    "finance.records.view"
  ],
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
      "level": "view"
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
  ],
  "permissionCount": 2,
  "memberCount": 0,
  "updatedAt": "2026-11-13T15:55:46.023Z"
}
```

### DELETE /roles/:id

```http
DELETE http://127.0.0.1:23100/roles/<ROLE_REST_COPY>
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "success": true
}
```

