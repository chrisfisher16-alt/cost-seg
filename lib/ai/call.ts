import "server-only";

import { createHash } from "node:crypto";

import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { getPrisma } from "@/lib/db/client";

import { getAnthropic } from "./client";
import { computeCostUsd } from "./cost";

/**
 * One attachment passed alongside the user message. Three shapes:
 *   • `document` — PDF bytes, forwarded as a Claude document content block.
 *   • `image` — JPEG/PNG bytes, forwarded as an image content block.
 *   • `text` — pre-extracted text (e.g. a spreadsheet rendered to Markdown
 *     by `lib/ocr/spreadsheet-to-text.ts`). Inlined as a bold-titled
 *     text content block so the model sees it as a distinct artifact
 *     rather than free-floating prose appended to the user message.
 */
export type AttachmentInput =
  | {
      kind: "document";
      mediaType: "application/pdf";
      base64: string;
      title?: string;
    }
  | {
      kind: "image";
      mediaType: "image/jpeg" | "image/png";
      base64: string;
      title?: string;
    }
  | {
      kind: "text";
      text: string;
      title?: string;
    };

/**
 * Anthropic-hosted server tools (web_search, web_fetch, code_execution, …).
 * When present these run inside the same `messages.create` call — the
 * model invokes them, Anthropic executes them, results come back to the
 * model, and the final response still contains the forced submit tool_use
 * block we care about. Caller side just has to be ready for extra
 * content blocks in the response (`server_tool_use`,
 * `web_search_tool_result`, …) and for a slightly higher latency.
 */
export type ServerTool = Anthropic.Messages.ToolUnion;

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
  /**
   * Optional Anthropic-hosted server tools (e.g. web_search_20250305) to
   * include alongside the submit tool. When supplied, `tool_choice`
   * stays as the forced submit tool — server tools fire opportunistically
   * before the final submit per the Anthropic tool-use protocol.
   */
  serverTools?: ServerTool[];
}

