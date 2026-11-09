# Registration

Anonymous. Creates the user, business and first store in one transaction; a verification email goes out. Passwords redacted, ids are placeholders.

### registerMerchant

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json

{
  "query": "mutation ($input: RegisterMerchantInput!) { registerMerchant(input: $input) { businessId storeId verificationEmailSent signInTicket } }",
  "variables": {
    "input": {
      "email": "api-a-1@evidence.example.test",
      "password": "[REDACTED]",
      "firstName": "Api",
      "lastName": "Owner",
      "businessName": "Api Business",
      "storeName": "Api Store",
      "subdomain": "api-a-1",
      "storeLanguage": "ar",
      "emailLocale": "en"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "registerMerchant": {
      "businessId": "<BUSINESS_a>",
      "storeId": "<STORE_a>",
      "verificationEmailSent": true,
      "signInTicket": null
    }
  }
}
```

### Taken email: disclosed, by D27

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json

{
  "query": "mutation ($input: RegisterMerchantInput!) { registerMerchant(input: $input) { businessId storeId verificationEmailSent signInTicket } }",
  "variables": {
    "input": {
      "email": "api-a-1@evidence.example.test",
      "password": "[REDACTED]",
      "firstName": "Api",
      "lastName": "Owner",
      "businessName": "Api Business",
      "storeName": "Api Store",
      "subdomain": "api-other-1",
      "storeLanguage": "ar",
      "emailLocale": "en"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "errors": [
    {
      "message": "An account with this email already exists",
      "locations": [
        {
          "line": 1,
          "column": 45
        }
      ],
      "path": [
        "registerMerchant"
      ],
      "extensions": {
        "code": "auth.email-taken"
      }
    }
  ],
  "data": null
}
```

### Password under the policy minimum

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json

{
  "query": "mutation ($input: RegisterMerchantInput!) { registerMerchant(input: $input) { businessId storeId verificationEmailSent signInTicket } }",
  "variables": {
    "input": {
      "email": "api-short-1@evidence.example.test",
      "password": "[REDACTED]",
      "firstName": "Api",
      "lastName": "Owner",
      "businessName": "Api Business",
      "storeName": "Api Store",
      "subdomain": "api-short-1",
      "storeLanguage": "ar",
      "emailLocale": "en"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "errors": [
    {
      "message": "The password does not meet the policy",
      "locations": [
        {
          "line": 1,
          "column": 45
        }
      ],
      "path": [
        "registerMerchant"
      ],
      "extensions": {
        "code": "auth.password-policy"
      }
    }
  ],
  "data": null
}
```

### Taken subdomain

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json

{
  "query": "mutation ($input: RegisterMerchantInput!) { registerMerchant(input: $input) { businessId storeId verificationEmailSent signInTicket } }",
  "variables": {
    "input": {
      "email": "api-sub-1@evidence.example.test",
      "password": "[REDACTED]",
      "firstName": "Api",
      "lastName": "Owner",
      "businessName": "Api Business",
      "storeName": "Api Store",
      "subdomain": "demo",
      "storeLanguage": "ar",
      "emailLocale": "en"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "errors": [
    {
      "message": "This subdomain is already taken",
      "locations": [
        {
          "line": 1,
          "column": 45
        }
      ],
      "path": [
        "registerMerchant"
      ],
      "extensions": {
        "code": "tenancy.subdomain-taken"
      }
    }
  ],
  "data": null
}
```

### POST /auth/register

```http
POST http://127.0.0.1:23100/auth/register

{
  "email": "api-rest-1@evidence.example.test",
  "password": "[REDACTED]",
  "firstName": "Api",
  "lastName": "Owner",
  "businessName": "Api Business",
  "storeName": "Api Store",
  "subdomain": "api-rest-1",
  "storeLanguage": "ar",
  "emailLocale": "en"
}

HTTP/1.1 201 Created
content-type: application/json; charset=utf-8

{
  "businessId": "<BUSINESS_rest>",
  "storeId": "<STORE_rest>",
  "verificationEmailSent": true
}
```

