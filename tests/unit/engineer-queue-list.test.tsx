import { render } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import { EngineerQueueList } from "@/components/admin/EngineerQueueList";
import { BULK_MARK_FAILED_CAP } from "@/lib/studies/admin-limits";

/**
 * Regression for B6-2: before this fix, `toggleAll()` selected every row on
 * the page without respecting the server's `BULK_MARK_FAILED_CAP` (50). An
 * engineer queue with, say, 75 rows would let the admin pick all 75 with one
 * click, type a reason, and only then discover the server rejected the batch
 * with "capped at 50 — do it in batches." The user then has to count-out 25
 * rows to deselect. Bad loop. Now the select-all button picks up to 50 and
 * shows a small "caps at 50 per batch" banner.
 *
 * Mocks: `adminBulkMarkFailedAction` is imported for its type only by the
 * component; we don't invoke the submit path here, so no mock is needed for
 * this behavior. `useRouter` is replaced with a noop so render doesn't throw.
 */

// Stub `next/navigation` so useRouter() + any redirects inside the dialog
// tree don't blow up under jsdom. We're not exercising router effects here.
vi.mock("next/navigation", async () => ({
  useRouter: () => ({ refresh: () => undefined, push: () => undefined }),
}));

// Stub sonner so the toast module doesn't try to portal outside the test DOM.
vi.mock("sonner", () => ({ toast: { success: () => undefined, error: () => undefined } }));

function fakeItems(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `s-${i}`,
    label: `Study ${i}`,
    node: <div data-testid={`row-${i}`}>row {i}</div>,
  }));
}

describe("EngineerQueueList — select-all cap (B6-2)", () => {
  it("with items under the cap, select-all picks every row", () => {
    const items = fakeItems(10);
    const { getByLabelText, getByText } = render(<EngineerQueueList items={items} />);
    const selectAll = getByLabelText(/select all rows/i);
    act(() => {
      (selectAll as HTMLInputElement).click();
    });
    expect(getByText(/10 selected/)).toBeTruthy();
  });

  it(`with items at the cap (${BULK_MARK_FAILED_CAP}), select-all picks every row`, () => {
    const items = fakeItems(BULK_MARK_FAILED_CAP);
    const { getByLabelText, getByText } = render(<EngineerQueueList items={items} />);
    const selectAll = getByLabelText(/select all rows/i);
    act(() => {
      (selectAll as HTMLInputElement).click();
    });
    expect(getByText(new RegExp(`${BULK_MARK_FAILED_CAP} selected`))).toBeTruthy();
  });

  it(`with more items than the cap, select-all caps at ${BULK_MARK_FAILED_CAP} and shows a hint`, () => {
    const items = fakeItems(BULK_MARK_FAILED_CAP + 25);
    const { getByLabelText, getByText } = render(<EngineerQueueList items={items} />);

    // Before click: hint about the cap is visible alongside the queue size.
    expect(
      getByText(new RegExp(`select-all caps at ${BULK_MARK_FAILED_CAP} per batch`, "i")),
      "cap hint missing in select-all header",
    ).toBeTruthy();

    const selectAll = getByLabelText(/select all rows/i);
    act(() => {
      (selectAll as HTMLInputElement).click();
    });
    // Selection is capped, not 75.
    expect(getByText(new RegExp(`${BULK_MARK_FAILED_CAP} selected`))).toBeTruthy();
  });

  it("select-all on an already-selected cap clears the selection", () => {
    const items = fakeItems(BULK_MARK_FAILED_CAP + 10);
    const { getByLabelText, queryByText } = render(<EngineerQueueList items={items} />);
    const selectAll = getByLabelText(/select all rows/i);
    act(() => {
      (selectAll as HTMLInputElement).click();
    });
    expect(queryByText(new RegExp(`${BULK_MARK_FAILED_CAP} selected`))).toBeTruthy();
    act(() => {
      (selectAll as HTMLInputElement).click();
    });
    expect(queryByText(/selected/i, { selector: "span" })).toBeNull();
  });
});
