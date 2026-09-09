# Import Job `created_by` Fix Report

## Cause

`import-job` already derived `created_by` from the authenticated bearer token.
However, its client recovery path (used when the Edge Function could not be
reached) inserted directly into `public.import_jobs` without `created_by`.
That path violated the column's `NOT NULL` constraint.

## Fix

- The Edge Function now explicitly rejects a missing `Authorization` header, a
  malformed/empty bearer token, an invalid token, and an authentication result
  without a user ID.
- It validates the bearer token with `admin.auth.getUser(token)` and inserts
  each new job with `status: 'pending'` and `created_by: user.id`.
- The browser recovery path now validates the current Supabase user first and
  includes `created_by: user.id` (and `status: 'pending'`) in its insert.
- A response returned by the Edge Function with an authentication or business
  error no longer falls through to the direct-insert recovery path.

## Schema verification

`supabase/migrations/20260908000006_audio_import_jobs.sql` defines:

```sql
created_by uuid not null references auth.users(id) on delete cascade
```

This enforces both a non-null creator and a foreign-key reference to
`auth.users.id`.

## Test verification

The repository build passes after the change. For an environment test after
deploying the Edge Function: log in as an admin, submit an Import Source URL,
then query the resulting `import_jobs` row. It must have `status = 'pending'`
and `created_by` equal to the logged-in user's UUID.
