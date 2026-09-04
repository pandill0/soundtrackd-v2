-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 9: drop v1's dashboard-made rating checks. They pre-date half stars
-- below 1 and were never ours to manage; ratings_rating_range /
-- track_ratings_rating_range (migration 1) enforce ½–5 in half steps.
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.ratings       drop constraint if exists ratings_rating_check;
alter table public.track_ratings drop constraint if exists track_ratings_rating_check;
