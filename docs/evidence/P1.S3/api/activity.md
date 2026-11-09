# Activity log

Newest first, with a cursor. A limited member with settings.activity-log.view sees the rows of the stores they can reach.

### activityLog, first page

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($input: ActivityLogInput) { activityLog(input: $input) { items { id action entityType entityId summary diff actor { id name } storeId createdAt } nextCursor } }",
  "variables": {
    "input": {
      "first": 5
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
          "id": "245593857746538496",
          "action": "rbac.member-access.changed",
          "entityType": "member",
          "entityId": "4",
          "summary": "Member access changed",
          "diff": {
            "after": {
              "roleIds": [
                "<ROLE_VIEWER>"
              ],
              "storeIds": [
                "<STORE_DEMO>"
              ],
              "storeAccess": "selected"
            },
            "before": {
              "roleIds": [
                "<ROLE_VIEWER>",
                "<ROLE_CLERK>"
              ],
              "storeIds": [
                "<STORE_DEMO>"
              ],
              "storeAccess": "selected"
            }
          },
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": null,
          "createdAt": "2026-11-09T17:02:18.600Z"
        },
        {
          "id": "245593855397728256",
          "action": "rbac.member-access.changed",
          "entityType": "member",
          "entityId": "4",
          "summary": "Member access changed",
          "diff": {
            "after": {
              "roleIds": [
                "<ROLE_VIEWER>",
                "<ROLE_CLERK>"
              ],
              "storeIds": [
                "<STORE_DEMO>"
              ],
              "storeAccess": "selected"
            },
            "before": {
              "roleIds": [
                "<ROLE_VIEWER>"
              ],
              "storeIds": [
                "<STORE_DEMO>"
              ],
              "storeAccess": "selected"
            }
          },
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": null,
          "createdAt": "2026-11-09T17:02:18.040Z"
        },
        {
          "id": "245593853099249664",
          "action": "rbac.role.deleted",
          "entityType": "role",
          "entityId": "<ROLE_REST>",
          "summary": "Role Evidence rest role deleted",
          "diff": {
            "name": "Evidence rest role",
            "permissions": {
              "added": [],
              "removed": [
                "finance.expenses.view",
                "finance.records.view"
              ]
            }
          },
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": null,
          "createdAt": "2026-11-09T17:02:17.492Z"
        },
        {
          "id": "245593852751122432",
          "action": "rbac.role.deleted",
          "entityType": "role",
          "entityId": "<ROLE_REST_COPY>",
          "summary": "Role Evidence rest role (copy) deleted",
          "diff": {
            "name": "Evidence rest role (copy)",
            "permissions": {
              "added": [],
              "removed": [
                "finance.expenses.view",
                "finance.records.view"
              ]
            }
          },
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": null,
          "createdAt": "2026-11-09T17:02:17.409Z"
        },
        {
          "id": "<ACTIVITY_CURSOR>",
          "action": "rbac.role.duplicated",
          "entityType": "role",
          "entityId": "<ROLE_REST_COPY>",
          "summary": "Role Evidence rest role (copy) created",
          "diff": {
            "name": "Evidence rest role (copy)",
            "permissions": {
              "added": [
                "finance.expenses.view",
                "finance.records.view"
              ],
              "removed": []
            }
          },
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": null,
          "createdAt": "2026-11-09T17:02:17.299Z"
        }
      ],
      "nextCursor": "<ACTIVITY_CURSOR>"
    }
  }
}
```

### activityLog, next page

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($input: ActivityLogInput) { activityLog(input: $input) { items { id action entityType entityId summary diff actor { id name } storeId createdAt } nextCursor } }",
  "variables": {
    "input": {
      "first": 5,
      "after": "<ACTIVITY_CURSOR>"
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
          "id": "245593851698352128",
          "action": "rbac.role.updated",
          "entityType": "role",
          "entityId": "<ROLE_REST>",
          "summary": "Role Evidence rest role updated",
          "diff": {
            "name": {
              "after": "Evidence rest role",
              "before": "Evidence rest role"
            },
            "description": {
              "after": "Changed through REST",
              "before": null
            },
            "permissions": {
              "added": [],
              "removed": []
            }
          },
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": null,
          "createdAt": "2026-11-09T17:02:17.158Z"
        },
        {
          "id": "245593851018874881",
          "action": "rbac.role.created",
          "entityType": "role",
          "entityId": "<ROLE_REST>",
          "summary": "Role Evidence rest role created",
          "diff": {
            "name": "Evidence rest role",
            "permissions": {
              "added": [
                "finance.expenses.view",
                "finance.records.view"
              ],
              "removed": []
            }
          },
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": null,
          "createdAt": "2026-11-09T17:02:16.996Z"
        },
        {
          "id": "245593850536529920",
          "action": "rbac.role.deleted",
          "entityType": "role",
          "entityId": "<ROLE_CREATED>",
          "summary": "Role Evidence role renamed deleted",
          "diff": {
            "name": "Evidence role renamed",
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
          "createdAt": "2026-11-09T17:02:16.881Z"
        },
        {
          "id": "245593848397434880",
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
          "createdAt": "2026-11-09T17:02:16.371Z"
        },
        {
          "id": "245593845813743616",
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
          "createdAt": "2026-11-09T17:02:15.755Z"
        }
      ],
      "nextCursor": "245593845813743616"
    }
  }
}
```

