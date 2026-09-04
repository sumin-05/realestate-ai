alter table public.blog_drafts
  add column if not exists category text not null default 'trend' check (category in ('trend', 'promo'));
