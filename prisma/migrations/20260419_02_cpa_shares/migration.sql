-- Day 4 — CPA invite + shared workspace.
--
-- 1) Extend UserRole with CPA.
-- 2) Add the StudyShare model and its enum.

ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'CPA';

DO $$ BEGIN
  CREATE TYPE "StudyShareStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "StudyShare" (
  "id"            UUID              NOT NULL DEFAULT gen_random_uuid(),
  "studyId"       UUID              NOT NULL,
  "invitedEmail"  TEXT              NOT NULL,
  "invitedById"   UUID              NOT NULL,
  "acceptedById"  UUID,
  "status"        "StudyShareStatus" NOT NULL DEFAULT 'PENDING',
  "note"          TEXT,
  "token"         VARCHAR(64)       NOT NULL,
  "createdAt"     TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  "acceptedAt"    TIMESTAMPTZ,
  "revokedAt"     TIMESTAMPTZ,
  CONSTRAINT "StudyShare_pkey"               PRIMARY KEY ("id"),
  CONSTRAINT "StudyShare_token_key"          UNIQUE      ("token"),
  CONSTRAINT "StudyShare_studyId_fkey"       FOREIGN KEY ("studyId")      REFERENCES "Study"("id") ON DELETE CASCADE,
  CONSTRAINT "StudyShare_invitedById_fkey"   FOREIGN KEY ("invitedById")  REFERENCES "User"("id")  ON DELETE CASCADE,
  CONSTRAINT "StudyShare_acceptedById_fkey"  FOREIGN KEY ("acceptedById") REFERENCES "User"("id")
);

CREATE INDEX IF NOT EXISTS "StudyShare_studyId_idx"      ON "StudyShare"("studyId");
CREATE INDEX IF NOT EXISTS "StudyShare_acceptedById_idx" ON "StudyShare"("acceptedById");
CREATE INDEX IF NOT EXISTS "StudyShare_invitedEmail_idx" ON "StudyShare"("invitedEmail");
CREATE INDEX IF NOT EXISTS "StudyShare_status_idx"       ON "StudyShare"("status");
