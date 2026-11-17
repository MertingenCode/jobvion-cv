begin;

create or replace function public.read_promo(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare acting_role text := public.current_admin_role();
begin
  if acting_role is null or acting_role not in ('owner','admin') then
    raise exception 'Permission denied' using errcode='42501';
  end if;
  if not exists(select 1 from auth.users where id=p_user) then
    raise exception 'Account not found' using errcode='22023';
  end if;
  return jsonb_build_object(
    'free',coalesce((select case when c.free_month=date_trunc('month',statement_timestamp() at time zone 'UTC')::date
      then c.free_credits else 3 end from public.credit_accounts c where c.user_id=p_user),3),
    'paid',coalesce((select c.paid_credits from public.credit_accounts c where c.user_id=p_user),0),
    'refunds',coalesce((select c.refund_count from public.credit_accounts c where c.user_id=p_user),0),
    'promo',coalesce((select sum(g.remaining) from public.promo_grants g where g.user_id=p_user and g.expires_at>statement_timestamp()),0),
    'grants',coalesce((select jsonb_agg(to_jsonb(g)) from
      (select id,amount,remaining,expires_at from public.promo_grants where user_id=p_user order by expires_at desc limit 50) g),'[]'::jsonb),
    'history',coalesce((select jsonb_agg(to_jsonb(m)) from
      (select m.id,m.grant_id,m.delta,m.reason,m.created_at from public.promo_movements m
       join public.promo_grants g on g.id=m.grant_id where g.user_id=p_user order by m.created_at desc,m.id limit 50) m),'[]'::jsonb),
    'ledger',coalesce((select jsonb_agg(to_jsonb(l)) from
      (select id,bucket,reason,delta,created_at from public.credit_ledger where user_id=p_user order by created_at desc,id limit 50) l),'[]'::jsonb)
  );
end $$;

create or replace function public.admin_overview(p_days integer) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  member_role text := public.current_admin_role();
  cutoff timestamptz;
begin
  if member_role is null or member_role not in ('owner','admin','analyst') then
    raise exception 'Permission denied' using errcode = '42501';
  end if;
  if p_days is null or p_days not in (7,30,90) then
    raise exception 'Invalid period' using errcode = '22023';
  end if;
  cutoff := statement_timestamp() - make_interval(days => p_days);
  return jsonb_build_object(
    'asOf', statement_timestamp(),
    'registeredUsers', (select count(*) from auth.users),
    'savedCvs', (select count(*) from public.cvs where created_at >= cutoff),
    'coverLetters', (select count(*) from public.application_packs p join public.generation_runs g on g.id=p.run_id
      where g.created_at >= cutoff and p.output->>'cover' is not null),
    'newUsers', (select count(*) from auth.users where created_at >= cutoff),
    'activeUsers', (select count(distinct user_id) from public.generation_runs where created_at >= cutoff),
    'completedPacks', (select count(*) from public.generation_runs where status = 'succeeded' and created_at >= cutoff),
    'creditsSpent', (select coalesce(sum(-delta),0) from public.credit_ledger where reason = 'spend' and created_at >= cutoff) +
      (select count(*) from public.promo_spends s join public.generation_runs g on g.id=s.run_id where g.created_at >= cutoff),
    'paidOrders', (select count(*) from public.purchases where created_at >= cutoff),
    'aiCalls', (select count(*) from public.llm_calls where created_at >= cutoff),
    'aiFailures', (select count(*) from public.llm_calls where not succeeded and created_at >= cutoff),
    'aiCost', (select sum(cost_usd) from public.llm_calls where created_at >= cutoff),
    'finance', coalesce((select jsonb_agg(to_jsonb(f) order by f.currency) from (
      select currency, sum(amount_cents) as gross, sum(refunded_cents) as refunded
      from public.purchases where created_at >= cutoff group by currency
    ) f), '[]'::jsonb)
  );
end;
$$;

commit;
