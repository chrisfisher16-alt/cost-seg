# Supabase bootstrap

One-time setup per environment (dev, preview, prod) for Supabase Auth +
Storage resources the app expects.

## Storage: `studies` bucket

1. In the Supabase dashboard, go to **Storage** → **Create bucket**.
2. Name: `studies`. **Public: off.**
3. Default file size limit: 25 MB (matches `MAX_UPLOAD_BYTES` in
   [`lib/storage/validate.ts`](../../lib/storage/validate.ts)).
4. Allowed MIME types: `application/pdf, image/jpeg, image/png`.

No bucket policies are required — we access Storage exclusively via the
service-role client from the server (see ADR 0002), so only the app touches
objects.

## Auth: redirect URLs

Under **Authentication** → **URL Configuration**, add these redirect URLs
(one per environment):

- `http://localhost:3000/auth/callback` (dev)
- `https://<preview-domain>/auth/callback` (Vercel preview)
- `https://<prod-domain>/auth/callback` (prod)

Also set **Site URL** to the prod origin.

## Auth: providers

- **Email**: enable magic links, disable signup-with-password (we never
  collect passwords).
- **Google**: configure OAuth client in Google Cloud Console, paste Client
  ID + Secret, ensure the authorized redirect URI in GCP matches
  `https://<project-ref>.supabase.co/auth/v1/callback`.

## Prisma migrations

Once the project exists and the env vars are filled in:

```bash
pnpm prisma migrate dev --name init
```

This creates every table declared in `prisma/schema.prisma`.
