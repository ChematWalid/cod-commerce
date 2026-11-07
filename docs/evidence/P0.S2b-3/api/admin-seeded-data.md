# Admin API seeded data

One authenticated Admin API query (bearer token, redacted) showing what the seed created: DZD as the default currency, prices including tax, the Algeria zones and the languages ar, fr and en.

### POST /admin-api: activeChannel and globalSettings

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
content-type: application/json
Authorization: Bearer [REDACTED]

{
  "query": "{ activeChannel { code defaultCurrencyCode availableCurrencyCodes pricesIncludeTax availableLanguageCodes defaultTaxZone { name } defaultShippingZone { name } } globalSettings { availableLanguages } }"
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "activeChannel": {
      "code": "__default_channel__",
      "defaultCurrencyCode": "DZD",
      "availableCurrencyCodes": [
        "DZD"
      ],
      "pricesIncludeTax": true,
      "availableLanguageCodes": [
        "ar",
        "fr",
        "en"
      ],
      "defaultTaxZone": {
        "name": "Algeria"
      },
      "defaultShippingZone": {
        "name": "Algeria"
      }
    },
    "globalSettings": {
      "availableLanguages": [
        "ar",
        "fr",
        "en"
      ]
    }
  }
}
```

