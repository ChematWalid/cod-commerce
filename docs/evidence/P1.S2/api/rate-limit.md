# Rate limits

Real answers from a burst from one address (D29, D30). REST: 429 with Retry-After; GraphQL: code RATE_LIMITED, retryAfterSeconds and Retry-After on a 200.

### subdomain availability past 60 requests a minute: 429

```http
GET http://127.0.0.1:23100/stores/subdomain-availability?subdomain=limit-probe

HTTP/1.1 429 Too Many Requests
retry-after: 1
content-type: application/json; charset=utf-8

{
  "statusCode": 429,
  "message": "Too many requests. Try again later.",
  "retryAfterSeconds": 1,
  "path": "/stores/subdomain-availability?subdomain=limit-probe"
}
```

### The GraphQL subdomainAvailability over the same limit

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json

{
  "query": "query ($subdomain: String!) { subdomainAvailability(subdomain: $subdomain) { subdomain status reason reasonCode } }",
  "variables": {
    "subdomain": "limit-probe"
  }
}

HTTP/1.1 200 OK
retry-after: 1
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "errors": [
    {
      "message": "Too many requests. Try again later.",
      "locations": [
        {
          "line": 1,
          "column": 31
        }
      ],
      "path": [
        "subdomainAvailability"
      ],
      "extensions": {
        "code": "RATE_LIMITED",
        "retryAfterSeconds": 1
      }
    }
  ],
  "data": null
}
```

### Repeated failed logins for one email: RATE_LIMITED

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json

{
  "query": "mutation ($username: String!, $password: String!) { login(username: $username, password: $password) { __typename ... on CurrentUser { identifier } ... on ErrorResult { errorCode message } } }",
  "variables": {
    "username": "api-d-1@evidence.example.test",
    "password": "[REDACTED]"
  }
}

HTTP/1.1 200 OK
retry-after: 60
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "errors": [
    {
      "message": "Too many sign-in attempts. Please wait before trying again.",
      "locations": [
        {
          "line": 1,
          "column": 53
        }
      ],
      "path": [
        "login"
      ],
      "extensions": {
        "code": "RATE_LIMITED",
        "retryAfterSeconds": 60
      }
    }
  ],
  "data": null
}
```

### POST /auth/forgot-password past 60 requests a minute: 429

```http
POST http://127.0.0.1:23100/auth/forgot-password

{
  "email": "nobody-1@evidence.example.test"
}

HTTP/1.1 429 Too Many Requests
retry-after: 6
content-type: application/json; charset=utf-8

{
  "statusCode": 429,
  "message": "Too many requests. Try again later.",
  "retryAfterSeconds": 6,
  "path": "/auth/forgot-password"
}
```

