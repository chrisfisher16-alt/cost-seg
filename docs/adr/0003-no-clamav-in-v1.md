# ADR 0003 — Document upload: no ClamAV in V1

Status: accepted, 2026-04-17

## Context

§Phase 4 of the master prompt calls for "virus-scan via ClamAV sidecar
function (add to `inngest`)". On Vercel serverless, Inngest steps run in
function workers with 250MB package limits and ephemeral file systems —
ClamAV's daemon + signature database do not fit.

The realistic deploy options are (a) hosted antivirus API (Cloudmersive,
VirusTotal), (b) a dedicated ClamAV worker on Fly.io or Railway that Inngest
calls, (c) no scan.

## Decision

V1 ships **without AV**. Upload validation enforces:

1. Client-side MIME allowlist: `application/pdf`, `image/jpeg`, `image/png`.
2. Server-side size cap: 25MB per file.
3. Server-side magic-byte check via `file-type` (rejects mismatched
   declared-vs-actual types).
4. Supabase Storage bucket is private; files are never served to the public.
5. Only Textract (closing disclosures), Claude (never binary), and React-PDF
   (never user input) touch the files downstream — no shell-outs, no
   server-side image/PDF mutation that could execute embedded payloads.
6. Customer-facing downloads use short-lived signed URLs (7-day expiry) and
   render the PDF we generated, not the uploaded files.

## Consequences

- Residual risk: a malicious PDF with an embedded exploit could reach a
  customer's device only if we re-deliver their uploaded file. We don't —
  the only output is our generated PDF. Admin review opens uploads in-browser
  (Chrome sandboxes PDFs). Risk accepted for V1.

## Upgrade trigger

- Any path that forwards a customer-uploaded file to a third party, or
- First B2B contract requiring AV as a control.
- At that point: add a Fly.io ClamAV worker + Inngest step.
