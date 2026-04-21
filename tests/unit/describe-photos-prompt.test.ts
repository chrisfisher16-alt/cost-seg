import { describe, expect, it } from "vitest";

import {
  CONDITION_RATINGS,
  DESCRIBE_PHOTOS_PROMPT_VERSION,
  DESCRIBE_PHOTOS_SYSTEM,
  DESCRIBE_PHOTOS_TOOL,
  DETECTED_OBJECT_CATEGORIES,
  ROOM_TYPES,
  buildDescribePhotoUserPrompt,
  describePhotoOutputSchema,
} from "@/lib/ai/prompts/describe-photos";

/**
 * Shape tests for the v2 Phase 1 vision prompt. Verifies:
 *   • Prompt version is stamped (AiAuditLog.promptVersion depends on it).
 *   • The system prompt preserves the key behaviors the engineer handoff
 *     requires: specificity, no fabrication, single-photo scope.
 *   • The tool schema + Zod schema agree on required fields.
 *   • The user-prompt builder threads optional hints through.
 */

describe("describe-photos prompt", () => {
  it("stamps a stable prompt version", () => {
    expect(DESCRIBE_PHOTOS_PROMPT_VERSION).toBe("describe-photos@v1");
  });

  it("system prompt enforces the non-negotiable rules", () => {
    // Specificity — the whole point of v2 Phase 1.
    expect(DESCRIBE_PHOTOS_SYSTEM).toMatch(/specific/i);
    // No brand-model fabrication.
    expect(DESCRIBE_PHOTOS_SYSTEM).toMatch(/do not invent brand names/i);
    // No hallucinating past the frame.
    expect(DESCRIBE_PHOTOS_SYSTEM).toMatch(/only what is actually visible/i);
    // Forced tool-use path.
    expect(DESCRIBE_PHOTOS_SYSTEM).toMatch(/submit_description/);
  });

  it("exposes a non-empty, deduplicated category / condition / room vocabulary", () => {
    expect(DETECTED_OBJECT_CATEGORIES.length).toBeGreaterThan(5);
    expect(new Set(DETECTED_OBJECT_CATEGORIES).size).toBe(DETECTED_OBJECT_CATEGORIES.length);
    expect(CONDITION_RATINGS).toEqual(["excellent", "good", "fair", "poor", "salvage"]);
    expect(new Set(ROOM_TYPES).size).toBe(ROOM_TYPES.length);
    expect(ROOM_TYPES).toContain("kitchen");
    expect(ROOM_TYPES).toContain("exterior_front");
  });

  it("tool schema and Zod schema agree on required top-level fields", () => {
    const toolSchema = DESCRIBE_PHOTOS_TOOL.input_schema as {
      required: string[];
      properties: Record<string, unknown>;
    };
    expect(toolSchema.required).toEqual(
      expect.arrayContaining(["caption", "roomType", "roomConfidence", "detectedObjects"]),
    );
    // Zod accepts valid minimal payload
    const ok = describePhotoOutputSchema.safeParse({
      caption: "Empty bathroom",
      roomType: "primary_bath",
      roomConfidence: 0.9,
      detectedObjects: [],
    });
    expect(ok.success).toBe(true);
  });

  it("Zod schema rejects bad enum values", () => {
    const bad = describePhotoOutputSchema.safeParse({
      caption: "room",
      roomType: "not_a_room",
      roomConfidence: 0.5,
      detectedObjects: [],
    });
    expect(bad.success).toBe(false);
  });

  it("Zod schema enforces per-object shape", () => {
    const bad = describePhotoOutputSchema.safeParse({
      caption: "Kitchen",
      roomType: "kitchen",
      roomConfidence: 0.95,
      detectedObjects: [
        {
          name: "Refrigerator",
          category: "not_a_category",
          quantity: 1,
          condition: "good",
          conditionJustification: "normal wear",
        },
      ],
    });
    expect(bad.success).toBe(false);
  });

  it("Zod schema caps detected objects at 40", () => {
    const objects = Array.from({ length: 41 }, (_, i) => ({
      name: `object-${i}`,
      category: "other" as const,
      quantity: 1,
      condition: "good" as const,
      conditionJustification: "ok",
    }));
    const bad = describePhotoOutputSchema.safeParse({
      caption: "overpopulated photo",
      roomType: "other",
      roomConfidence: 0.5,
      detectedObjects: objects,
    });
    expect(bad.success).toBe(false);
  });

  it("user prompt includes photo index and filename when provided", () => {
    const text = buildDescribePhotoUserPrompt({
      filename: "IMG_2033.jpg",
      photoIndex: 3,
      totalPhotos: 12,
    });
    expect(text).toContain("Photo 3 of 12");
    expect(text).toContain("IMG_2033.jpg");
    expect(text).toMatch(/enumerate every discrete depreciable object/i);
  });

  it("user prompt threads the room tag hint when present but marks it advisory", () => {
    const text = buildDescribePhotoUserPrompt({
      filename: "kitchen.jpg",
      roomTagHint: "kitchen",
    });
    expect(text).toContain('"kitchen"');
    expect(text).toMatch(/hint, not a constraint/i);
  });

  it("user prompt omits the hint line when no room tag is supplied", () => {
    const text = buildDescribePhotoUserPrompt({ filename: "photo.jpg" });
    expect(text).not.toMatch(/room hint/i);
  });
});
