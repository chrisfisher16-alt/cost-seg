/**
 * Skip-to-content link — WCAG 2.4.1 (Bypass Blocks).
 *
 * Hidden until focused; keyboard users can tab to it on any page and jump past
 * the header into the main content region. Targets `#main-content`, which is
 * set on the `<main>` element in every route-group layout.
 */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="bg-primary text-primary-foreground focus-visible:outline-ring sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-md focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      Skip to content
    </a>
  );
}
