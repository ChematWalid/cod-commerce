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

{
  "data": {
    "storeCollectionRuleOptions": {
      "brands": [
        {
          "id": "<BRAND_DEMO>",
          "name": "علامة الأدلة"
        },
        {
          "id": "249734059209531392",
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
          "id": "249734059326971904",
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

{
  "brands": [
    {
      "id": "249734063114428416",
      "name": "Marque démo"
    }
  ],
  "tags": [
    {
      "id": "<TAG_OF_B>",
      "name": "B evidence tag"
    },
    {
      "id": "249734063525470208",
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

