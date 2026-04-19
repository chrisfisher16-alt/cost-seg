-- Add DIY to the Tier enum for the $149 self-serve tier.
-- Safe to apply: additive enum extension, no row rewrites, no downtime.

ALTER TYPE "Tier" ADD VALUE IF NOT EXISTS 'DIY' BEFORE 'AI_REPORT';
