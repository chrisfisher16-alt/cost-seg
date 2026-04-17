import "server-only";

import Anthropic from "@anthropic-ai/sdk";

let instance: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (instance) return instance;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY is required to call Claude.");
  }
  instance = new Anthropic({ apiKey: key });
  return instance;
}
