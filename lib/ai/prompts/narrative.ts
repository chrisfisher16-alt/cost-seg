import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

export const NARRATIVE_PROMPT_VERSION = "narrative@v1";

export const NARRATIVE_SYSTEM = `You are a senior cost-segregation analyst drafting the narrative sections of a study report.

You will be given the full property summary, land/building decomposition (Step B), and the validated asset schedule (Step C). You write the prose that surrounds the numbers.

Audience:
  • The customer's CPA, reading to decide whether to rely on the schedule.
  • For Tier 1 reports, the customer's curiosity — they want to understand what was done.
  • For Tier 2 reports, a licensed PE who will sign it.

Tone: confident but precise. Avoid marketing language. Do not oversell.

Hard rules:
  • Output ONLY via the submit_narrative tool.
  • All sections are Markdown strings.
  • Dollar amounts in prose use "$1,234,567" format with the dollar sign and commas.
  • Depreciation classes are written "5-year", "15-year", "27.5-year", "39-year".
  • Do NOT quote exact tax liability savings — those depend on the buyer's bracket. Describe the reclassified basis only.
  • Do NOT include the scope disclosure — it ships separately, verbatim, from §8.
  • Do not claim the report is an engineered study unless the tier explicitly supports it.`;

export const NARRATIVE_TOOL: Anthropic.Messages.Tool = {
  name: "submit_narrative",
  description: "Record the five narrative sections of the study.",
  input_schema: {
    type: "object",
    properties: {
      executiveSummary: { type: "string", minLength: 1, maxLength: 2400 },
      propertyDescription: { type: "string", minLength: 1, maxLength: 2400 },
      methodology: { type: "string", minLength: 1, maxLength: 3600 },
      assetScheduleExplanation: { type: "string", minLength: 1, maxLength: 4800 },
      scheduleSummaryTable: {
        type: "string",
        description: "A short Markdown table recapping totals by depreciation class.",
        minLength: 1,
        maxLength: 1200,
      },
    },
    required: [
      "executiveSummary",
      "propertyDescription",
      "methodology",
      "assetScheduleExplanation",
      "scheduleSummaryTable",
    ],
  },
};

export const narrativeOutputSchema = z.object({
  executiveSummary: z.string().min(1).max(2400),
  propertyDescription: z.string().min(1).max(2400),
  methodology: z.string().min(1).max(3600),
  assetScheduleExplanation: z.string().min(1).max(4800),
  scheduleSummaryTable: z.string().min(1).max(1200),
});

export type NarrativeOutput = z.infer<typeof narrativeOutputSchema>;

export interface NarrativePromptInput {
  tier: "AI_REPORT" | "ENGINEER_REVIEWED";
  propertyType: string;
  address: string;
  squareFeet: number | null;
  yearBuilt: number | null;
  acquiredAtIso: string;
  decomposition: Record<string, unknown>;
  schedule: Record<string, unknown>;
}

export function buildNarrativeUserPrompt(input: NarrativePromptInput): string {
  return [
    `Tier: ${input.tier}`,
    `Property type: ${input.propertyType}`,
    `Address: ${input.address}`,
    `Square feet: ${input.squareFeet ?? "unknown"}`,
    `Year built: ${input.yearBuilt ?? "unknown"}`,
    `Acquired: ${input.acquiredAtIso}`,
    "",
    "Step B decomposition (JSON):",
    "```json",
    JSON.stringify(input.decomposition, null, 2),
    "```",
    "",
    "Step C asset schedule (JSON):",
    "```json",
    JSON.stringify(input.schedule, null, 2),
    "```",
    "",
    "Produce the five narrative sections.",
  ].join("\n");
}
