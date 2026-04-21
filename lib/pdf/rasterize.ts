import "server-only";

/**
 * v2 Phase 7b (ADR 0013) — PDF → PNG rasterization.
 *
 * Wraps `pdf-to-png-converter` (which under the hood uses pdfjs-dist +
 * @napi-rs/canvas) behind a dynamic import. The dep is NOT declared in
 * package.json in this PR — operators install it when they flip
 * `V2_REPORT_REVIEW=1`. Calling `rasterizePdfToPngs` without the dep
 * present throws a clear, actionable error.
 *
 * This indirection keeps us from committing to a native dep (and the
 * ~20MB bundle increase it brings on Vercel) before the feature is
 * proven on a real ~150-page v2 PDF. Swap to `@napi-rs/canvas` + a
 * direct pdfjs call if `pdf-to-png-converter`'s output quality or size
 * ends up disappointing.
 */

export interface RasterizedPage {
  /** 1-based page number within the source PDF. */
  pageNumber: number;
  png: Buffer;
}

export interface RasterizeOptions {
  /** DPI used to render each page. 150 matches the Phase 7b spec. */
  dpi?: number;
  /** Optional subset of 1-based page numbers to render. Omitted = all. */
  pages?: number[];
}

export const DEFAULT_RASTERIZE_DPI = 150;

const MISSING_DEP_MESSAGE =
  "pdf-to-png-converter is not installed. Install it before enabling V2_REPORT_REVIEW: `pnpm add pdf-to-png-converter`. See ADR 0013.";

type PdfToPngFn = (
  pdf: Buffer,
  options?: Record<string, unknown>,
) => Promise<Array<{ pageNumber: number; content: Buffer }>>;

/**
 * Lazy-load `pdf-to-png-converter`. Using `new Function` prevents the
 * TypeScript compiler from including the dep in its type graph (we
 * can't `import` a package that isn't in node_modules), and keeps
 * Webpack from attempting to bundle it at build time. This matches
 * the pattern `lib/supabase/admin.ts` uses for its optional dep.
 */
async function loadConverter(): Promise<PdfToPngFn> {
  try {
    const dynamicImport = new Function("s", "return import(s)") as (
      s: string,
    ) => Promise<Record<string, unknown>>;
    const mod = await dynamicImport("pdf-to-png-converter");
    const fn = (mod.pdfToPng ??
      (mod as { default?: { pdfToPng?: PdfToPngFn } }).default?.pdfToPng) as PdfToPngFn | undefined;
    if (typeof fn !== "function") {
      throw new Error("pdf-to-png-converter: `pdfToPng` export not found.");
    }
    return fn;
  } catch (err) {
    const cause = err instanceof Error ? err.message : String(err);
    throw new Error(`${MISSING_DEP_MESSAGE} (load error: ${cause})`);
  }
}

/**
 * Rasterize every page of `pdf` to a PNG buffer. Preserves the page
 * numbering so the caller can feed the output straight into
 * `reviewReport` without re-aligning indices.
 *
 * Throws with a helpful message if the rasterizer dep is missing —
 * ops can fix without reading the stack trace.
 */
export async function rasterizePdfToPngs(
  pdf: Buffer,
  options: RasterizeOptions = {},
): Promise<RasterizedPage[]> {
  const converter = await loadConverter();
  const dpi = options.dpi ?? DEFAULT_RASTERIZE_DPI;
  const raw = await converter(pdf, {
    viewportScale: dpi / 72, // pdfjs renders at 72 DPI by default
    outputFileMask: "page",
    strictPagesToProcess: false,
    // pdf-to-png-converter accepts `pagesToProcess` as 1-based array.
    ...(options.pages ? { pagesToProcess: options.pages } : {}),
  });
  return raw.map((r) => ({ pageNumber: r.pageNumber, png: r.content }));
}

export const __testing = { MISSING_DEP_MESSAGE };
