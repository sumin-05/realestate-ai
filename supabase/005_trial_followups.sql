alter table public.profiles
  add column if not exists followups_sent jsonb not null default '[]'::jsonb;
