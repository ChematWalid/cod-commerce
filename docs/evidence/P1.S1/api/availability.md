# Subdomain availability, anonymous

No session and no channel token: the sign-up wizard has neither. Same answer from REST and GraphQL.

### GET availability of 'fresh-name': available

```http
GET http://127.0.0.1:23100/stores/subdomain-availability?subdomain=fresh-name

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "subdomain": "fresh-name",
  "status": "available",
  "reason": null
}
```

### GET availability of 'demo': taken

```http
GET http://127.0.0.1:23100/stores/subdomain-availability?subdomain=demo

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "subdomain": "demo",
  "status": "taken",
  "reason": "This subdomain is already taken"
}
```

### GET availability of 'demo3': taken

```http
GET http://127.0.0.1:23100/stores/subdomain-availability?subdomain=demo3

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "subdomain": "demo3",
  "status": "taken",
  "reason": "This subdomain is already taken"
}
```

### GET availability of 'admin': reserved

```http
GET http://127.0.0.1:23100/stores/subdomain-availability?subdomain=admin

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "subdomain": "admin",
  "status": "reserved",
  "reason": "This name is reserved by the platform"
}
```

### GET availability of 'A!': invalid

```http
GET http://127.0.0.1:23100/stores/subdomain-availability?subdomain=A!

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "subdomain": "a!",
  "status": "invalid",
  "reason": "Must be 3 to 30 characters long"
}
```

### GraphQL subdomainAvailability, anonymous

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json

{
  "query": "query ($subdomain: String!) { subdomainAvailability(subdomain: $subdomain) { subdomain status reason } }",
  "variables": {
    "subdomain": "demo"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "subdomainAvailability": {
      "subdomain": "demo",
      "status": "taken",
      "reason": "This subdomain is already taken"
    }
  }
}
```

