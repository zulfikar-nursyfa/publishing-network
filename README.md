# Publishing Network

Internal dashboard for running a network of WordPress news sites (English and Arabic) from one place: website management, editorial review and publishing, with AI-assisted automation to follow.

| Part | Technology |
|---|---|
| Dashboard and backend | Next.js 16 (App Router, JavaScript) on Vercel |
| Database and login | Supabase (PostgreSQL, Auth, row level security) |
| Public websites | WordPress on SiteGround, published to through the REST API |
| Scheduling (next phase) | Vercel Cron calling protected `/api/cron/*` routes |
| AI generation (next phase) | Gemini API with usage tracking |

## What exists today (Phase 1 and 2 foundation)

- **Login** with Supabase Auth: administrators and editors, invitation-only, password reset.
- **Website permissions**: administrators see all websites; editors only see the websites assigned to them. Enforced in server code *and* in database row level security.
- **Add website**: name, domain, language (Arabic is right-to-left), topic, audience, branding, WordPress connection, timezone, daily quota (0/1/2), AI spending limit, illustrations toggle, editors and approved sources. Automation starts paused.
- **Test connection**: checks the credentials, the connector plugin, the user's publish permission and the site language/RTL setting.
- **Manual articles**: write, edit, submit for review, approve, reject with a note, return to draft.
- **Publishing to WordPress** that is safe to retry: a database lock stops two attempts running at once, WordPress is checked for an existing post before creating one, and the post is read back to confirm it is live.
- **Overview, review queue, per-website article lists, activity log.**

Not built yet: automation (sources → AI draft → checks), cron jobs, AI usage tracking, Google Analytics / Search Console, CSV exports, WordPress themes. The schema already keys everything by website so these slot in without redesign.

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
