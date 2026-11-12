# Operational feature flags

Platform staff list, change and override flags; a flag answers by store, then business, then plan override, then rollout and default (D116). Merchants have no access.

### featureFlags (superadmin): the four seeds

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]

{
  "query": "query { featureFlags { key description defaultEnabled rolloutPercent overrides { scope scopeId enabled } } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "featureFlags": [
      {
        "key": "ai.enabled",
        "description": "Run the AI features (suggestions and replies); off turns every AI call off.",
        "defaultEnabled": true,
        "rolloutPercent": 100,
        "overrides": []
      },
      {
        "key": "capi.enabled",
        "description": "Send server-side conversion events to the ad platforms; off stops the sends.",
        "defaultEnabled": true,
        "rolloutPercent": 100,
        "overrides": []
      },
      {
        "key": "inbound-webhooks.enabled",
        "description": "Accept inbound provider webhooks; off answers 503 so providers retry later.",
        "defaultEnabled": true,
        "rolloutPercent": 100,
        "overrides": []
      },
      {
        "key": "intake.spool.enabled",
        "description": "Accept new orders into the intake spool; off stops intake while a fault is being handled.",
        "defaultEnabled": true,
        "rolloutPercent": 100,
        "overrides": []
      }
    ]
  }
}
```

### updateFeatureFlag: ai.enabled off by default

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]

{
  "query": "mutation ($input: UpdateFeatureFlagInput!) { updateFeatureFlag(input: $input) { key defaultEnabled rolloutPercent } }",
  "variables": {
    "input": {
      "key": "ai.enabled",
      "defaultEnabled": false
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "updateFeatureFlag": {
      "key": "ai.enabled",
      "defaultEnabled": false,
      "rolloutPercent": 100
    }
  }
}
```

### evaluateFeatureFlag ai.enabled for business A, before the override: false

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]

{
  "query": "query ($key: String!, $businessId: String) { evaluateFeatureFlag(key: $key, businessId: $businessId) }",
  "variables": {
    "key": "ai.enabled",
    "businessId": "<BUSINESS_DEMO>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "evaluateFeatureFlag": false
  }
}
```

### evaluateFeatureFlag ai.enabled for business B, before the override: false

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]

{
  "query": "query ($key: String!, $businessId: String) { evaluateFeatureFlag(key: $key, businessId: $businessId) }",
  "variables": {
    "key": "ai.enabled",
    "businessId": "<BUSINESS_SECOND>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "evaluateFeatureFlag": false
  }
}
```

### setFeatureFlagOverride: ai.enabled on for business A only

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]

{
  "query": "mutation ($input: FeatureFlagOverrideInput!) { setFeatureFlagOverride(input: $input) { key overrides { scope scopeId enabled } } }",
  "variables": {
    "input": {
      "key": "ai.enabled",
      "scope": "BUSINESS",
      "scopeId": "<BUSINESS_DEMO>",
      "enabled": true
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "setFeatureFlagOverride": {
      "key": "ai.enabled",
      "overrides": [
        {
          "scope": "BUSINESS",
          "scopeId": "<BUSINESS_DEMO>",
          "enabled": true
        }
      ]
    }
  }
}
```

### evaluateFeatureFlag for business A: true

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]

{
  "query": "query ($key: String!, $businessId: String) { evaluateFeatureFlag(key: $key, businessId: $businessId) }",
  "variables": {
    "key": "ai.enabled",
    "businessId": "<BUSINESS_DEMO>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "evaluateFeatureFlag": true
  }
}
```

### evaluateFeatureFlag for business B: still false

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]

{
  "query": "query ($key: String!, $businessId: String) { evaluateFeatureFlag(key: $key, businessId: $businessId) }",
  "variables": {
    "key": "ai.enabled",
    "businessId": "<BUSINESS_SECOND>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "evaluateFeatureFlag": false
  }
}
```

### The merchant owner asks for featureFlags: FORBIDDEN

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query { featureFlags { key description defaultEnabled rolloutPercent overrides { scope scopeId enabled } } }",
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
        "featureFlags"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### The merchant owner tries updateFeatureFlag: FORBIDDEN

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($input: UpdateFeatureFlagInput!) { updateFeatureFlag(input: $input) { key defaultEnabled rolloutPercent } }",
  "variables": {
    "input": {
      "key": "ai.enabled",
      "defaultEnabled": false
    }
  }
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
          "column": 46
        }
      ],
      "path": [
        "updateFeatureFlag"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

