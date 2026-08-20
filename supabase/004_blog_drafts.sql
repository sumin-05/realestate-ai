alter table public.profiles
  add column if not exists is_admin boolean not null default false;

create table if not exists public.blog_drafts (
  id bigint generated always as identity primary key,
  title text not null,
  content text not null,
  source_headlines jsonb,
  status text not null default 'draft' check (status in ('draft', 'posted', 'archived')),
  created_at timestamptz not null default now()
);

alter table public.blog_drafts enable row level security;
