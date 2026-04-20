# Prisma migration baseline — reconciling local + live DB

> **Status:** pending user execution. Claude will not run destructive DB ops
> autonomously. This runbook is the step-by-step reconciliation plan.

## The drift

Local worktree has two migrations in `prisma/migrations/`:

- `20260419_add_diy_tier/` — `ALTER TYPE "Tier" ADD VALUE 'DIY'`
- `20260419_02_cpa_shares/` — CPA role value + `StudyShare` table

The live Supabase DB's `_prisma_migrations` history table was last known to
contain two older entries (per the Day-1 rebuild notes):

- `init`
- `add_manual_improvements`

Neither "init" nor "add_manual_improvements" exists as a folder under
`prisma/migrations/` on this branch — the Day-1 rebuild regenerated the
schema from scratch into a single Prisma `schema.prisma` and emitted the
two additive migrations above against a clean baseline. The live DB
therefore has:

- **Schema rows** for whatever "init" + "add*manual_improvements" defined
  (which \_should* be structurally identical to today's schema minus the
  two new migrations, but needs verification).
- **History rows** pointing at migration names Prisma no longer knows about.

Running `pnpm prisma migrate deploy` today against live would fail at the
drift-detection step because Prisma compares history-table names to the
migration folder names on disk.

## Reconciliation — four steps, two minutes of downtime

### Step 1: snapshot the live DB

From the operator machine:

```bash
# Verify connection first — should list Study, StudyEvent, StudyShare?, etc.
pnpm prisma db pull --print > /tmp/prod-schema-snapshot.prisma

# Full backup (Supabase daily backups exist too, but take a fresh one).
pg_dump "$DIRECT_URL" --schema=public --no-owner --no-privileges \
  > /tmp/prod-dump-$(date +%Y%m%d-%H%M).sql
```

Pull the `_prisma_migrations` history table so you can eyeball it:

```bash
psql "$DIRECT_URL" -c "SELECT migration_name, applied_steps_count, \
  finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at;"
```

**Expected output** — one of:

- `init` + `add_manual_improvements` only → go to Step 2.
- Includes one or both new migration names → the live DB is already ahead;
  **stop and re-read this doc** before going further.

### Step 2: diff the schemas

Compare `/tmp/prod-schema-snapshot.prisma` (live) against
`prisma/schema.prisma` (local) **after mentally subtracting** the two new
migrations' effects. The only differences you should see are:

- Live is missing the `DIY` enum value on `Tier`.
- Live is missing `'CPA'` on `UserRole`.
- Live is missing the `StudyShareStatus` enum + `StudyShare` table.

**If the diff shows anything else** — an extra column on Study, a missing
index, a different FK cascade — stop. Drift that isn't covered by the two
pending migrations needs investigation before you can safely baseline.

### Step 3: rewrite history

Prisma's history table needs to mention the migration names that exist on
disk, otherwise `migrate deploy` refuses to run. Easiest path: rename the
live history entries to match.

```sql
-- Run in a transaction so you can ROLLBACK on any surprise.
BEGIN;

-- Sanity check — should return the two legacy rows.
SELECT migration_name FROM _prisma_migrations;

-- Re-key the two legacy rows to names Prisma will recognize as "already
-- applied." We use the two new migration IDs here purely to satisfy the
-- NOT NULL + UNIQUE constraints on migration_name — the actual SQL body
-- of those migrations has NOT been applied yet; we'll fix that in Step 4.
UPDATE _prisma_migrations
   SET migration_name = '20260101_legacy_init'
 WHERE migration_name = 'init';

UPDATE _prisma_migrations
   SET migration_name = '20260101_legacy_add_manual_improvements'
 WHERE migration_name = 'add_manual_improvements';

-- Verify the rename stuck.
SELECT migration_name, finished_at IS NOT NULL AS finished
  FROM _prisma_migrations
  ORDER BY started_at;

-- Only commit if the two rows above read 20260101_legacy_* and finished=true.
COMMIT;
```

Then create the two placeholder folders locally so Prisma sees them as
"applied":

```bash
mkdir -p prisma/migrations/20260101_legacy_init
mkdir -p prisma/migrations/20260101_legacy_add_manual_improvements
# Empty migration.sql files are valid — Prisma only checks the folder exists
# plus the row in _prisma_migrations.
printf -- '-- Legacy baseline — applied before the Day 1 rebuild.\n' \
  > prisma/migrations/20260101_legacy_init/migration.sql
printf -- '-- Legacy migration — applied before the Day 1 rebuild.\n' \
  > prisma/migrations/20260101_legacy_add_manual_improvements/migration.sql
```

Commit these two folders — they now serve as the baseline anchor.

### Step 4: apply the two real migrations

```bash
# Should report two pending migrations: add_diy_tier + 02_cpa_shares.
pnpm prisma migrate status

# Apply.
pnpm prisma migrate deploy

# Verify — the status report should now read "Database schema is up to date."
pnpm prisma migrate status
```

### Step 5: verify from the app side

```bash
# Regenerate the client against the fresh schema.
pnpm prisma generate

# Fast smoke — all three must pass without schema errors.
pnpm typecheck && pnpm test && pnpm test:e2e
```

From the running app:

- Dashboard loads for an existing user (exercises `Study`, `User`, `StudyEvent`).
- `/pricing` → "Start the DIY plan" posts to checkout (exercises the `DIY` enum value).
- Admin can open a DELIVERED study and invite a CPA via email
  (exercises `UserRole=CPA` + `StudyShare`).

## Rollback

If anything misbehaves between Step 3 and the end of Step 5:

```bash
# Restore from the pg_dump captured in Step 1.
psql "$DIRECT_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
psql "$DIRECT_URL" < /tmp/prod-dump-<timestamp>.sql
```

Then re-read the diff from Step 2 — drift that wasn't accounted for is
the most likely reason a baseline went sideways.

## Why not `prisma migrate resolve --applied`?

`resolve --applied` works when a migration folder exists locally for every
history row. The legacy names ("init", "add_manual_improvements") don't,
which is why Step 3's rename approach is simpler than teaching Prisma to
bridge the naming gap.

An alternative path — generating folders named `init` and
`add_manual_improvements` locally to match — would also work, but you'd
end up with two migrations whose filenames don't match Prisma's expected
`NNNNNN_<snake_case>` format, and some tooling (including Prisma Studio
upgrades) prefers the timestamped form.

## After the baseline

On every future schema change: `pnpm prisma migrate dev --name <slug>`,
commit the generated folder, merge, deploy. The two legacy placeholders
stay in the folder indefinitely as the baseline anchor — don't delete
them, even though they're empty.
