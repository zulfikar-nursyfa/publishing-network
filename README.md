# Publishing Network

Internal dashboard for running a network of WordPress news sites (English and Arabic) from one place: website management, editorial review and publishing, and AI-assisted drafting from approved sources.

| Part | Technology |
|---|---|
| Dashboard and backend | Next.js 16 (App Router, JavaScript) on Vercel |
| Database and login | Supabase (PostgreSQL, Auth, row level security) |
| Public websites | WordPress on SiteGround, published to through the REST API |
| Scheduling | Vercel Cron calling protected `/api/cron/*` routes |
| AI generation | Gemini API with resumable draft jobs, usage estimates and budget reservations |

## What exists today

- **Login and permissions:** invitation-only Supabase Auth with administrators and editors; editors only see their assigned websites. Enforced in server code *and* in row level security.
- **Websites:** WordPress connection and test, branding, publishing times (Cairo by default), automation mode, AI spending limit, niche, editors, categories synced with WordPress.
- **Niches and sources:** 15 niches, each with a source group shared by its English and Arabic sites; websites can disable niche sources and add their own.
- **Story inbox:** new stories from source feeds every 30 minutes; editors select the ones worth covering.
- **AI drafting:** selected stories run through web search, page collection (robots.txt and paywalls respected), research that prefers the official source, Gemini drafting, originality/language/source checks, AI verification and images, into the human review queue. Every AI draft needs approval.
- **Images:** featured image per article with source and rights; AI illustrations (always labelled) and, where permitted, the source's own image.
- **Articles and publishing:** manual articles, review workflow, scheduling, automatic publishing slots, and retry-safe publishing to WordPress (lock, existing-post check, read-back confirmation).
- **Spending controls:** per-site and network AI limits, worst-case reservation before every AI call, estimated cost per call, AI spend per site (by step and per drafted article) and per article.
- **Unpublish and preview:** live articles can be taken down (the WordPress post becomes a draft and is reused when the corrected article is published again); every article has a preview of exactly what WordPress will receive.

Still pending: full cost reports and forecast, Google Analytics / Search Console, CSV exports and WordPress themes.

## Repository layout

```
src/
  app/
    (dashboard)/          signed-in pages: overview, websites, articles, review, users, activity
    actions/              server actions (all writes go through here)
    auth/confirm/         invitation and password-reset link handler
    login/
    api/cron/             discover, queue, draft and publish cron routes
  lib/
    automation/           discovery, publishing slots and the AI draft pipeline (drafting/)
    ai/                   Gemini client and budgeted calls
    storage/              logo and article image files
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
tests/                    unit tests (npm test)
docs/                     handoff, setup, automation pipeline, WordPress/SiteGround checklist, operations
```

## Getting started

1. `npm install`
2. Create or pick a Supabase project for staging, then apply the schema: see [docs/setup.md](docs/setup.md).
3. `cp .env.example .env.local` and fill in the values (`npm run gen:key` creates the encryption key).
4. `npm run create-admin -- you@example.com "Your Name"` and accept the emailed invitation.
5. `npm run dev` and open http://localhost:3000.
6. Prepare a WordPress site with [docs/wordpress-setup.md](docs/wordpress-setup.md), then use **Add website**.

Database setup and updates (applying only the missing migrations) are described in [docs/setup.md](docs/setup.md). Before committing: `npm run format`, `npm run lint`, `npm test`, `npm run build`.
