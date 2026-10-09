<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Publishing Network

Internal Next.js 16 + Supabase dashboard that publishes to WordPress sites (English and Arabic). Start with `docs/HANDOFF.md` (current state and next tasks) and `docs/project-brief.md` (the client brief). Setup and operations are in `README.md` and `docs/`.

## Conventions

- Every business table has `website_id`. New features must be scoped per website; adding a website must never need a schema change.
- Permissions are enforced twice: in server code (`requireUser` / `requireAdmin` / `requireWebsite` in `src/lib/auth.js`) and in Supabase RLS. Use the user-scoped client (`src/lib/supabase/server.js`) by default; use the admin client (`src/lib/supabase/admin.js`) only after a permission check, for credentials, publication state, audit entries, invitations and background jobs.
- All dashboard writes go through server actions in `src/app/actions/`. Record significant actions with `recordAudit` (`src/lib/audit.js`).
- WordPress credentials are encrypted (`src/lib/crypto.js`) and never leave the server.
- Publishing must stay idempotent: claim lock → re-check controls → reconcile by `pn_article_id` → create → confirm. See `src/lib/publishing/publish.js`. Automation must reuse this, not reimplement it.
- Schema changes: add a new migration in `supabase/migrations/` named with the next sequential number (`11_jobs.sql`, `12_...`). Do not use `supabase migration new` (it creates timestamp names that sort after every numbered file). Never edit a migration that has been applied. Each table file enables RLS and sets its own grants. Keep queries and Zod validation in sync with the migrations.
- Next.js 16: `proxy.js` replaces middleware; `params`, `searchParams`, `cookies()` are async; `forbidden()` is experimental, use `notFound()`.
- No separate server, no n8n, no Python service: backend code lives in this Next.js app and runs on Vercel.
- Keep files small and focused; split a module when it does several unrelated jobs (see `src/lib/automation/drafting/`).
- Format with `npm run format` (Prettier), then check with `npm run lint`, `npm test` and `npm run build`.
