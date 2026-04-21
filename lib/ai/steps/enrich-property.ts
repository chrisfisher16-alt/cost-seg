import "server-only";

import type Anthropic from "@anthropic-ai/sdk";

import { callTool, type ServerTool } from "@/lib/ai/call";
import { MODELS } from "@/lib/ai/models";
import {
  ENRICH_PROPERTY_PROMPT_VERSION,
  ENRICH_PROPERTY_SYSTEM,
  ENRICH_PROPERTY_TOOL,
  buildEnrichPropertyUserPrompt,
  enrichPropertyOutputSchema,
  type EnrichPropertyInput,
  type EnrichPropertyOutput,
} from "@/lib/ai/prompts/enrich-property";

/**
 * v2 Phase 4 (ADR 0011) — look up assessor + listing data for the
 * property via Anthropic's web_search tool. Broader domain allowlist
 * than the pricing search (Phase 3, ADR 0010): assessor sites live on
 * a long tail of .gov / .us / .org domains we can't enumerate.
 */
const ENRICHMENT_WEB_SEARCH_TOOL: Anthropic.Messages.WebSearchTool20250305 = {
  type: "web_search_20250305",
  name: "web_search",
  // 20 searches is enough for assessor + listing + a few fallbacks.
  // The step is one call per study so this doesn't compound.
  max_uses: 20,
  allowed_domains: [
    // Listing aggregators — stable enough to allowlist by name.
    "redfin.com",
    "www.redfin.com",
    "zillow.com",
    "www.zillow.com",
    "realtor.com",
    "www.realtor.com",
    "trulia.com",
    "www.trulia.com",
    // County assessor TLDs. We can't enumerate the long tail of
    // per-county .gov domains, so we allow TLDs the model can search
    // and then prompt it to reject non-authoritative results in the
    // system prompt.
    "*.gov",
    "*.us",
    // Many Texas + Florida + Ohio etc county appraisal districts live
    // on .org domains (gillespiecad.org, hcad.org).
    "*.org",
  ],
};

export async function enrichProperty(input: EnrichPropertyInput): Promise<EnrichPropertyOutput> {
  const serverTools: ServerTool[] = [ENRICHMENT_WEB_SEARCH_TOOL];
  const { output } = await callTool({
    operation: `enrich-property:${input.propertyId}`,
    promptVersion: ENRICH_PROPERTY_PROMPT_VERSION,
    model: MODELS.enrichProperty,
    system: ENRICH_PROPERTY_SYSTEM,
    userMessage: buildEnrichPropertyUserPrompt(input),
    tool: ENRICH_PROPERTY_TOOL,
    outputSchema: enrichPropertyOutputSchema,
    serverTools,
    // Enough room for the forced submit + ~15 web_search tool_use
    // blocks + their results.
    maxTokens: 8192,
    inputDetails: { address: input.address, propertyType: input.propertyType },
  });
  return output;
}
