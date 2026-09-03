# Soundtrackd v2 — setup & handoff

This is the rebuild specified in `REBUILD-SPEC.md` (the copy in the v1 repo root). Everything below
is what has to happen **outside the code** for it to run: secrets, the database migration, auth
provider settings, hosting, and the one-time data backfill. Work through it top to bottom.

## 0. What you're looking at

| Layer | Choice | Why |
|---|---|---|
| Framework | **SvelteKit** (Svelte 5) + TypeScript | Components + router + server-side loading; `.svelte` files look like the HTML/CSS/JS you already know (§2) |
| Hosting | **Netlify** (unchanged) | `netlify.toml` builds it; server code becomes one Netlify Function |
| Database/auth | **Supabase, the existing project** (`cmjemqmxnpusluzyiwyj`) | Keeps the 5 accounts and ~250 ratings; migrations reconcile against what's live |
| Catalogue | **MusicBrainz IDs as identity, Deezer as the beta search/artwork provider**, all behind `src/lib/server/catalog/` | §6.1 — no page ever sees a provider id; the Cloudflare worker is retired |
| Payments | **Lemon Squeezy** hosted checkout + webhook | Merchant of record handles international tax (§13.2) |

Local commands:

```bash
npm install          # once
npm run dev          # http://localhost:5173
npm run check        # type-check every .ts/.svelte file
npm run db:test      # applies all migrations to an in-process Postgres and runs 100 assertions
```

## 1. Environment variables

Copy `.env.example` to `.env` (already done for local dev). Fill in:

- **`SUPABASE_SECRET_KEY`** — Supabase dashboard → Project Settings → API Keys → *secret* (or the legacy
  `service_role` key). Server-only. **Without it the catalogue runs in an in-memory dev mode**: you can
  browse albums/artists/search, but nothing is saved and rating fails. This is the first thing to set.
- `JOBS_SECRET` — already generated in `.env`. Protects `/api/jobs/*`.
- `PUBLIC_SITE_URL` — `http://localhost:5173` locally, `https://soundtrackd.org` in production.
- Everything else is optional until the feature is switched on (§7–8 below).

In production these go in Netlify → Site configuration → Environment variables.

## 2. Apply the database migrations

The schema lives in `supabase/migrations/` — seven numbered files, applied in order. They are
**idempotent**: safe to run on the live project (where the v1 tables exist) and safe to run twice.
`npm run db:test` proves both on a scratch database before you touch the real one.

**Option A — SQL editor (no tools needed).** Supabase dashboard → SQL Editor → New query. Paste each
file's contents in numeric order and run it. Seven runs.

**Option B — CLI.**
```bash
npm i -g supabase
supabase login
supabase link --project-ref cmjemqmxnpusluzyiwyj
supabase db push
```

What the migration does to the live data: nothing destructive. It adds columns, tables, functions,
triggers, indexes, and **replaces the RLS policies with the canonical set** (v1's were only ever in the
dashboard). Two things worth knowing:

- Notifications are now written by database triggers, and users have no insert policy. v1's client
  code inserts them directly, so **on the old site those inserts will silently fail** after migration
  (the trigger creates the row anyway). Nothing breaks visibly.
- New profiles are created by a trigger on signup. v1 signups don't pass a username in metadata, so a
  brand-new v1 signup after the migration gets a `listener_xxxxxxxx` placeholder. Either cut over to
  v2 promptly or make this one-line change in v1's `login.html` (line 266):
  `sb.auth.signUp({ email, password, options: { data: { username } } })`.

## 3. Auth settings in Supabase

Dashboard → Authentication:

1. **URL Configuration** → Site URL `https://soundtrackd.org`. Redirect URLs — add all of:
   `http://localhost:5173/auth/callback`, `https://soundtrackd.org/auth/callback`,
   `https://*.netlify.app/auth/callback` (deploy previews).
