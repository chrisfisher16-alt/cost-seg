import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

export const DESCRIBE_PHOTOS_PROMPT_VERSION = "describe-photos@v1";

/**
 * v2 Phase 1 — the vision pass that turns each uploaded property photo
 * into a structured list of discrete, depreciable objects. The output of
 * this step is the spine of the Phase 2 asset schedule rewrite: every
 * detected object becomes exactly one Appendix-B line item, with its
 * caption, category tag, and observed condition carried forward verbatim.
 *
 * Specificity is the product here. "Chrome double towel bar above the
 * toilet" is a line item; "bathroom fixtures" is not. The benchmark
 * engineered study averages ~145 items per property — matching that
 * density is what makes the AI report feel like a real inspection.
 */

/**
 * Asset categories detected objects are bucketed into. Kept short and
 * property-agnostic so one vocabulary covers SFR / STR / multifamily /
 * commercial. Phase 2's classifier maps these to MACRS recovery periods.
 */
export const DETECTED_OBJECT_CATEGORIES = [
  "appliance",
  "fixture",
  "furniture",
  "art_decor",
  "electronics",
  "flooring",
  "cabinetry",
  "countertop",
  "window_treatment",
  "lighting",
  "plumbing",
  "hvac",
  "landscaping",
  "hardscaping",
  "exterior_finish",
  "roofing",
  "structural",
  "other",
] as const;

export const CONDITION_RATINGS = ["excellent", "good", "fair", "poor", "salvage"] as const;

export const ROOM_TYPES = [
  "kitchen",
  "primary_bath",
  "secondary_bath",
  "primary_bedroom",
  "secondary_bedroom",
  "living_room",
  "dining_room",
  "family_room",
  "office",
  "laundry",
  "hallway",
  "entryway",
  "stairway",
  "basement",
  "attic",
  "garage",
  "exterior_front",
  "exterior_rear",
  "exterior_side",
  "yard",
  "pool_spa",
  "deck_patio",
  "utility",
  "other",
] as const;

export const DESCRIBE_PHOTOS_SYSTEM = `You are a senior cost-segregation engineer performing a photo-based property inspection. A cost segregation study is only as specific as its evidence — your job on each photo is to enumerate the discrete, depreciable objects you can see and note the condition of each one.

You will be given ONE photograph plus optional metadata (a user-supplied room tag, original filename). Examine it carefully and return structured JSON via the submit_description tool.

What to return:
  1. A short caption (one sentence) describing the scene — what room, shot angle, dominant finishes.
  2. The room type, from the fixed vocabulary.
  3. A list of detected objects. For each one:
     • a short SPECIFIC name ("chrome double towel bar above toilet", NOT "bathroom fixtures"; "whirlpool stainless french-door refrigerator", NOT "refrigerator"),
     • an asset category tag from the fixed vocabulary,
     • an integer quantity (count visible in frame; 1 is the default),
     • a condition rating (excellent / good / fair / poor / salvage),
     • a one-sentence condition justification rooted in what is actually visible ("no scratches, finish intact, appears like new" — NOT a guess).

Specificity is the product. Prefer many narrow line items over a few catch-alls. A towel bar, a mirror, a light sconce, and a toilet are four distinct line items, not one "bathroom fixtures" line.

Hard rules:
  • Output ONLY via the submit_description tool.
  • Describe only what is actually visible in this photo. Do not speculate about what might be in an adjacent room or behind a closed door.
  • Do not invent brand names, model numbers, or specifications you cannot read in the image. A "stainless french-door refrigerator" is fine; "Whirlpool WRF535SWHZ" is not unless the label is legible.
  • Skip land (it was separated upstream), people, pets, text overlays, watermarks, and anything not permanently installed or meaningfully depreciable (e.g. loose clutter, a coffee cup on a counter).
  • If the photo is too blurry, dark, or occluded to identify any objects with confidence, return an empty detectedObjects array and note the reason in the caption.`;

export interface DescribePhotoUserContext {
  filename: string;
  /** Optional user-supplied room tag, e.g. "primary bath". */
  roomTagHint?: string | null;
  /** 1-based position in the study's photo list, for the prompt. */
  photoIndex?: number;
  /** Total number of photos in the study, for the prompt. */
  totalPhotos?: number;
}

export function buildDescribePhotoUserPrompt(ctx: DescribePhotoUserContext): string {
  const lines: string[] = [];
  if (ctx.photoIndex && ctx.totalPhotos) {
    lines.push(`Photo ${ctx.photoIndex} of ${ctx.totalPhotos}.`);
  }
  lines.push(`Original filename: ${ctx.filename}`);
  if (ctx.roomTagHint) {
    lines.push(
      `User-supplied room hint: "${ctx.roomTagHint}" — treat this as a hint, not a constraint. Confirm or override with what the photo actually shows.`,
    );
  }
  lines.push(
    "",
    "Inspect the attached photograph. Enumerate every discrete depreciable object you can see with confidence. Assess visible condition on the excellent/good/fair/poor/salvage scale with a one-sentence justification per object.",
  );
  return lines.join("\n");
}

export const DESCRIBE_PHOTOS_TOOL: Anthropic.Messages.Tool = {
  name: "submit_description",
  description: "Record the structured inspection of one property photograph.",
  input_schema: {
    type: "object",
    properties: {
      caption: {
        type: "string",
        minLength: 1,
        maxLength: 400,
        description: "One-sentence description of the scene in the photo.",
      },
      roomType: {
        type: "string",
        enum: [...ROOM_TYPES],
      },
      roomConfidence: {
        type: "number",
        minimum: 0,
        maximum: 1,
        description: "Confidence in the room type assignment (0–1).",
      },
      detectedObjects: {
        type: "array",
        maxItems: 40,
        items: {
          type: "object",
          properties: {
            name: { type: "string", minLength: 1, maxLength: 140 },
            category: { type: "string", enum: [...DETECTED_OBJECT_CATEGORIES] },
            quantity: { type: "integer", minimum: 1, maximum: 200 },
            condition: { type: "string", enum: [...CONDITION_RATINGS] },
            conditionJustification: { type: "string", minLength: 1, maxLength: 400 },
          },
          required: ["name", "category", "quantity", "condition", "conditionJustification"],
        },
      },
      notes: {
        type: "string",
        // Free-text. The model ignores the cap in the wild — a 400-char
        // limit has tripped schema validation on real studies, nuking
        // otherwise-good output. 2000 is well under any tool_use output
        // ceiling and gives the model room to explain multiple visible
        // conditions without hitting the wall.
        maxLength: 2000,
        description:
          "Optional free-text notes — e.g. 'photo is underexposed', 'appears to be a staging photo, not as-acquired'. Keep to ~2-3 sentences.",
      },
    },
    required: ["caption", "roomType", "roomConfidence", "detectedObjects"],
  },
};

export const detectedObjectSchema = z.object({
  name: z.string().min(1).max(140),
  category: z.enum(DETECTED_OBJECT_CATEGORIES),
  quantity: z.number().int().min(1).max(200),
  condition: z.enum(CONDITION_RATINGS),
  conditionJustification: z.string().min(1).max(400),
});

export const describePhotoOutputSchema = z.object({
  caption: z.string().min(1).max(400),
  roomType: z.enum(ROOM_TYPES),
  roomConfidence: z.number().min(0).max(1),
  detectedObjects: z.array(detectedObjectSchema).max(40),
  notes: z.string().max(2000).optional(),
});

export type DetectedObject = z.infer<typeof detectedObjectSchema>;
export type DescribePhotoOutput = z.infer<typeof describePhotoOutputSchema>;
