# The partitioned, append-only activity log

`activity_log` is range-partitioned by month on `createdAt` with its partitions kept ahead by the maintenance task (D123); a row trigger refuses `UPDATE` and `DELETE`. The activity API reads across the partitions unchanged.

### The partitions, from the catalog (none is a DEFAULT partition)

```sql
select c.relname as partition, pg_get_expr(c.relpartbound, c.oid) as bounds from pg_inherits i join pg_class c on c.oid = i.inhrelid where i.inhparent = 'activity_log'::regclass order by 1;
```

```text
      partition       |                                  bounds                                  
----------------------+--------------------------------------------------------------------------
 activity_log_p202611 | FOR VALUES FROM ('2026-11-01 00:00:00+00') TO ('2026-12-01 00:00:00+00')
 activity_log_p202612 | FOR VALUES FROM ('2026-12-01 00:00:00+00') TO ('2027-01-01 00:00:00+00')
 activity_log_p202701 | FOR VALUES FROM ('2027-01-01 00:00:00+00') TO ('2027-02-01 00:00:00+00')
 activity_log_p202702 | FOR VALUES FROM ('2027-02-01 00:00:00+00') TO ('2027-03-01 00:00:00+00')
(4 rows)
```

### A row in a later month's partition (the current month plus three are already made)

```sql
insert into activity_log ("businessId", "storeId", id, "actorAdministratorId", action, "entityType", "entityId", summary, diff, ip, "userAgent", "createdAt") select "businessId", "storeId", id + 1, "actorAdministratorId", 'evidence.later-month', "entityType", "entityId", 'A row in the next month''s partition', diff, ip, "userAgent", date_trunc('month', now()) + interval '1 month 3 days' from activity_log order by id desc limit 1;
```

```text
INSERT 0 1
```

### Which partition holds each row

```sql
select tableoid::regclass as partition, action, summary from activity_log order by "createdAt", id;
```

```text
      partition       |           action           |                summary                
----------------------+----------------------------+---------------------------------------
 activity_log_p202611 | rbac.role.created          | Role Demo viewer created
 activity_log_p202611 | rbac.member-access.changed | Member access changed
 activity_log_p202611 | rbac.role.created          | Role Demo orders clerk created
 activity_log_p202611 | rbac.member-access.changed | Member access changed
 activity_log_p202611 | rbac.role.created          | Role Demo no view created
 activity_log_p202611 | rbac.member-access.changed | Member access changed
 activity_log_p202611 | rbac.role.created          | Role Demo settings viewer created
 activity_log_p202611 | rbac.member-access.changed | Member access changed
 activity_log_p202611 | rbac.role.created          | Role Demo first store catalog created
 activity_log_p202611 | rbac.member-access.changed | Member access changed
 activity_log_p202611 | rbac.role.created          | Role Evidence role created
 activity_log_p202612 | evidence.later-month       | A row in the next month's partition
(12 rows)
```

### UPDATE is refused

```sql
update activity_log set summary = 'tampered';
```

```text
ERROR:  activity_log is append-only
CONTEXT:  PL/pgSQL function activity_log_append_only() line 3 at RAISE
```

### DELETE is refused

```sql
delete from activity_log;
```

```text
ERROR:  activity_log is append-only
CONTEXT:  PL/pgSQL function activity_log_append_only() line 3 at RAISE
```

### activityLog (owner of A): lists the rows of both partitions

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query { activityLog(input: { first: 20 }) { items { action summary createdAt } nextCursor } }",
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
          "action": "evidence.later-month",
          "summary": "A row in the next month's partition",
          "createdAt": "2026-12-04T00:00:00.000Z"
        },
        {
          "action": "rbac.role.created",
          "summary": "Role Evidence role created",
          "createdAt": "2026-11-12T21:01:48.283Z"
        },
        {
          "action": "rbac.member-access.changed",
          "summary": "Member access changed",
          "createdAt": "2026-11-12T21:00:54.613Z"
        },
        {
          "action": "rbac.role.created",
          "summary": "Role Demo first store catalog created",
          "createdAt": "2026-11-12T21:00:54.320Z"
        },
        {
          "action": "rbac.member-access.changed",
          "summary": "Member access changed",
          "createdAt": "2026-11-12T21:00:54.296Z"
        },
        {
          "action": "rbac.role.created",
          "summary": "Role Demo settings viewer created",
          "createdAt": "2026-11-12T21:00:54.028Z"
        },
        {
          "action": "rbac.member-access.changed",
          "summary": "Member access changed",
          "createdAt": "2026-11-12T21:00:53.988Z"
        },
        {
          "action": "rbac.role.created",
          "summary": "Role Demo no view created",
          "createdAt": "2026-11-12T21:00:53.723Z"
        },
        {
          "action": "rbac.member-access.changed",
          "summary": "Member access changed",
          "createdAt": "2026-11-12T21:00:53.698Z"
        },
        {
          "action": "rbac.role.created",
          "summary": "Role Demo orders clerk created",
          "createdAt": "2026-11-12T21:00:53.429Z"
        },
        {
          "action": "rbac.member-access.changed",
          "summary": "Member access changed",
          "createdAt": "2026-11-12T21:00:53.404Z"
        },
        {
          "action": "rbac.role.created",
          "summary": "Role Demo viewer created",
          "createdAt": "2026-11-12T21:00:53.122Z"
        }
      ],
      "nextCursor": null
    }
  }
}
```

### activityLog (owner of B): none of A's rows

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query { activityLog(input: { first: 20 }) { items { action summary createdAt } nextCursor } }",
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

