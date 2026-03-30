begin;

alter table public.customer_profiles add column if not exists notification_opt_in boolean not null default false;
alter table public.customer_profiles add column if not exists notification_channel text not null default 'email';
alter table public.customer_profiles add column if not exists detailer_chat_opt_in boolean not null default true;

create table if not exists public.progress_comments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  parent_type text null,
  parent_id text null,
  author_type text not null,
  author_name text null,
  author_email text null,
  message text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_progress_comments_booking_id on public.progress_comments (booking_id, created_at);

create table if not exists public.gift_certificate_redemptions (
  id uuid primary key default gen_random_uuid(),
  gift_certificate_id uuid not null references public.gift_certificates(id) on delete cascade,
  booking_id uuid null references public.bookings(id) on delete set null,
  amount_cents integer not null,
  notes text null,
  created_at timestamptz not null default now()
);
create index if not exists idx_gift_certificate_redemptions_gift_id on public.gift_certificate_redemptions (gift_certificate_id, created_at desc);
create index if not exists idx_gift_certificate_redemptions_booking_id on public.gift_certificate_redemptions (booking_id, created_at desc);

commit;
