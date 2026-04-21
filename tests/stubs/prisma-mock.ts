import { vi, type Mock } from "vitest";

/**
 * Lightweight Prisma stand-in for unit tests. Covers only the operations the
 * tested modules actually use. Return values are configured per-test via the
 * standard vi.fn() interface — e.g. `mocks.study.findUnique.mockResolvedValue(...)`.
 *
 * `$transaction` supports both styles the production code uses:
 *   - Batched array form: `await prisma.$transaction([p1, p2])` → awaits each in order, returns their results.
 *   - Interactive form: `await prisma.$transaction(async (tx) => { ... })` → invokes with the same mock client.
 *
 * If a test path calls a method not yet mocked, vitest surfaces a clear
 * "method is not a function" — add it to `makeMocks()` below when it comes up.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaPromise = Promise<any>;

export interface PrismaMocks {
  study: {
    findUnique: Mock;
    findFirst: Mock;
    findMany: Mock;
    update: Mock;
    updateMany: Mock;
    create: Mock;
  };
  studyShare: {
    findUnique: Mock;
    findFirst: Mock;
    findMany: Mock;
    update: Mock;
    create: Mock;
  };
  studyEvent: {
    create: Mock;
    findMany: Mock;
    findFirst: Mock;
  };
  user: {
    findUnique: Mock;
    upsert: Mock;
    update: Mock;
  };
  property: {
    update: Mock;
    create: Mock;
  };
  document: {
    create: Mock;
    findMany: Mock;
    delete: Mock;
    update: Mock;
  };
  $transaction: Mock;
}

function makeMocks(): PrismaMocks {
  return {
    study: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    studyShare: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    studyEvent: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    property: {
      update: vi.fn(),
      create: vi.fn(),
    },
    document: {
      create: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  };
}

export type PrismaMockClient = PrismaMocks;

export function createMockPrisma(): { prisma: PrismaMockClient; mocks: PrismaMocks } {
  const mocks = makeMocks();

  // $transaction defaults:
  //  - array form: Promise.all the inputs so nested awaits resolve.
  //  - interactive form: call the callback with the same mocks (so tx.study.update === mocks.study.update)
  mocks.$transaction.mockImplementation(async (arg: unknown) => {
    if (Array.isArray(arg)) {
      return Promise.all(arg as PrismaPromise[]);
    }
    if (typeof arg === "function") {
      return await (arg as (tx: PrismaMocks) => Promise<unknown>)(mocks);
    }
    throw new Error("$transaction called with an unexpected argument shape");
  });

  return { prisma: mocks, mocks };
}
