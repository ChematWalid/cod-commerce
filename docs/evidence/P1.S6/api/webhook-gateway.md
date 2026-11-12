# The inbound webhook gateway

`POST /webhooks/:provider/:accountKey` is public; the provider's signature is the authentication (D109). The demo provider `demo` takes a store's subdomain as the account key and verifies the HMAC-SHA-256 of the raw body under the business's own `demo-webhook`/`signing` secret (D110).

### The owner of A stores the demo signing secret (the value is write-only)

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($input: SetTenantSecretInput!) { setTenantSecret(input: $input) { id provider ref last4 updatedAt } }",
  "variables": {
    "input": {
      "provider": "demo-webhook",
      "ref": "signing",
      "value": "[REDACTED]"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "setTenantSecret": {
      "id": "<SECRET_A>",
      "provider": "demo-webhook",
      "ref": "signing",
      "last4": "0001",
      "updatedAt": "2026-11-12T13:27:20.316Z"
    }
  }
}
```

### A signed POST: 200

```http
POST http://127.0.0.1:23100/webhooks/demo/demo
Host: api.localhost
x-demo-signature: [REDACTED]
Content-Type: application/json

{
  "event": "evidence.order.created",
  "n": 1
}

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "status": "accepted"
}
```

### The same body again: 200, nothing is processed twice

```http
POST http://127.0.0.1:23100/webhooks/demo/demo
Host: api.localhost
x-demo-signature: [REDACTED]
Content-Type: application/json

{
  "event": "evidence.order.created",
  "n": 1
}

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "status": "accepted"
}
```

### One dedupe key

```sql
select provider, "accountId", count(*) as keys from inbound_webhook_key where provider = 'demo' group by 1, 2;
```

```text
 provider |     accountId      | keys 
----------+--------------------+------
 demo     | <STORE_DEMO> |    1
(1 row)
```

### One stored webhook, processed

```sql
select provider, status, attempts, "businessId" = <BUSINESS_DEMO> as "is business A", count(*) as rows from inbound_webhook where provider = 'demo' group by 1, 2, 3, 4;
```

```text
 provider |  status   | attempts | is business A | rows 
----------+-----------+----------+---------------+------
 demo     | processed |        1 | t             |    1
(1 row)
```

### The outbox event the handler wrote, relayed

```sql
select topic, status, count(*) as events from outbox_event where topic = 'platform.demo' group by 1, 2;
```

```text
     topic     | status  | events 
---------------+---------+--------
 platform.demo | relayed |      1
(1 row)
```

### The demo-log consumer finished its delivery

```sql
select consumer, status, attempts, count(*) as deliveries from outbox_delivery where consumer = 'demo-log' group by 1, 2, 3;
```

```text
 consumer | status | attempts | deliveries 
----------+--------+----------+------------
 demo-log | done   |        1 |          1
(1 row)
```

### A wrong signature: 401, nothing stored

```http
POST http://127.0.0.1:23100/webhooks/demo/demo
Host: api.localhost
x-demo-signature: [REDACTED]
Content-Type: application/json

{
  "event": "evidence.order.created",
  "n": 1
}

HTTP/1.1 401 Unauthorized

```

### An account that does not exist: 404

```http
POST http://127.0.0.1:23100/webhooks/demo/no-such-store
Host: api.localhost
x-demo-signature: [REDACTED]
Content-Type: application/json

{
  "event": "evidence.order.created",
  "n": 1
}

HTTP/1.1 404 Not Found

```

### A provider that does not exist: 404

```http
POST http://127.0.0.1:23100/webhooks/no-such-provider/demo
Host: api.localhost
x-demo-signature: [REDACTED]
Content-Type: application/json

{
  "event": "evidence.order.created",
  "n": 1
}

HTTP/1.1 404 Not Found

```

### A body of 262 145 bytes (one over the 262 144 limit): 413

```http
POST http://127.0.0.1:23100/webhooks/demo/demo
Host: api.localhost
x-demo-signature: [REDACTED]
Content-Type: application/json

(262145 bytes, not shown)

HTTP/1.1 413 Payload Too Large

```

### Still one dedupe key and one stored webhook after the refusals

```sql
select (select count(*) from inbound_webhook_key where provider = 'demo') as keys, (select count(*) from inbound_webhook where provider = 'demo') as webhooks;
```

```text
 keys | webhooks 
------+----------
    1 |        1
(1 row)
```