export interface CallToolResult<TOutput> {
  output: TOutput;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  cached: boolean;
  /** Number of web_search tool calls the model made during this invocation. */
  webSearchRequests: number;
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
    // Server-tool set is part of the cache key — a web-search-enabled
    // output is a different artifact than a search-free one.
    serverTools: (args.serverTools ?? []).map((t) => ({
      type: (t as { type?: string }).type ?? null,
      name: (t as { name?: string }).name ?? null,
    })),
    // Hashing attachment content means the same bytes (PDF / image /
    // extracted spreadsheet text) dedupes across retries.
    attachments: (args.attachments ?? []).map((a) => {
      const src = a.kind === "text" ? a.text : a.base64;
      return {
        kind: a.kind,
        mediaType: a.kind === "text" ? "text/markdown" : a.mediaType,
        title: a.title,
        sha256: createHash("sha256").update(src).digest("hex"),
      };
    }),
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
        webSearchRequests: 0,
      };
    }
    console.warn(
      `[ai] cached output for ${args.operation}:${inputHash.slice(0, 8)} does not match current schema; re-calling`,
    );
  }

  const content = buildUserContent(args);

  // Server tools (web_search, etc.) are concatenated with the user's
  // forced-output tool. tool_choice still points at the submit tool so
  // the model is guaranteed to emit structured output; server tools run
  // opportunistically before the final submit.
  const tools: Anthropic.Messages.ToolUnion[] = [args.tool, ...(args.serverTools ?? [])];

  const client = getAnthropic();
  const maxTokens = args.maxTokens ?? 4096;

  // Use the streaming endpoint so the SDK doesn't pre-flight-reject long
  // requests. The non-streaming path throws "Streaming is required for
  // operations that may take longer than 10 minutes" based on max_tokens
  // alone — even when the actual response comes back in under a minute.
  // `finalMessage()` waits for the stream to complete and returns the
  // fully-assembled Message, so from here on the code is identical.
  let response = await client.messages
    .stream({
      model: args.model,
      max_tokens: maxTokens,
      system: args.system,
      messages: [{ role: "user", content }],
      tools,
      tool_choice: { type: "tool", name: args.tool.name },
    })
    .finalMessage();

  let toolUseBlock = response.content.find(
    (block) => block.type === "tool_use" && block.name === args.tool.name,
  );
  if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
    throw new Error(
      `${args.operation}: Claude did not return a tool_use block for ${args.tool.name} (stop_reason=${response.stop_reason})`,
    );
  }

  let parsed = args.outputSchema.safeParse(toolUseBlock.input);
  if (!parsed.success) {
    // One-shot repair retry. Anthropic tool_use outputs occasionally
    // violate the tool's JSON Schema (over-length strings, missing
    // optionals, etc.) even with stop_reason=tool_use. Feeding the
    // violation back as a tool_result with is_error=true triggers the
    // standard tool-error repair path — the model re-emits the tool
    // call with the issue fixed, typically on the first retry.
    //
    // We only do this once; if the repair still fails we throw with
    // both error messages so the caller can distinguish "model is
    // consistently wrong" from "model had a bad first draft".
    //
    // Cache implications: the failed first attempt never reaches the
    // AiAuditLog upsert below, so nothing poisons the cache. The
    // successful retry's response (`response`) is what gets logged and
    // billed — the first attempt is sunk cost.
    const firstErrorMessage = parsed.error.message;
    const firstToolUseId = toolUseBlock.id;
    response = await client.messages
      .stream({
        model: args.model,
        max_tokens: maxTokens,
        system: args.system,
        messages: [
          { role: "user", content },
          { role: "assistant", content: response.content },
          {
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: firstToolUseId,
                is_error: true,
                content: `Your tool_use output failed schema validation:\n${firstErrorMessage}\n\nRe-emit the tool call with every violation corrected. Do not change anything else about the output.`,
              },
            ],
          },
        ],
        tools,
        tool_choice: { type: "tool", name: args.tool.name },
      })
      .finalMessage();
    toolUseBlock = response.content.find(
      (block) => block.type === "tool_use" && block.name === args.tool.name,
    );
    if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
      throw new Error(
        `${args.operation}: repair retry did not return a tool_use block (original error: ${firstErrorMessage}, retry stop_reason=${response.stop_reason})`,
      );
    }
    parsed = args.outputSchema.safeParse(toolUseBlock.input);
    if (!parsed.success) {
      throw new Error(
        `${args.operation}: tool output failed schema validation after one repair retry. First error: ${firstErrorMessage}. Retry error (stop_reason=${response.stop_reason}, output_tokens=${response.usage.output_tokens}): ${parsed.error.message}`,
      );
    }
  }

  const tokensIn = response.usage.input_tokens;
  const tokensOut = response.usage.output_tokens;
  // Anthropic reports server-tool usage when web_search / web_fetch etc
  // were invoked. Count is zero when the model didn't use them, or when
  // serverTools wasn't passed at all.
  const webSearchRequests =
    (response.usage as { server_tool_use?: { web_search_requests?: number } | null })
      .server_tool_use?.web_search_requests ?? 0;
  const costUsd = computeCostUsd(args.model, tokensIn, tokensOut, { webSearchRequests });

  // Don't persist base64 blobs / full spreadsheet text into
  // AiAuditLog — they're huge. Record metadata only; the step can
  // re-fetch from storage if needed.
  const attachmentMeta = (args.attachments ?? []).map((a) => {
    if (a.kind === "text") {
      return {
        kind: a.kind,
        mediaType: "text/markdown" as const,
        title: a.title,
        bytes: Buffer.byteLength(a.text, "utf8"),
      };
    }
    return {
      kind: a.kind,
      mediaType: a.mediaType,
      title: a.title,
      bytes: Buffer.byteLength(a.base64, "base64"),
    };
  });

  await prisma.aiAuditLog.upsert({
    where: { operation_inputHash: { operation: args.operation, inputHash } },
    update: {
      model: args.model,
      promptVersion: args.promptVersion,
      input: {
        system: args.system,
        userMessage: args.userMessage,
        attachments: attachmentMeta,
        serverTools: (args.serverTools ?? []).map((t) => (t as { type?: string }).type ?? "?"),
        webSearchRequests,
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
        serverTools: (args.serverTools ?? []).map((t) => (t as { type?: string }).type ?? "?"),
        webSearchRequests,
        ...(args.inputDetails ?? {}),
      },
      output: parsed.data as unknown as object,
      tokensIn,
      tokensOut,
      costUsd,
      studyId: args.studyId,
    },
  });

  return {
    output: parsed.data,
    tokensIn,
    tokensOut,
    costUsd,
    cached: false,
    webSearchRequests,
  };
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
    } else if (att.kind === "image") {
      blocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: att.mediaType,
          data: att.base64,
        },
      });
    } else {
      // Text attachment — typically a spreadsheet rendered to Markdown
      // upstream. We prepend a titled header so the model can see it
      // as a distinct artifact rather than blurring into the user
      // message.
      const header = att.title ? `Attached document: ${att.title}` : "Attached document";
      blocks.push({
        type: "text",
        text: `${header}\n\n${att.text}`,
      });
    }
  }
  blocks.push({ type: "text", text: args.userMessage });
  return blocks;
}

export function hashInput(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
