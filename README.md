# Publishing Network

Internal dashboard for running a network of WordPress news sites (English and Arabic) from one place: website management, editorial review and publishing, with AI-assisted automation to follow.

| Part | Technology |
|---|---|
| Dashboard and backend | Next.js 16 (App Router, JavaScript) on Vercel |
| Database and login | Supabase (PostgreSQL, Auth, row level security) |
| Public websites | WordPress on SiteGround, published to through the REST API |
| Scheduling | Vercel Cron calling protected `/api/cron/*` routes |
| AI generation | Gemini API with resumable draft jobs, usage estimates and budget reservations |

## What exists today

- **Login** with Supabase Auth: administrators and editors, invitation-only, password reset.
- **Website permissions**: administrators see all websites; editors only see the websites assigned to them. Enforced in server code *and* in database row level security.
- **Add website**: name, domain, language (Arabic is right-to-left), topic, audience, branding, WordPress connection, timezone, publishing time pickers (up to 12 daily slots), AI spending limit, illustrations toggle, editors and approved sources. Automation starts paused. Branding includes a colour picker with hex input and logo upload/preview/replacement/removal.
- **Test connection**: checks the credentials, the connector plugin, the user's publish permission and the site language/RTL setting.
- **Manual articles**: write, edit, submit for review, approve, reject with a note, return to draft.
- **Publishing to WordPress** that is safe to retry: a database lock stops two attempts running at once, WordPress is checked for an existing post before creating one, and the post is read back to confirm it is live.
- **Overview, review queue, per-website article lists, activity log.**

Feed discovery, a story inbox, Cairo publishing slots and explicit article scheduling are built. Automatic slots use leases, select only automated articles and reload controls before WordPress writes. Expired workers reconcile the same article rather than selecting another one.

Selected stories can now run through permitted evidence collection, primary-source research, Gemini drafting, originality/language/source checks and AI verification into the human review queue. Jobs persist one step per worker invocation, support bounded retries and administrator retry/cancel, and never overwrite existing articles. All AI drafts require human approval during the initial rollout, including sites configured in automatic mode.

AI usage is estimated using configurable model prices. Calls reserve budget atomically before generation; lost responses retain a reservation until an administrator checks provider billing. Network settings, draft-job inspection and research permissions are available in the dashboard.

These changes are local and require migrations **19–23**, Gemini configuration and staging validation before use. See [docs/automation-pipeline.md](docs/automation-pipeline.md) and [docs/website-branding.md](docs/website-branding.md). Do not enable automation or deploy the new cron configuration before applying the corresponding schema to that environment.

Still pending: Google Analytics / Search Console, CSV exports, WordPress themes, category/WordPress sync, image delivery, article preview and dashboard unpublish.

## Repository layout

```
src/
  app/
    (dashboard)/          signed-in pages: overview, websites, articles, review, users, activity
    actions/              server actions (all writes go through here)
    auth/confirm/         invitation and password-reset link handler
    login/
  lib/
    publishing/           publish flow (publish.js) and its Supabase store
    wordpress/            REST client and connection testing
    supabase/             user-scoped client (RLS) and secret-key admin client
    auth.js, audit.js, crypto.js, env.js, validation.js
  proxy.js                session refresh and sign-in redirect (Next.js 16 "proxy", formerly middleware)
supabase/
  migrations/             database schema, access policies, publication lock
  templates/              invitation and recovery email templates
wordpress/
  mu-plugins/             connector plugin to install on every WordPress site
docs/                     setup, WordPress/SiteGround checklist, operations
```

## Getting started

1. `npm install`
2. Create or pick a Supabase project for staging, then apply the schema: see [docs/setup.md](docs/setup.md).
3. `cp .env.example .env.local` and fill in the values (`npm run gen:key` creates the encryption key).
4. `npm run create-admin -- you@example.com "Your Name"` and accept the emailed invitation.
5. `npm run dev` and open http://localhost:3000.
6. Prepare a WordPress site with [docs/wordpress-setup.md](docs/wordpress-setup.md), then use **Add website**.

For first-time database setup in Supabase's SQL Editor, run `npm run db:schema` (or `node build_schema.js`) and paste the generated `supabase/_full_schema.sql` in one go. See [docs/setup.md](docs/setup.md) for the transaction and migration-history details.

For an existing database with migrations **00–18 already applied**, generate only the pending update:

```bash
npm run db:schema -- --from 19
```

Run the entire generated `supabase/_update_from_19.sql` in that project's SQL Editor once. It contains only migrations 19–23. If any of these have already been applied, choose the actual first unapplied migration instead. An `app_role already exists` error means the full setup is being replayed against an existing schema; use the update bundle rather than deleting existing types or tables. If 00–22 are already applied, use `npm run db:schema -- --from 23` for the logo bucket alone.
