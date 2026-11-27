# Wilayas (public)

Reference data for anyone (D3117): no session, limited per client address, cached; 69 wilayas (D3123), no communes.

### GET /provinces

```http
GET http://127.0.0.1:23100/provinces

HTTP/1.1 200 OK
cache-control: public, max-age=300, stale-while-revalidate=86400
content-type: application/json; charset=utf-8
etag: W/"1b91-N6PaRCsvSlH1qD/w4+1huk3577A"

[
  {
    "id": "01",
    "code": "01",
    "name": "Adrar",
    "arabicName": "أدرار",
    "names": [
      "أدرار"
    ]
  },
  {
    "id": "02",
    "code": "02",
    "name": "Chlef",
    "arabicName": "الشلف",
    "names": [
      "الشلف",
      "Ech Cheliff"
    ]
  },
  {
    "id": "03",
    "code": "03",
    "name": "Laghouat",
    "arabicName": "الأغواط",
    "names": [
      "الأغواط"
    ]
  },
  {
    "id": "04",
    "code": "04",
    "name": "Oum El Bouaghi",
    "arabicName": "أم البواقي",
    "names": [
      "أم البواقي",
      "Oum El Bouagui"
    ]
  },
  {
    "id": "05",
    "code": "05",
    "name": "Batna",
    "arabicName": "باتنة",
    "names": [
      "باتنة"
    ]
  },
  {
    "id": "06",
    "code": "06",
    "name": "Béjaïa",
    "arabicName": "بجاية",
    "names": [
      "بجاية",
      "Bgayet",
      "Bougie"
    ]
  },
  {
    "id": "07",
    "code": "07",
    "name": "Biskra",
    "arabicName": "بسكرة",
    "names": [
      "بسكرة"
    ]
  },
  {
    "id": "08",
    "code": "08",
    "name": "Béchar",
    "arabicName": "بشار",
    "names": [
      "بشار"
    ]
  },
  {
    "id": "09",
    "code": "09",
    "name": "Blida",
    "arabicName": "البليدة",
    "names": [
      "البليدة"
    ]
  },
  {
    "id": "10",
    "code": "10",
    "name": "Bouira",
    "arabicName": "البويرة",
    "names": [
      "البويرة"
    ]
  },
  {
    "id": "11",
    "code": "11",
    "name": "Tamanrasset",
    "arabicName": "تمنراست",
    "names": [
      "تمنراست",
      "Tamanghasset"
    ]
  },
  {
    "id": "12",
    "code": "12",
    "name": "Tébessa",
    "arabicName": "تبسة",
    "names": [
      "تبسة"
    ]
  },
  {
    "id": "13",
    "code": "13",
    "name": "Tlemcen",
    "arabicName": "تلمسان",
    "names": [
      "تلمسان"
    ]
  },
  {
    "id": "14",
    "code": "14",
    "name": "Tiaret",
    "arabicName": "تيارت",
    "names": [
      "تيارت"
    ]
  },
  {
    "id": "15",
    "code": "15",
    "name": "Tizi Ouzou",
    "arabicName": "تيزي وزو",
    "names": [
      "تيزي وزو"
    ]
  },
  {
    "id": "16",
    "code": "16",
    "name": "Alger",
    "arabicName": "الجزائر",
    "names": [
      "الجزائر",
      "Algiers",
      "El Djazair"
    ]
  },
  {
    "id": "17",
    "code": "17",
    "name": "Djelfa",
    "arabicName": "الجلفة",
    "names": [
      "الجلفة"
    ]
  },
  {
    "id": "18",
    "code": "18",
    "name": "Jijel",
    "arabicName": "جيجل",
    "names": [
      "جيجل"
    ]
  },
  {
    "id": "19",
    "code": "19",
    "name": "Sétif",
    "arabicName": "سطيف",
    "names": [
      "سطيف"
    ]
  },
  {
    "id": "20",
    "code": "20",
    "name": "Saïda",
    "arabicName": "سعيدة",
    "names": [
      "سعيدة"
    ]
  },
  {
    "id": "21",
    "code": "21",
    "name": "Skikda",
    "arabicName": "سكيكدة",
    "names": [
      "سكيكدة"
    ]
  },
  {
    "id": "22",
    "code": "22",
    "name": "Sidi Bel Abbès",
    "arabicName": "سيدي بلعباس",
    "names": [
      "سيدي بلعباس"
    ]
  },
  {
    "id": "23",
    "code": "23",
    "name": "Annaba",
    "arabicName": "عنابة",
    "names": [
      "عنابة"
    ]
  },
  {
    "id": "24",
    "code": "24",
    "name": "Guelma",
    "arabicName": "قالمة",
    "names": [
      "قالمة"
    ]
  },
  {
    "id": "25",
    "code": "25",
    "name": "Constantine",
    "arabicName": "قسنطينة",
    "names": [
      "قسنطينة",
      "Qacentina"
    ]
  },
  {
    "id": "26",
    "code": "26",
    "name": "Médéa",
    "arabicName": "المدية",
    "names": [
      "المدية"
    ]
  },
  {
    "id": "27",
    "code": "27",
    "name": "Mostaganem",
    "arabicName": "مستغانم",
    "names": [
      "مستغانم"
    ]
  },
  {
    "id": "28",
    "code": "28",
    "name": "M'Sila",
    "arabicName": "المسيلة",
    "names": [
      "المسيلة",
      "Msila"
    ]
  },
  {
    "id": "29",
    "code": "29",
    "name": "Mascara",
    "arabicName": "معسكر",
    "names": [
      "معسكر"
    ]
  },
  {
    "id": "30",
    "code": "30",
    "name": "Ouargla",
    "arabicName": "ورقلة",
    "names": [
      "ورقلة"
    ]
  },
  {
    "id": "31",
    "code": "31",
    "name": "Oran",
    "arabicName": "وهران",
    "names": [
      "وهران",
      "Wahran"
    ]
  },
  {
    "id": "32",
    "code": "32",
    "name": "El Bayadh",
    "arabicName": "البيض",
    "names": [
      "البيض"
    ]
  },
  {
    "id": "33",
    "code": "33",
    "name": "Illizi",
    "arabicName": "إليزي",
    "names": [
      "إليزي"
    ]
  },
  {
    "id": "34",
    "code": "34",
    "name": "Bordj Bou Arréridj",
    "arabicName": "برج بوعريريج",
    "names": [
      "برج بوعريريج",
      "BBA"
    ]
  },
  {
    "id": "35",
    "code": "35",
    "name": "Boumerdès",
    "arabicName": "بومرداس",
    "names": [
      "بومرداس"
    ]
  },
  {
    "id": "36",
    "code": "36",
    "name": "El Tarf",
    "arabicName": "الطارف",
    "names": [
      "الطارف"
    ]
  },
  {
    "id": "37",
    "code": "37",
    "name": "Tindouf",
    "arabicName": "تندوف",
    "names": [
      "تندوف"
    ]
  },
  {
    "id": "38",
    "code": "38",
    "name": "Tissemsilt",
    "arabicName": "تيسمسيلت",
    "names": [
      "تيسمسيلت"
    ]
  },
  {
    "id": "39",
    "code": "39",
    "name": "El Oued",
    "arabicName": "الوادي",
    "names": [
      "الوادي"
    ]
  },
  {
    "id": "40",
    "code": "40",
    "name": "Khenchela",
    "arabicName": "خنشلة",
    "names": [
      "خنشلة"
    ]
  },
  {
    "id": "41",
    "code": "41",
    "name": "Souk Ahras",
    "arabicName": "سوق أهراس",
    "names": [
      "سوق أهراس"
    ]
  },
  {
    "id": "42",
    "code": "42",
    "name": "Tipaza",
    "arabicName": "تيبازة",
    "names": [
      "تيبازة",
      "Tipasa"
    ]
  },
  {
    "id": "43",
    "code": "43",
    "name": "Mila",
    "arabicName": "ميلة",
    "names": [
      "ميلة"
    ]
  },
  {
    "id": "44",
    "code": "44",
    "name": "Aïn Defla",
    "arabicName": "عين الدفلى",
    "names": [
      "عين الدفلى"
    ]
  },
  {
    "id": "45",
    "code": "45",
    "name": "Naâma",
    "arabicName": "النعامة",
    "names": [
      "النعامة"
    ]
  },
  {
    "id": "46",
    "code": "46",
    "name": "Aïn Témouchent",
    "arabicName": "عين تموشنت",
    "names": [
      "عين تموشنت"
    ]
  },
  {
    "id": "47",
    "code": "47",
    "name": "Ghardaïa",
    "arabicName": "غرداية",
    "names": [
      "غرداية"
    ]
  },
  {
    "id": "48",
    "code": "48",
    "name": "Relizane",
    "arabicName": "غليزان",
    "names": [
      "غليزان"
    ]
  },
  {
    "id": "49",
    "code": "49",
    "name": "Timimoun",
    "arabicName": "تيميمون",
    "names": [
      "تيميمون"
    ]
  },
  {
    "id": "50",
    "code": "50",
    "name": "Bordj Badji Mokhtar",
    "arabicName": "برج باجي مختار",
    "names": [
      "برج باجي مختار"
    ]
  },
  {
    "id": "51",
    "code": "51",
    "name": "Ouled Djellal",
    "arabicName": "أولاد جلال",
    "names": [
      "أولاد جلال"
    ]
  },
  {
    "id": "52",
    "code": "52",
    "name": "Béni Abbès",
    "arabicName": "بني عباس",
    "names": [
      "بني عباس"
    ]
  },
  {
    "id": "53",
    "code": "53",
    "name": "In Salah",
    "arabicName": "عين صالح",
    "names": [
      "عين صالح",
      "Ain Salah"
    ]
  },
  {
    "id": "54",
    "code": "54",
    "name": "In Guezzam",
    "arabicName": "عين قزام",
    "names": [
      "عين قزام",
      "Ain Guezzam"
    ]
  },
  {
    "id": "55",
    "code": "55",
    "name": "Touggourt",
    "arabicName": "تقرت",
    "names": [
      "تقرت"
    ]
  },
  {
    "id": "56",
    "code": "56",
    "name": "Djanet",
    "arabicName": "جانت",
    "names": [
      "جانت"
    ]
  },
  {
    "id": "57",
    "code": "57",
    "name": "El M'Ghair",
    "arabicName": "المغير",
    "names": [
      "المغير",
      "El Meghaier"
    ]
  },
  {
    "id": "58",
    "code": "58",
    "name": "El Meniaa",
    "arabicName": "المنيعة",
    "names": [
      "المنيعة",
      "El Menia"
    ]
  },
  {
    "id": "59",
    "code": "59",
    "name": "Aflou",
    "arabicName": "أفلو",
    "names": [
      "أفلو"
    ]
  },
  {
    "id": "60",
    "code": "60",
    "name": "Barika",
    "arabicName": "بريكة",
    "names": [
      "بريكة"
    ]
  },
  {
    "id": "61",
    "code": "61",
    "name": "El Kantara",
    "arabicName": "القنطرة",
    "names": [
      "القنطرة"
    ]
  },
  {
    "id": "62",
    "code": "62",
    "name": "Bir El Ater",
    "arabicName": "بئر العاتر",
    "names": [
      "بئر العاتر"
    ]
  },
  {
    "id": "63",
    "code": "63",
    "name": "El Aricha",
    "arabicName": "العريشة",
    "names": [
      "العريشة"
    ]
  },
  {
    "id": "64",
    "code": "64",
    "name": "Ksar Chellala",
    "arabicName": "قصر الشلالة",
    "names": [
      "قصر الشلالة",
      "Ksar El Chellala"
    ]
  },
  {
    "id": "65",
    "code": "65",
    "name": "Aïn Ouessara",
    "arabicName": "عين وسارة",
    "names": [
      "عين وسارة",
      "Ain Oussera"
    ]
  },
  {
    "id": "66",
    "code": "66",
    "name": "Messaad",
    "arabicName": "مسعد",
    "names": [
      "مسعد"
    ]
  },
  {
    "id": "67",
    "code": "67",
    "name": "Ksar El Boukhari",
    "arabicName": "قصر البخاري",
    "names": [
      "قصر البخاري",
      "Ksar Boukhari"
    ]
  },
  {
    "id": "68",
    "code": "68",
    "name": "Bou Saâda",
    "arabicName": "بوسعادة",
    "names": [
      "بوسعادة",
      "Boussaada"
    ]
  },
  {
    "id": "69",
    "code": "69",
    "name": "El Abiodh Sidi Cheikh",
    "arabicName": "الأبيض سيدي الشيخ",
    "names": [
      "الأبيض سيدي الشيخ",
      "Labiodh Sidi Cheikh"
    ]
  }
]
```

