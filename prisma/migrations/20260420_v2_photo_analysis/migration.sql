-- v2 Phase 1: photos become first-class inputs. Extend Document with
-- fields that the new `describe-photos` step populates on PROPERTY_PHOTO
-- rows. All columns are nullable; a retroactive migration for existing
-- photos is NOT required (we only need data for newly-processed studies).
--
-- Safe to apply: additive, no row rewrites, no table locks beyond the
-- metadata update.

ALTER TABLE "Document"
  ADD COLUMN "roomTag" TEXT,
  ADD COLUMN "imageWidth" INTEGER,
  ADD COLUMN "imageHeight" INTEGER,
  ADD COLUMN "photoAnalysis" JSONB;
