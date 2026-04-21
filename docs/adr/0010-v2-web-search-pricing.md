# ADR 0010 — v2 Phase 3: Anthropic web_search for pricesearch items

Status: accepted, 2026-04-20

## Context

ADR 0009 shipped Phase 2 with a deliberate pricing-source compromise:
photo-detected items carry `source: "pricesearch"` but **no** `sourceUrl`,
because we can't license Craftsman or RSMeans and cannot verify that a
model-suggested URL actually resolves to the cited product. The master
prompt's non-negotiable #2 explicitly forbids fabricating citations.

That compromise weakens the benchmark match: the engineered study's
Appendix B cites real `https://www.wayfair.com/…` / `https://www.target.com/…`
URLs that a reviewer can click through to audit. Without URLs our
comparables are inferences-from-training-data, which is the weakest
source tier.

The missing piece is a way to make URLs **verifiable at generation time**.

## Decision

Use Anthropic's server-side `web_search_20250305` tool during the v2
classifier call when `V2_REPORT_WEB_SEARCH=1` is set. The model invokes
web search directly on Anthropic's infrastructure, receives live
results, and threads the retailer URL + price into each `pricesearch`
line item's `comparable.sourceUrl`.

Shipped surfaces:

1. **`lib/ai/call.ts` gets a `serverTools` param.** When present, the
   request body includes both the user's forced-output tool
   (`submit_schedule`) and any server tools. `tool_choice` stays as
   the forced-tool for the submit tool — server tools run
   transparently before the final submit. The input-hash key folds in
   the server-tool set so the AiAuditLog cache doesn't collide
   between search-on and search-off runs.

2. **`classify-assets-v2` opts into web search.** When the flag is on,
   the step passes `web_search_20250305` (max_uses 50) as a server
   tool, and the prompt's user message appends instructions:

   > "For each pricesearch line item, use web_search to find a real
   > current retailer URL (target.com / wayfair.com / homedepot.com /
   > lowes.com / amazon.com / ikea.com) for a comparable item. Populate
   > `comparable.sourceUrl` only when you locate a live URL that
   > corresponds to a real product matching the class. If no acceptable
   > result comes back, omit `sourceUrl` — never fabricate."

3. **`comparable.sourceUrl` becomes schema-optional.** The Zod schema
   adds `sourceUrl: z.string().url().optional()`. The validator does
   not _require_ a URL (so a failed search doesn't fail the whole
   schedule) but does require URL shape when present.

4. **Cost accounting.** `lib/ai/cost.ts` bills web_search at
   $10 / 1000 requests (Anthropic published rate, April 2026) using
   `response.usage.server_tool_use.web_search_requests`. AiAuditLog
   costUsd reflects both token spend and search spend.

5. **Domain allowlist.** The web_search tool is constrained to the
   five retailer domains above plus `.gov` (for Area Modification
   Factor lookups) and `.craftsman-book.com` (still disallowed as a
   `source` but legal to consult for defensible pricing). This
   prevents the model from pulling prices off junk SEO farms.

6. **Flag dependency.** `V2_REPORT_WEB_SEARCH` requires
   `V2_REPORT_CLASSIFIER=1`. Off path: Phase 2 behavior unchanged —
   pricesearch items emit without sourceUrl.

## Consequences

- **Cost per study rises ~$1–2.** A study with 100–150 photo-detected
  items may run 50–100 searches (model dedups and batches
  research). At $0.01/search that's under $2/study on top of the
  ~$0.60/study token spend.
- **Latency rises.** Each search runs server-side inside the same
  `messages.create` call; 50 searches add ~30–60s to Step C. That's
  within the minutes-long Inngest pipeline budget; no UX change.
- **URLs may still 404 eventually.** Web search returns live results
  at generation time but products get delisted. Mitigation: none
  per-line; the report footer gets a "Prices reflect retail data on
  report date {X}" disclosure in Phase 5.
- **No Craftsman / RSMeans.** Those data sets remain unlicensed and
  the `source` enum still policy-forbids them. A future ADR can
  reopen that decision once licensing is in place.

## Rollback

Unset `V2_REPORT_WEB_SEARCH`. Classifier v2 still works, just without
`sourceUrl` on pricesearch items — schema accepts absent URLs.

## Out of scope

- Caching retailer lookups across studies (a hot-product hit rate could
  cut per-study cost significantly). Defer until cost becomes an issue.
- Validating each URL is live at _report render_ time (HEAD request in
  the deliver step). Useful but noisy — would invalidate long-lived
  reports. Revisit if reviewers complain.
- Web search for the time-index and location-factor multipliers. Those
  live in narrow public ranges; prompt guardrails are sufficient.
