import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { env } from "@/lib/env";

let instance: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (instance) return instance;
  const { ANTHROPIC_API_KEY } = env();
  instance = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  return instance;
}
