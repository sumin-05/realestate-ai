create table if not exists public.generations (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) not null,
  location text,
  price text,
  preset text,
  tone text,
  created_at timestamptz not null default now()
);

alter table public.generations enable row level security;

create policy "Users can insert own generations"
  on public.generations for insert
  with check (auth.uid() = user_id);

create policy "Users can view own generations"
  on public.generations for select
  using (auth.uid() = user_id);
