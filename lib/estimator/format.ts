const usd0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatUsd(cents: number): string {
  return usd0.format(Math.round(cents / 100));
}

export function formatUsdRange(lowCents: number, highCents: number): string {
  return `${formatUsd(lowCents)}–${formatUsd(highCents)}`;
}

export function parseUsdInputToCents(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.]/g, "").trim();
  if (!cleaned) return null;
  const parsed = Number.parseFloat(cleaned);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100);
}
