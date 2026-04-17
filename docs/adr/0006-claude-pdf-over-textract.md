# ADR 0006 — Claude reads PDFs directly; Textract deferred

Status: accepted, 2026-04-17

## Context

Master prompt §3 specifies AWS Textract for "structured extraction of closing
disclosures" and Claude for normalization / classification / narrative. In
practice, Textract's sync API is limited to single-page documents when
supplied inline bytes — and closing disclosures are multi-page. Supporting
multi-page with Textract requires staging every uploaded PDF in S3, polling
`StartDocumentAnalysis`, and cleaning up afterwards — materially more
surface area than we want in V1 for a solo-operator launch.

Claude Opus 4.7 accepts PDFs directly in `messages.create` via
`document` content blocks. With tool use we force structured JSON output
in a single call.

## Decision

V1 skips Textract. The AI pipeline (§7, Steps A–D) sends uploaded PDFs and
images to Claude Opus 4.7 / Sonnet 4.6 via base64 `document` / `image`
content blocks and relies on tool-use schemas for structured extraction.

The abstraction point is [`lib/ai/call.ts`](../../lib/ai/call.ts). It accepts
a list of `AttachmentInput` objects so the individual steps don't know the
transport — swapping Textract in later changes only the OCR helper, not the
steps.

## Consequences

- No S3 bucket, no Textract IAM policy, no async poller to operate.
- Per-CD cost is higher than Textract (~$0.30–$0.60 vs. Textract's ~$0.01
  per page). Opus 4.7 Phase 5 budget accepts this tradeoff; we re-evaluate
  at 100 paid studies.
- Quality depends on Claude's PDF vision rather than a purpose-built
  extractor. Opus 4.7 on closing disclosures is very strong; monitored via
  `AiAuditLog.output` review.

## Upgrade trigger

- Extraction accuracy drops below 95% against a labeled set, or
- Per-study AI spend exceeds $5 and a cost audit shows PDF reads dominate,
- Or a customer supplies a scanned (image-only) PDF that Claude struggles
  with.

When triggered, add:

1. `@aws-sdk/client-s3` staging
2. `lib/ocr/textract.ts` with `StartDocumentAnalysis` + poller
3. Swap the OCR helper the AI steps call

The step contracts don't change — Step A still takes a document and emits a
classification + extracted fields.