2. **Providers → Google** (§5 — ship this first): create OAuth credentials in Google Cloud Console
   (Web application; authorised redirect URI is shown in the Supabase Google provider panel, it's
   `https://cmjemqmxnpusluzyiwyj.supabase.co/auth/v1/callback`). Paste client id + secret, enable.
   A Google signup arrives without a username and is sent to `/welcome` to choose one — that's by design.
3. **Email**: confirm the Resend SMTP settings still work (Authentication → SMTP). Send yourself a
   confirmation email from a test signup before announcing anything (§5 flagged this as historically flaky).
   The confirmation template should use `{{ .ConfirmationURL }}` (the default).
4. Someone who already has a password account and later signs in with Google using the same email is
   **linked to the existing account** (Supabase default for verified emails). That's the behaviour we want.

## 4. Run it locally

```bash
npm run dev
```
Sign in with an existing account. If `SUPABASE_SECRET_KEY` is set, search an album, rate it, and
check the album page updates. If the dashboard feed is empty, follow someone.

## 5. One-time data backfill (after the migration, with the secret key set)

v1 ratings are keyed by Deezer ids. This job creates catalogue rows for them, links every rating to
its row, fills `track_ratings.album_item_id` (§11 bug #4) and re-links list items and favourites that
were saved with Spotify ids (§11 bug #1). Run it until it reports `"more": false`:

```bash
curl -X POST http://localhost:5173/api/jobs/backfill-v1 -H "Authorization: Bearer $JOBS_SECRET"
```

Then warm the landing-page hero pool (curated list → catalogue) the same way with `warm-catalog`,
and start MusicBrainz matching with `mbid-backfill`. In production the scheduled Netlify function
(`netlify/functions/scheduled-jobs.mts`) runs `listenbrainz`, `warm-catalog` and `mbid-backfill`
every 10 minutes; it needs `JOBS_SECRET` in Netlify's env. Run `backfill-v1` by hand once against the
production URL after deploying.

## 6. Deploy

Simplest path: a **new Netlify site** from this repo (Add new site → Import → pick the v2 repo).
`netlify.toml` already sets the build command and publish directory. Add the env vars from §1.
It builds at `https://<name>.netlify.app`; verify sign-in and rating there. When happy, move the
`soundtrackd.org` domain from the v1 site to the new one (Domain management → add domain; Netlify
handles the SSL cert). DNS at Namecheap doesn't change.

Old links keep working: `album.html?id=…`, `profile.html?user=…` etc. redirect to the new URLs.

## 7. Supporter tier (§13.2B) — when you're ready to take money

1. Lemon Squeezy → create a product "Soundtrackd Supporter", $18/year subscription.
2. Copy its hosted checkout URL → `LEMONSQUEEZY_CHECKOUT_URL`.
3. Settings → Webhooks → add `https://soundtrackd.org/api/webhooks/lemonsqueezy`, choose a signing
   secret → `LEMONSQUEEZY_WEBHOOK_SECRET`, tick every `subscription_*` event.
4. `/support` switches from "Coming soon" to the checkout button automatically. Lapses are
   non-destructive: the badge and accent colour stop rendering, nothing else changes (tested in `db:test`).

## 8. Affiliate links (§13.2A)

Album pages already show a "Buy / listen elsewhere" row. When Amazon Associates approves you, set
`AFFILIATE_AMAZON_TAG`; links gain `rel="sponsored"` and the tag in one place. Same for
`AFFILIATE_TICKETMASTER_TAG` on artist pages. No code changes.

## 9. Not built (deliberately) — see REBUILD-SPEC §13 and §14

Apple sign-in, group conversations, avatar uploads (it's a URL field for now), a "Year in Sound"
recap, Last.fm listening import, the self-hosted MusicBrainz replica, advertising, tiers beyond the
single supporter tier. Open decisions I made for you, all reversible: SvelteKit over Next.js; keep
Netlify; retire the worker; faithful design system; provider-first MBID backfill; private queue with a
public toggle; no founding-cohort cap (the copy on `/supporters` hints at it); Lemon Squeezy.
