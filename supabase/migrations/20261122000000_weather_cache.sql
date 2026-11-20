-- KisanConnect · Phase 3 · weather cache
-- One Open-Meteo forecast per ~11 km grid cell (0.1°), shared by all farms in the
-- cell, refreshed at most once an hour by the weather-proxy Edge Function.
-- Only the service role (Edge Functions) reads or writes it: RLS on, no policies.

create table if not exists public.weather_cache (
  cell text primary key check (cell ~ '^-?[0-9]+\.[0-9]_-?[0-9]+\.[0-9]$'),
  lat numeric(4, 1) not null,
  lng numeric(4, 1) not null,
  forecast jsonb not null,
  fetched_at timestamptz not null default now()
);

alter table public.weather_cache enable row level security;
revoke all on public.weather_cache from anon, authenticated;
