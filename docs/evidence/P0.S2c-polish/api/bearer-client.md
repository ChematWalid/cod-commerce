# Bearer-only Admin API client

Live exchange against `http://127.0.0.1:23100/admin-api`: no cookie and no `Origin` header. Tokens and the password are redacted (ADR 0017).

### Log in, no cookie and no Origin

```http
POST http://127.0.0.1:23100/admin-api
content-type: application/json

{
  "query": "mutation ($username: String!, $password: String!) { login(username: $username, password: $password) { __typename ... on CurrentUser { identifier } } }",
  "variables": {
    "username": "superadmin",
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
      "identifier": "superadmin"
    }
  }
}
```

### Authenticated Admin API call with the bearer token only

```http
POST http://127.0.0.1:23100/admin-api
content-type: application/json
authorization: Bearer [REDACTED]

{
  "query": "query { me { identifier } }"
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "me": {
      "identifier": "superadmin"
    }
  }
}
```

### The same call with no token is anonymous

```http
POST http://127.0.0.1:23100/admin-api
content-type: application/json

{
  "query": "query { me { identifier } }"
}

HTTP/1.1 200 OK
vendure-auth-token: [REDACTED]
cache-control: no-store
content-type: application/json; charset=utf-8
set-cookie: session=[REDACTED]; path=/; expires=Mon, 08 Nov 2027 21:28:33 GMT; samesite=lax; httponly
set-cookie: session.sig=[REDACTED]; path=/; expires=Mon, 08 Nov 2027 21:28:33 GMT; samesite=lax; httponly

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
        "me"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": {
    "me": null
  }
}
```

