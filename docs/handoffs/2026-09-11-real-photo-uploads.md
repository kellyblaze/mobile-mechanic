# Handoff: real photo uploads wired into Tap Your Trouble (CR-005 closed out, CR-017 filed)

Feature and owner: Replaced the intentionally-disabled photo step with real uploads to private Supabase Storage — Claude.
Branch and commit SHA: `feature/issue-2-backend-completion`, `bee17fe310a643b789473b24e7dc82d7362e475b` (working tree clean, pushed to `origin`).
Contract version: `1.9.0` unchanged — `POST /uploads` and `POST /uploads/{id}/complete` were already published; this checkpoint wires the frontend to them for real.

## What now works

Every photo added in `Intake`'s photo step (`/intake/:category`, step 3) now genuinely uploads the moment it's selected: `POST /uploads` (initiate) → a direct `PUT` of the real file bytes to the signed URL Supabase Storage returns → `POST /uploads/{id}/complete` (verifies the object landed in storage). Each photo shows its own uploading/uploaded/error state, with a retry button on failure. Files outside the API's own allowed types (`image/jpeg`, `image/png`, `image/webp` — HEIC included) are rejected client-side before any network call, with a specific message. "Next" is disabled while any photo is still uploading. The review step's photo count now says how many actually uploaded vs. failed, instead of a raw count that could silently overstate what's really attached.

## A real infrastructure gap found and fixed, with your explicit go-ahead

`POST /uploads` correctly returned `503 UPLOADS_UNAVAILABLE` on first attempt — not a bug. The bucket named in `.env`'s `SUPABASE_STORAGE_BUCKET` (`repair-evidence-private`) simply didn't exist yet in this dev environment's connected Supabase project. Confirmed by querying the project's bucket list directly with the service-role key already in `.env`: it came back empty (`[]`). Asked you first since creating cloud infrastructure is outward-facing; you said to create it. Did so via the Storage admin API — private, 25 MB size limit, the same four MIME types `POST /uploads`'s own validation already enforces — then re-verified the full flow succeeded end to end with a real test file.

## Live-verified, with one honest tooling limitation disclosed rather than glossed over

Curl-verified the complete three-leg flow against the real API and the newly-created bucket before writing any frontend code, including every real error path: 409 `UPLOAD_NOT_READY` (completing before the bytes actually land in storage), 404 for a nonexistent/not-owned upload id, 422 for a disallowed content type. All five outcomes confirmed exactly as the server code describes.

Verified the wired UI live via browser: the full 4-step wizard, including a real `POST /service-requests` submit, still works end to end. **Could not** drive an actual file selection through this session's browser automation tool — native file inputs reject a programmatically-set value (a standard browser security restriction), and this toolset has no dedicated file-upload action. So the byte-upload leg itself (the `PUT` to the signed URL) is verified via curl against the exact real endpoint, with a new unit test confirming the adapter code sends an identical request (same method, same headers, same body) — not verified by an actual browser click. Flagging this rather than claiming full browser coverage it didn't get.

## A second real gap found while wiring this — CR-017 filed

`POST /service-requests` accepts an `attachmentIds` field in its schema, and `apiAdapter.ts`'s `createServiceRequest` already sends it — but `createServiceRequestRepository.create` never reads it: no attachment column in the `INSERT`, no field in the function's own parameter type. Confirmed live: submitted a request with real `attachmentIds`, got back a normal success response with no trace of the attachment anywhere. `GET /admin/service-requests` has no attachment column either, so there is currently no way for a mechanic or admin to see which uploads belong to which request. Filed [CR-017](../change-requests/CR-017.md). The photo step's copy discloses this honestly ("aren't visible to your mechanic within this request yet") rather than implying a working attachment feature — photos are real and privately stored, just not yet linked to anything.

## Files changed

`apps/web/src/lib/apiAdapter.ts` (`UploadReference` type, `initiateUpload` properly typed, new `completeUpload` and `uploadFileToSignedUrl`), `apps/web/src/lib/apiAdapter.test.ts` (5 new tests), `apps/web/src/routes/Intake.tsx` (real per-photo upload wiring, rewritten stale top-of-file comment), `docs/change-requests/CR-005.md` (status updated), `docs/change-requests/CR-017.md` (new), `docs/integration-status.md` (three overlapping upload-related rows updated to the real state).

## How to run and verify

```powershell
pnpm install
pnpm dev                    # API on :3000 — restart after pulling new backend commits; tsx has no watch mode
pnpm --filter web dev       # Vite on :5173, or the .claude/launch.json "web" config via preview_start
```

As customer-demo: `/intake/something-wrong` → pick a vehicle → pick a symptom → photo step: choose a real JPEG/PNG/WebP file and watch it go uploading → uploaded (or try an unsupported type to see the client-side rejection) → Next → Review shows the accurate uploaded count → Submit.

## Tests run and actual results (fresh, before writing this)

- `pnpm --filter web typecheck` — clean.
- `pnpm --filter web test` (vitest) — 1 file, **38 tests passed** (5 new: initiate returns the real signed-URL shape, complete sends no body, the signed-URL PUT carries only a content-type header and no dev-actor headers, and a failed signed-URL upload throws).
- `pnpm --filter web build` — succeeded (157 modules, 512.91 kB JS / 14.02 kB CSS pre-gzip).
- Full manual wizard flow (minus the actual file-select click, see above) verified live via browser; 375px checked clean on the photo step.

## Known limitations

- Uploaded photos aren't linked to their service request yet — CR-017, blocking a mechanic/admin from ever seeing them.
- The actual browser file-select → upload interaction was not driven through this session's own browser tool (tooling limitation, described above) — worth a manual click-through by a human, or the next session picking up a browser toolset that supports file uploads, before calling this fully browser-verified.

## What the other agent (Codex) should look at next

1. **CR-017** — persist `attachmentIds` on `POST /service-requests` (or an equivalent join table) and surface it on `GET /admin/service-requests` so uploaded photos actually reach a mechanic/admin.
2. The `.env` duplicate `AUTH_MODE` line (flagged in earlier handoffs) — still present, still not urgent.

No backend defects found in the upload endpoints themselves — both behaved exactly as their own code describes once the storage bucket existed.
