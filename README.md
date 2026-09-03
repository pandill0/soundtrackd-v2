# Soundtrackd

**Letterboxd, for music.** Rate albums and songs with half-stars, write reviews, follow people whose
taste you trust, keep a listen queue, message your friends a record. Live at [soundtrackd.org](https://soundtrackd.org).

This is v2 — a from-scratch rebuild of the vanilla-HTML v1. The full product spec is `REBUILD-SPEC.md`
(in the v1 repo); the operational handoff is [`SETUP.md`](SETUP.md).

## Stack

SvelteKit (Svelte 5) · TypeScript · Supabase (Postgres + Auth + Realtime) · Netlify.
Catalogue identity is MusicBrainz (CC0); Deezer provides search and artwork during the beta.

## Layout

```
src/
  app.css                     design tokens + global styles (§3 of the spec)
  hooks.server.ts             Supabase client per request, session, route protection, /welcome gate
  lib/
    config.ts                 the one place public config lives
    server/env.ts             the one place secrets live
    server/catalog/           THE catalogue module — Deezer/MusicBrainz/Last.fm behind one API
    server/affiliate.ts       partner link templates (§13.2A)
    entitlements.ts           isSupporter() — the one entitlement helper (§13.2C)
    stars.ts                  rating steps + labels ("★★★★ — great")
    components/               Nav, RateModal, Stars, AlbumCard, SortBar, Picker, …
  routes/                     one folder per page; +page.server.ts loads, +page.svelte renders
    api/                      JSON endpoints the pages call (rate, like, queue, messages, jobs…)
supabase/
  migrations/                 seven idempotent SQL files — the schema, RLS, triggers, aggregates
  test/run.mjs                npm run db:test — applies them to PGlite and asserts behaviour
netlify/functions/            scheduled job runner
```

## Working on it

```bash
npm install
cp .env.example .env         # then fill in SUPABASE_SECRET_KEY
npm run dev
npm run check                # types
npm run db:test              # database
```

Rules that keep this codebase healthy (all from hard-won v1 lessons in the spec):

- **Nothing outside `src/lib/server/catalog/` talks to a music provider** or reads a provider id.
- **Aggregates happen in Postgres** (views/RPCs in `supabase/migrations/…aggregates.sql`), never by
  fetching rows into the browser.
- **Sort/filter state lives in the URL** via the shared `SortBar` component.
- Style classes, never bare `nav`/`header`/`section` element selectors.
- Anything social is free forever. The supporter tier is cosmetic only.
