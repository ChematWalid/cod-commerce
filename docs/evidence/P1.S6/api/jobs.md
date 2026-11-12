# Jobs health and scheduled tasks

`platformJobsHealth` is staff-only (D120): the outbox backlog and the age of each platform task's last success. `runScheduledTask` runs the sweeper and the reconciler on demand.

### platformJobsHealth before running the tasks

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]

{
  "query": "query { platformJobsHealth { outboxPending outboxOldestPendingAgeSeconds tasks { id lastSuccessAgeSeconds } } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "platformJobsHealth": {
      "outboxPending": 0,
      "outboxOldestPendingAgeSeconds": null,
      "tasks": [
        {
          "id": "account-token-purge",
          "lastSuccessAgeSeconds": null
        },
        {
          "id": "clean-job-queue-index",
          "lastSuccessAgeSeconds": null
        },
        {
          "id": "clean-orphaned-settings-store",
          "lastSuccessAgeSeconds": null
        },
        {
          "id": "clean-sessions",
          "lastSuccessAgeSeconds": null
        },
        {
          "id": "inbound-webhook-key-purge",
          "lastSuccessAgeSeconds": null
        },
        {
          "id": "job-reconciler",
          "lastSuccessAgeSeconds": null
        },
        {
          "id": "outbox-sweeper",
          "lastSuccessAgeSeconds": 14
        },
        {
          "id": "partition-maintenance",
          "lastSuccessAgeSeconds": null
        },
        {
          "id": "tenant-secret-kek-rotation",
          "lastSuccessAgeSeconds": null
        }
      ]
    }
  }
}
```

### The merchant owner asks for platformJobsHealth: FORBIDDEN

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query { platformJobsHealth { outboxPending outboxOldestPendingAgeSeconds tasks { id lastSuccessAgeSeconds } } }",
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
        "platformJobsHealth"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### runScheduledTask outbox-sweeper

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]

{
  "query": "mutation ($id: String!) { runScheduledTask(id: $id) { success } }",
  "variables": {
    "id": "outbox-sweeper"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "runScheduledTask": {
      "success": true
    }
  }
}
```

### runScheduledTask job-reconciler

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]

{
  "query": "mutation ($id: String!) { runScheduledTask(id: $id) { success } }",
  "variables": {
    "id": "job-reconciler"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "runScheduledTask": {
      "success": true
    }
  }
}
```

### platformJobsHealth after: both tasks report a success within the last 30 seconds

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]

{
  "query": "query { platformJobsHealth { outboxPending outboxOldestPendingAgeSeconds tasks { id lastSuccessAgeSeconds } } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "platformJobsHealth": {
      "outboxPending": 0,
      "outboxOldestPendingAgeSeconds": null,
      "tasks": [
        {
          "id": "account-token-purge",
          "lastSuccessAgeSeconds": null
        },
        {
          "id": "clean-job-queue-index",
          "lastSuccessAgeSeconds": null
        },
        {
          "id": "clean-orphaned-settings-store",
          "lastSuccessAgeSeconds": null
        },
        {
          "id": "clean-sessions",
          "lastSuccessAgeSeconds": null
        },
        {
          "id": "inbound-webhook-key-purge",
          "lastSuccessAgeSeconds": null
        },
        {
          "id": "job-reconciler",
          "lastSuccessAgeSeconds": 2
        },
        {
          "id": "outbox-sweeper",
          "lastSuccessAgeSeconds": 2
        },
        {
          "id": "partition-maintenance",
          "lastSuccessAgeSeconds": null
        },
        {
          "id": "tenant-secret-kek-rotation",
          "lastSuccessAgeSeconds": null
        }
      ]
    }
  }
}
```

