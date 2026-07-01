# Architecture Notes

The MVP uses a lean clean-architecture split without adding a separate backend service.

- Domain: `packages/domain`
- Valuation engine: `packages/valuation-core`
- Persistence adapters and schema: `packages/db`
- Application/UI/API routes: `apps/web`

The current app runs with demo state in the browser and calls Next.js API routes for model runs and report snapshots. Supabase persistence should be wired by adding repository implementations in `packages/db` and calling them from server actions or route handlers.

The valuation package is pure TypeScript and has no React, Supabase, or Vercel dependency. This keeps the future migration path open if long-running model search later needs a Python worker.
