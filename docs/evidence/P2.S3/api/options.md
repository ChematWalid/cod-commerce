# Rule builder options

The brands, tags and option names with values a condition can name, read from the active store only (D2321).

### storeCollectionRuleOptions in A's store

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query { storeCollectionRuleOptions { brands { id name } tags { id name } options { name values } } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"1d9-OeLzsDPCEi0bsQQzyV5rrhmmprM"

{
  "data": {
    "storeCollectionRuleOptions": {
      "brands": [
        {
          "id": "<BRAND_DEMO>",
          "name": "علامة الأدلة"
        },
        {
          "id": "249806504977244160",
          "name": "علامة تجريبية"
        }
      ],
      "tags": [
        {
          "id": "<TAG_NEW>",
          "name": "جديد الأدلة"
        },
        {
          "id": "<TAG_PROMO>",
          "name": "ترويج الأدلة"
        },
        {
          "id": "249806505094684672",
          "name": "جديد"
        }
      ],
      "options": [
        {
          "name": "اللون",
          "values": [
            "أحمر",
            "أخضر",
            "أزرق"
          ]
        },
        {
          "name": "المقاس",
          "values": [
            "M",
            "S"
          ]
        }
      ]
    }
  }
}
```

### GET /catalog/collections/rule-options in B's store: B's tag, none of A's

```http
GET http://127.0.0.1:23100/catalog/collections/rule-options
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"106-dS2W6ouv7cVXYTKSKEnE3+8dP6w"

{
  "brands": [
    {
      "id": "249806509788110848",
      "name": "Marque démo"
    }
  ],
  "tags": [
    {
      "id": "<TAG_OF_B>",
      "name": "B evidence tag"
    },
    {
      "id": "249806509913939968",
      "name": "Nouveau"
    }
  ],
  "options": [
    {
      "name": "Couleur",
      "values": [
        "Bleu",
        "Rouge"
      ]
    },
    {
      "name": "Taille",
      "values": [
        "M",
        "S"
      ]
    }
  ]
}
```

