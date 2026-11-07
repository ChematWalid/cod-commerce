# Admin API login

Superadmin login with the `login` mutation on `POST /admin-api`. The server accepts the session as a cookie or as a bearer token; the token, cookie value and password are redacted by the evidence script.

### POST /admin-api: login mutation

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
content-type: application/json

{
  "query": "mutation Login($username: String!, $password: String!) { login(username: $username, password: $password) { __typename ... on CurrentUser { identifier channels { code } } ... on ErrorResult { errorCode message } } }",
  "variables": {
    "username": "superadmin",
    "password": "[REDACTED]"
  }
}

HTTP/1.1 200 OK
vendure-auth-token: [REDACTED]
content-type: application/json; charset=utf-8
set-cookie: session=[REDACTED]; path=/; samesite=lax; httponly
set-cookie: session.sig=[REDACTED]; path=/; samesite=lax; httponly

{
  "data": {
    "login": {
      "__typename": "CurrentUser",
      "identifier": "superadmin",
      "channels": [
        {
          "code": "__default_channel__"
        }
      ]
    }
  }
}
```

