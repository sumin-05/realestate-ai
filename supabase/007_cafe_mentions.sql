create table if not exists public.cafe_mentions (
  id bigint generated always as identity primary key,
  article_link text unique not null,
  keyword text,
  title text,
  cafe_name text,
  created_at timestamptz not null default now()
);

alter table public.cafe_mentions enable row level security;
