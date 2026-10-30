-- Build 493. Evidence references are append-only observations, never role
-- decisions, access grants, source-proof acceptance or integration approval.
begin;

create table if not exists public.ywi_platform_legacy_evidence_493 (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  evidence_reference text not null check (
    evidence_reference ~ '^[A-Za-z0-9][A-Za-z0-9._/-]{5,119}$'
  ),
  evidence_state text not null default 'UNVERIFIED_REFERENCE'
    check (evidence_state = 'UNVERIFIED_REFERENCE'),
  recorded_by uuid not null references auth.users(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  unique (profile_id, evidence_reference)
);

create index if not exists ywi_platform_legacy_evidence_493_profile_idx
  on public.ywi_platform_legacy_evidence_493 (profile_id, id desc);
alter table public.ywi_platform_legacy_evidence_493 enable row level security;
revoke all on public.ywi_platform_legacy_evidence_493 from public, anon, authenticated;
revoke all on sequence public.ywi_platform_legacy_evidence_493_id_seq
  from public, anon, authenticated;

-- The curated administrator sees ledger references through a narrow RPC.
-- There is deliberately no generic table SELECT, INSERT, UPDATE or DELETE.
create or replace function public.ywi_platform_legacy_evidence_list_493()
returns table(entry_id bigint, profile_id uuid, evidence_reference text,
  evidence_state text, recorded_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or
      not (select public.ywi_is_platform_administrator_489()) then
    raise exception 'PLATFORM_ADMIN_REQUIRED' using errcode='42501';
  end if;
  return query
    select e.id, e.profile_id, e.evidence_reference, e.evidence_state, e.recorded_at
    from public.ywi_platform_legacy_evidence_493 e
    join public.profiles p on p.id=e.profile_id
    where p.role='admin' and not exists (
      select 1 from public.ywi_platform_administrators_489 a
      where a.user_id=e.profile_id
    )
    order by e.id desc limit 200;
end $$;

-- Recording a ticket reference does NOT verify the source, reviewer, signer,
-- role authority, tenant scope or owner decision. Duplicate IDs are idempotent.
create or replace function public.ywi_platform_legacy_evidence_record_493(
  p_profile_id uuid, p_reference text)
returns bigint
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_reference text := btrim(coalesce(p_reference,''));
  v_id bigint;
begin
  if (select auth.uid()) is null or
      not (select public.ywi_is_platform_administrator_489()) then
    raise exception 'PLATFORM_ADMIN_REQUIRED' using errcode='42501';
  end if;
  if v_reference !~ '^[A-Za-z0-9][A-Za-z0-9._/-]{5,119}$' then
    raise exception 'EVIDENCE_REFERENCE_FORMAT' using errcode='22023';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id=p_profile_id and p.role='admin'
      and not exists (select 1 from public.ywi_platform_administrators_489 a
                      where a.user_id=p.id)
  ) then
    raise exception 'LEGACY_ADMIN_TARGET_REQUIRED' using errcode='42501';
  end if;
  insert into public.ywi_platform_legacy_evidence_493
    (profile_id,evidence_reference,recorded_by)
    values (p_profile_id,v_reference,(select auth.uid()))
    on conflict (profile_id,evidence_reference) do nothing
    returning id into v_id;
  if v_id is null then
    select e.id into v_id from public.ywi_platform_legacy_evidence_493 e
      where e.profile_id=p_profile_id and e.evidence_reference=v_reference;
  end if;
  return v_id;
end $$;

revoke all on function public.ywi_platform_legacy_evidence_list_493()
  from public, anon, authenticated;
revoke all on function public.ywi_platform_legacy_evidence_record_493(uuid,text)
  from public, anon, authenticated;
grant execute on function public.ywi_platform_legacy_evidence_list_493()
  to authenticated;
grant execute on function public.ywi_platform_legacy_evidence_record_493(uuid,text)
  to authenticated;

comment on table public.ywi_platform_legacy_evidence_493 is
  'Append-only curated administrator ticket references; all evidence remains unverified and no role decision is authorized.';
commit;
