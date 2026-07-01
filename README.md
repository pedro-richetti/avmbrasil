# Brazilian Real Estate AVM MVP

Lean SaaS MVP for engineer-led real estate valuation studies under NBR 14653-2.

The implementation keeps the app deliberately simple:

- `apps/web`: Next.js app deployed on Vercel.
- `packages/domain`: pure domain entities and types.
- `packages/valuation-core`: deterministic OLS, diagnostics, candidate search, and draft rule evaluation.
- `packages/db`: Supabase schema, RLS policies, and client helpers.

The current NBR rule pack is marked as draft. Exact NBR 14653-2 thresholds and report language must be confirmed from licensed ABNT material before compliance claims.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Quality Gates

```bash
npm run typecheck
npm test
npm run build
```

## Supabase

Create a Supabase project, run `packages/db/supabase/schema.sql`, then set the variables from `.env.example`.

The demo app can run without Supabase credentials; persisted SaaS workflows can be wired through the repository interfaces in `packages/db`.
