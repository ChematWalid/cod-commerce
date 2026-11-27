# Geo reference data: source

`infrastructure/seed/geo-seed.json` holds the 69 wilayas and their 1,541 communes. `scripts/geo/build-geo-seed.mjs` builds it; nobody edits it by hand.

| Item | Value |
|---|---|
| Source | dzCode.io **leblad** commune list, npm package `@dzcode-io/leblad@1.0.3`, file `data/WilayaList.json` (data version v1.1) |
| URL | https://registry.npmjs.org/@dzcode-io/leblad/-/leblad-1.0.3.tgz (project: https://github.com/dzcode-io/leblad) |
| Retrieved | 2026-11-22 |
| Licence | MIT, Copyright (c) 2020 dzCode.io. The notice is kept below, as the licence requires. |
| Upstream origin | Commune codes and names from the official ONS (Office National des Statistiques) commune list |
| 2026 division | Law 26-06 of 4 April 2026, *Journal officiel* No. 25 of 5 April 2026, https://www.joradp.dz/FTP/JO-FRANCAIS/2026/F2026025.pdf. Decree 26-206 of 25 May 2026, JO No. 40, https://www.joradp.dz/FTP/JO-FRANCAIS/2026/F2026040.pdf and https://www.joradp.dz/FTP/JO-ARABE/2026/A2026040.pdf (Arabic names of wilayas 59–69). Official texts, retrieved 2026-11-22. |
| 2026 article lists | `scripts/geo/law-26-06-articles.json`, transcribed from github.com/islam-re/Algeria-wilayas, file `JO Article 2026.md`, commit `bfb29814117d11a6a101fa07c38911f6675b748b` (MIT, Copyright notice in that repository's `LICENSE`), retrieved 2026-11-22. Every one of the 21 articles was checked against the official JO 25 text: the declared count equals the parsed count, and each commune name appears verbatim. |

## What the script changes

1. **69 wilayas.** The source still uses the 48-wilaya layout.
   - The communes of the ten wilayas created in 2019 (49 Timimoun to 58 El Meniaa) move to their own province. The lists are in `NEW_PROVINCE_COMMUNES`.
   - The 108 communes of the eleven wilayas created by law 26-06 (59 Aflou to 69 El Abiodh Sidi Cheikh, articles 52 bis 10–20) move as well. The lists are in `LAW_26_06_COMMUNES`, decision D3123.
   - A moved commune keeps its ONS code: Timimoun is still `109` with `provinceCode: '49'`, and Bou Saada is still `2820` with `provinceCode: '68'` (decisions D3104, D3129).
   - The 2026 lists were built by `scripts/geo/match-law-26-06.mjs`. It matched every JO name to a unique commune of its former wilaya. Each non-exact match was reviewed by hand; they were all spelling variants, such as "Abdelkader Azil" for `515 Azil Abedelkader`, or "Deux Bassins" for `2653 El Haoudane` (that wilaya keeps it).
   - The build re-checks every rewritten wilaya's count against its article.
2. **Six missing communes.** The source's El Bayadh dairas are shifted, and 3207, 3208, 3213, 3218, 3220 and 3221 are missing. `PATCHED_COMMUNES` adds them with their ONS names.
3. **Duplicates.** The source lists each "wilaya déléguée" twice. The script keeps one row per ONS code.
4. **Province names** are our own curated table (`PROVINCES`): the official French name, the Arabic name and the aliases buyers type. Names of 59–69 are the decree 26-206 names (French and Arabic JO 40).
5. **Default availability.** Every commune gets `isHomeDelivery: true`. `isStopdesk` is true for wilaya and daira seats (including the seats of 59–69), and for at least one commune per province (decision D3105). Stores and carriers narrow this later.

## Rebuild

```bash
curl -sSfL -o /tmp/leblad.tgz https://registry.npmjs.org/@dzcode-io/leblad/-/leblad-1.0.3.tgz
mkdir -p /tmp/leblad && tar -xzf /tmp/leblad.tgz -C /tmp/leblad
node scripts/geo/build-geo-seed.mjs /tmp/leblad/package/data/WilayaList.json
```

The script fails unless it finds exactly 69 provinces and 1,541 communes, and the commune count of each wilaya rewritten by law 26-06 equals its JO article.

## Licence notice (source data)

```
MIT License

Copyright (c) 2020 dzCode.io

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Licence notice (2026 article transcription, islam-re/Algeria-wilayas)

```
MIT License

Copyright (c) 2026 islam-re

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