### activityLog, a limited member on one selected store: only that store's rows and business-wide rows

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
      "items": [
        {
          "id": "245593857746538496",
          "action": "rbac.member-access.changed",
          "entityType": "member",
          "entityId": "4",
          "summary": "Member access changed",
          "diff": {
            "after": {
              "roleIds": [
                "<ROLE_VIEWER>"
              ],
              "storeIds": [
                "<STORE_DEMO>"
              ],
              "storeAccess": "selected"
            },
            "before": {
              "roleIds": [
                "<ROLE_VIEWER>",
                "<ROLE_CLERK>"
              ],
              "storeIds": [
                "<STORE_DEMO>"
              ],
              "storeAccess": "selected"
            }
          },
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": null,
          "createdAt": "2026-11-09T17:02:18.600Z"
        },
        {
          "id": "245593855397728256",
          "action": "rbac.member-access.changed",
          "entityType": "member",
          "entityId": "4",
          "summary": "Member access changed",
          "diff": {
            "after": {
              "roleIds": [
                "<ROLE_VIEWER>",
                "<ROLE_CLERK>"
              ],
              "storeIds": [
                "<STORE_DEMO>"
              ],
              "storeAccess": "selected"
            },
            "before": {
              "roleIds": [
                "<ROLE_VIEWER>"
              ],
              "storeIds": [
                "<STORE_DEMO>"
              ],
              "storeAccess": "selected"
            }
          },
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": null,
          "createdAt": "2026-11-09T17:02:18.040Z"
        },
        {
          "id": "245593853099249664",
          "action": "rbac.role.deleted",
          "entityType": "role",
          "entityId": "<ROLE_REST>",
          "summary": "Role Evidence rest role deleted",
          "diff": {
            "name": "Evidence rest role",
            "permissions": {
              "added": [],
              "removed": [
                "finance.expenses.view",
                "finance.records.view"
              ]
            }
          },
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": null,
          "createdAt": "2026-11-09T17:02:17.492Z"
        },
        {
          "id": "245593852751122432",
          "action": "rbac.role.deleted",
          "entityType": "role",
          "entityId": "<ROLE_REST_COPY>",
          "summary": "Role Evidence rest role (copy) deleted",
          "diff": {
            "name": "Evidence rest role (copy)",
            "permissions": {
              "added": [],
              "removed": [
                "finance.expenses.view",
                "finance.records.view"
              ]
            }
          },
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": null,
          "createdAt": "2026-11-09T17:02:17.409Z"
        },
        {
          "id": "<ACTIVITY_CURSOR>",
          "action": "rbac.role.duplicated",
          "entityType": "role",
          "entityId": "<ROLE_REST_COPY>",
          "summary": "Role Evidence rest role (copy) created",
          "diff": {
            "name": "Evidence rest role (copy)",
            "permissions": {
              "added": [
                "finance.expenses.view",
                "finance.records.view"
              ],
              "removed": []
            }
          },
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": null,
          "createdAt": "2026-11-09T17:02:17.299Z"
        },
        {
          "id": "245593851698352128",
          "action": "rbac.role.updated",
          "entityType": "role",
          "entityId": "<ROLE_REST>",
          "summary": "Role Evidence rest role updated",
          "diff": {
            "name": {
              "after": "Evidence rest role",
              "before": "Evidence rest role"
            },
            "description": {
              "after": "Changed through REST",
              "before": null
            },
            "permissions": {
              "added": [],
              "removed": []
            }
          },
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": null,
          "createdAt": "2026-11-09T17:02:17.158Z"
        },
        {
          "id": "245593851018874881",
          "action": "rbac.role.created",
          "entityType": "role",
          "entityId": "<ROLE_REST>",
          "summary": "Role Evidence rest role created",
          "diff": {
            "name": "Evidence rest role",
            "permissions": {
              "added": [
                "finance.expenses.view",
                "finance.records.view"
              ],
              "removed": []
            }
          },
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": null,
          "createdAt": "2026-11-09T17:02:16.996Z"
        },
        {
          "id": "245593850536529920",
          "action": "rbac.role.deleted",
          "entityType": "role",
          "entityId": "<ROLE_CREATED>",
          "summary": "Role Evidence role renamed deleted",
          "diff": {
            "name": "Evidence role renamed",
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
          "createdAt": "2026-11-09T17:02:16.881Z"
        },
        {
          "id": "245593848397434880",
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
          "createdAt": "2026-11-09T17:02:16.371Z"
        },
        {
          "id": "245593845813743616",
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
          "createdAt": "2026-11-09T17:02:15.755Z"
        },
        {
          "id": "245593843460739072",
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
          "createdAt": "2026-11-09T17:02:15.194Z"
        },
        {
          "id": "245593841103540224",
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
          "createdAt": "2026-11-09T17:02:14.632Z"
        },
        {
          "id": "245593678662344704",
          "action": "rbac.member-access.changed",
          "entityType": "member",
          "entityId": "5",
          "summary": "Member access changed",
          "diff": {
            "after": {
              "roleIds": [
                "<ROLE_CLERK>"
              ],
              "storeIds": [],
              "storeAccess": "all"
            },
            "before": {
              "roleIds": [],
              "storeIds": [],
              "storeAccess": null
            }
          },
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": null,
          "createdAt": "2026-11-09T17:01:35.903Z"
        },
        {
          "id": "245593677202726912",
          "action": "rbac.role.created",
          "entityType": "role",
          "entityId": "<ROLE_CLERK>",
          "summary": "Role Demo orders clerk created",
          "diff": {
            "name": "Demo orders clerk",
            "permissions": {
              "added": [
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
          "createdAt": "2026-11-09T17:01:35.555Z"
        },
        {
          "id": "245593677076897792",
          "action": "rbac.member-access.changed",
          "entityType": "member",
          "entityId": "4",
          "summary": "Member access changed",
          "diff": {
            "after": {
              "roleIds": [
                "<ROLE_VIEWER>"
              ],
              "storeIds": [
                "<STORE_DEMO>"
              ],
              "storeAccess": "selected"
            },
            "before": {
              "roleIds": [],
              "storeIds": [],
              "storeAccess": null
            }
          },
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": null,
          "createdAt": "2026-11-09T17:01:35.525Z"
        },
        {
          "id": "245593675525005312",
          "action": "rbac.role.created",
          "entityType": "role",
          "entityId": "<ROLE_VIEWER>",
          "summary": "Role Demo viewer created",
          "diff": {
            "name": "Demo viewer",
            "permissions": {
              "added": [
                "settings.activity-log.view",
                "team.roles.view"
              ],
              "removed": []
            }
          },
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": null,
          "createdAt": "2026-11-09T17:01:35.155Z"
        }
      ],
      "nextCursor": null
    }
  }
}
```

### activityLog without the permission: FORBIDDEN

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
  "errors": [
    {
      "message": "You are not currently authorized to perform this action",
      "locations": [
        {
          "line": 1,
          "column": 36
        }
      ],
      "path": [
        "activityLog"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

