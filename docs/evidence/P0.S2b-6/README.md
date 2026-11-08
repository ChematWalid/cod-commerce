# Evidence for P0.S2b-6 (plugin template)

Request/response transcripts and screenshots of the real `plugins/_template` ("notes" feature) running inside the
platform image (CLAUDE.md §3a.14). Produced by `scripts/evidence/P0.S2b-6.sh`; nothing here is hand-written. Data is
synthetic: two generated businesses (channels `business-a`, `business-b`) and the placeholders from `.env.example`.

- Image: `cod-platform:local`, built by that run (`docker compose build migrate`) from a working tree with no uncommitted
  change outside the evidence folders, whose last image-relevant commit is `fb0321cd3e4ffc163c6a40f2e163a0656826831a`.
- `NEXT_DEPLOYMENT_ID` of the running `api` container: `fb0321c`, the short id of that commit. The script asserts that
  it and the container's image id are the ones just built. Stack: compose project `cod-evidence`, `api` on host port 23100.

## API transcripts (Admin API, `POST /admin-api`)

| File | Shows |
| --- | --- |
| [`api/create-note.md`](api/create-note.md) | `createTemplateNote` in business A's channel (an English and an Arabic note); ids are 63-bit decimal strings |
| [`api/read-notes.md`](api/read-notes.md) | `templateNote(id)` and `templateNotes(take, skip)` in A: A's notes, newest first, and the second page |
| [`api/typed-error.md`](api/typed-error.md) | A blank title: `extensions.code: TEMPLATE_NOTE_INVALID_TITLE`, no data |
| [`api/forbidden.md`](api/forbidden.md) | A role with only `ReadCatalog` and its administrator: `templateNotes` answers `FORBIDDEN` |
| [`api/isolation.md`](api/isolation.md) | Two businesses: in B, A's note by id is `null` and the list holds only B's note; the converse in A; the platform channel lists nothing; unknown token `nope` gives `CHANNEL_NOT_FOUND` and no data |
| [`api/input-shape.md`](api/input-shape.md) | `CreateTemplateNoteInput` has the fields `body` and `title` only (no business id) |

**Normalisation.** The generated note ids and `createdAt` values change on every run. The script first asserts their
format (every id matches `^[1-9][0-9]{0,18}$`, every `createdAt` is an ISO timestamp, every id in a response is one it created)
and runs every other assertion on the real values; only then it replaces ids by `<NOTE_A1_ID>`, `<NOTE_A2_ID>`, `<NOTE_B1_ID>` and
timestamps by `<TIMESTAMP>` in the transcripts. Per-run session tokens, cookies and the passwords are redacted
(`[REDACTED]`); the `vendure-token` channel tokens are synthetic and shown. The same input regenerates the same files.

## Screenshots

The template's dashboard page `/dashboard/template-notes` (test id `template-notes-page`), signed in as the superadmin with
business A selected as the dashboard's channel, listing A's two notes. Viewport screenshots (not full page),
`reducedMotion: reduce`, taken after `networkidle` and `document.fonts.ready`. Sign-in and language switch use the Task 14
helpers (`apps/server/tests/browser/dashboard-session.ts`) in a desktop-sized context whose storage state opens the phone context.

| File | URL | Viewport | Language | `dir` / `lang` asserted |
| --- | --- | --- | --- | --- |
| [`template-notes-ar-desktop.png`](screens/template-notes-ar-desktop.png) | `/dashboard/template-notes` | desktop 1280x800, scale 1 | ar | `rtl` / `ar` |
| [`template-notes-en-desktop.png`](screens/template-notes-en-desktop.png) | `/dashboard/template-notes` | desktop 1280x800, scale 1 | en | `ltr` / `en` |
| [`template-notes-ar-mobile.png`](screens/template-notes-ar-mobile.png) | `/dashboard/template-notes` | mobile 390x844, touch, scale 2 | ar | `rtl` / `ar` |
| [`template-notes-en-mobile.png`](screens/template-notes-en-mobile.png) | `/dashboard/template-notes` | mobile 390x844, touch, scale 2 | en | `ltr` / `en` |

## Checks (the script fails otherwise)

- Every transcript's status and body as listed above, asserted on the real values before normalisation.
- Each page: `dir`/`lang` match the language, the `template-notes-page` marker is visible with both note titles and no alert;
  Arabic pages: the IBM Plex Sans Arabic face is loaded and in the body font.
- Exactly 4 PNGs, each at most 300 KB.
- No value of a password, secret, token or key from `.env`, and no session token or cookie value of the runs, appears in this folder.

## Re-run

```bash
cp .env.example .env   # once; the script needs the root .env
scripts/evidence/P0.S2b-6.sh
```

It uses its own compose project (`cod-evidence`, host ports shifted by 20000), always rebuilds the image first (the layer
cache keeps that cheap), refuses to run on a working tree with uncommitted changes outside the evidence folders, and removes the
stack and its volumes on exit.
