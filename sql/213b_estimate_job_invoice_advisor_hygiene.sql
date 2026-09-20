begin;

-- Schema 213b — Build 324 advisor hygiene.
-- Add the missing leading index for the new work_order_assumption_baselines
-- source_assumption_id foreign key. No business data, authority, Finance,
-- payment-provider, or workflow behavior is changed.

create index if not exists work_order_assumption_baselines_source_assumption_idx
  on public.work_order_assumption_baselines(source_assumption_id)
  where source_assumption_id is not null;

commit;
