alter table public.profiles
  add column stripe_customer_id text,
  add column stripe_subscription_id text;

create unique index profiles_stripe_subscription_id_idx
  on public.profiles (stripe_subscription_id)
  where stripe_subscription_id is not null;
