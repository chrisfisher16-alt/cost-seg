import "server-only";

import { createHash } from "node:crypto";

import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { getPrisma } from "@/lib/db/client";

import { getAnthropic } from "./client";
import { computeCostUsd } from "./cost";

export interface AttachmentInput {
  kind: "document" | "image";
  mediaType: "application/pdf" | "image/jpeg" | "image/png";
  base64: string;
  title?: string;
}

export interface CallToolArgs<TOutput> {
  /** Stable operation name — keys the audit log + idempotency cache. */
  operation: string;
  /** Prompt version, mirrored into `AiAuditLog.promptVersion`. */
  promptVersion: string;
  /** Resolved Claude model, e.g. `claude-opus-4-7`. */
  model: string;
  system: string;
  userMessage: string;
  attachments?: AttachmentInput[];
  tool: Anthropic.Messages.Tool;
  outputSchema: z.ZodType<TOutput>;
  maxTokens?: number;
  studyId?: string;
  /** Optional supplementary input bits stored in the audit row for debugging. */
  inputDetails?: Record<string, unknown>;
}

export interface CallToolResult<TOutput> {
  output: TOutput;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  cached: boolean;
}

/**
 * Call Claude with a forced tool-use schema and persist everything to
 * `AiAuditLog`. Idempotent by (operation, inputHash) — repeat calls with
 * the exact same inputs return the cached output without re-invoking the
 * model (§7 conventions).
 *
 * This is the only place in the codebase that hits the Anthropic messages
 * endpoint. Every step under `lib/ai/steps/*` composes it.
 */
export async function callTool<TOutput>(
  args: CallToolArgs<TOutput>,
): Promise<CallToolResult<TOutput>> {
  const inputHash = hashInput({
    operation: args.operation,
    promptVersion: args.promptVersion,
    model: args.model,
    system: args.system,
    userMessage: args.userMessage,
    toolName: args.tool.name,
    // Hashing the base64 content means the same PDF dedupes across retries.
    attachments: (args.attachments ?? []).map((a) => ({
      kind: a.kind,
      mediaType: a.mediaType,
      title: a.title,
      sha256: createHash("sha256").update(a.base64).digest("hex"),
    })),
  });

  const prisma = getPrisma();
  const existing = await prisma.aiAuditLog.findUnique({
    where: { operation_inputHash: { operation: args.operation, inputHash } },
  });
  if (existing) {
    const parsed = args.outputSchema.safeParse(existing.output);
    if (parsed.success) {
      return {
        output: parsed.data,
        tokensIn: existing.tokensIn,
        tokensOut: existing.tokensOut,
        costUsd: Number(existing.costUsd),
        cached: true,
      };
    }
    console.warn(
      `[ai] cached output for ${args.operation}:${inputHash.slice(0, 8)} does not match current schema; re-calling`,
    );
  }

  const content = buildUserContent(args);

  const client = getAnthropic();
  const response = await client.messages.create({
    model: args.model,
    max_tokens: args.maxTokens ?? 4096,
    system: args.system,
    messages: [{ role: "user", content }],
    tools: [args.tool],
    tool_choice: { type: "tool", name: args.tool.name },
  });

  const toolUseBlock = response.content.find(
    (block) => block.type === "tool_use" && block.name === args.tool.name,
  );
  if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
    throw new Error(
      `${args.operation}: Claude did not return a tool_use block for ${args.tool.name}`,
    );
  }

  const parsed = args.outputSchema.safeParse(toolUseBlock.input);
  if (!parsed.success) {
    throw new Error(
      `${args.operation}: tool output failed schema validation: ${parsed.error.message}`,
    );
  }

  const tokensIn = response.usage.input_tokens;
  const tokensOut = response.usage.output_tokens;
  const costUsd = computeCostUsd(args.model, tokensIn, tokensOut);

  // Don't persist base64 blobs into AiAuditLog — they're huge. Record
  // metadata only; the step can re-fetch from storage if needed.
  const attachmentMeta = (args.attachments ?? []).map((a) => ({
    kind: a.kind,
    mediaType: a.mediaType,
    title: a.title,
    bytes: Buffer.byteLength(a.base64, "base64"),
  }));

  await prisma.aiAuditLog.upsert({
    where: { operation_inputHash: { operation: args.operation, inputHash } },
    update: {
      model: args.model,
      promptVersion: args.promptVersion,
      input: {
        system: args.system,
        userMessage: args.userMessage,
        attachments: attachmentMeta,
        ...(args.inputDetails ?? {}),
      },
      output: parsed.data as unknown as object,
      tokensIn,
      tokensOut,
      costUsd,
      studyId: args.studyId,
    },
    create: {
      operation: args.operation,
      promptVersion: args.promptVersion,
      model: args.model,
      inputHash,
      input: {
        system: args.system,
        userMessage: args.userMessage,
        attachments: attachmentMeta,
        ...(args.inputDetails ?? {}),
      },
      output: parsed.data as unknown as object,
      tokensIn,
      tokensOut,
      costUsd,
      studyId: args.studyId,
    },
  });

  return { output: parsed.data, tokensIn, tokensOut, costUsd, cached: false };
}

function buildUserContent<T>(args: CallToolArgs<T>): Anthropic.Messages.ContentBlockParam[] {
  const blocks: Anthropic.Messages.ContentBlockParam[] = [];
  for (const att of args.attachments ?? []) {
    if (att.kind === "document") {
      blocks.push({
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: att.base64,
        },
        ...(att.title ? { title: att.title } : {}),
      });
    } else {
      blocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: att.mediaType === "application/pdf" ? "image/jpeg" : att.mediaType,
          data: att.base64,
        },
      });
    }
  }
  blocks.push({ type: "text", text: args.userMessage });
  return blocks;
}

export function hashInput(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
