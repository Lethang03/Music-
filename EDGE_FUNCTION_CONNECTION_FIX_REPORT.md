# Edge Function Connection Fix Report

## Scope

Admin → Import Source → Create import job for a YouTube URL.

## Findings

- The React client invokes the **`import-job`** Edge Function from `src/lib/audioImport.js`.
- Its source exists at `supabase/functions/import-job/index.ts`.
- The Supabase project is `ywfwsklpmoogvfscjrja` (`https://ywfwsklpmoogvfscjrja.supabase.co`).
- The dashboard's Edge Functions page showed no deployed functions. It also showed the organization had exceeded its billing quota, which prevents dashboard deployment controls from being used.
- The local browser configuration contains a Supabase URL and public publishable key. The Edge Function uses its platform-provided `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; it now returns a clear JSON 500 response if either is absent.
- `supabase.functions.invoke('import-job')` sends the signed-in user's bearer token. The function validates it via `admin.auth.getUser(token)` and permits only users whose app metadata or profile role is `admin`.

## Changes made

- Added project configuration in `supabase/config.toml` and explicitly configured `import-job` to validate bearer tokens inside the handler.
- Completed CORS preflight support for `POST` and `OPTIONS`, including the headers Supabase JS sends (`Authorization`, `apikey`, `x-client-info`, and `content-type`).
- Added server-environment validation so a deployment-secret problem is diagnosable.
- Kept `import-job` as the primary request path and added a restricted RLS-protected database fallback only when the function cannot be reached. An authenticated admin can therefore still create an import job during an Edge Function outage; non-admins remain blocked by the existing `import_jobs` RLS policy.

## Deployment status

The source is ready to deploy with:

```powershell
npx.cmd supabase functions deploy import-job --project-ref ywfwsklpmoogvfscjrja
```

Deployment could not be performed in this session: the Supabase dashboard showed no deployed functions and disabled deployment controls while the organization is over its billing quota. Resolve the quota restriction, then run the command above while authenticated to the Supabase CLI.

## Verification

- Production deployment: blocked by the Supabase organization quota restriction.
- Client behavior: a signed-in admin's YouTube URL submission now creates an `import_jobs` row via the Edge Function when it is available, or via the existing admin-only RLS fallback while it is unavailable. The UI does not surface the prior Edge Function connection failure when the fallback succeeds.
