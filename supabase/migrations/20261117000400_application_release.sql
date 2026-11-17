begin;

insert into public.credit_packages (id,credits,base_price_cents)
values ('starter',15,499),('standard',40,999),('large',100,1999) on conflict (id) do nothing;

create table public.job_matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  profile jsonb not null,
  report jsonb not null,
  created_at timestamptz not null default now()
);
create index job_matches_owner on public.job_matches (user_id,created_at desc);
create table public.application_packs (
  job_id uuid primary key references public.job_matches on delete cascade,
  run_id uuid not null unique references public.generation_runs on delete cascade,
  output jsonb
);
create table public.application_attempts (
  user_id uuid not null references auth.users on delete cascade,
  request_id uuid not null,
  job_id uuid not null references public.job_matches on delete cascade,
  status text not null default 'running' check (status in ('running','succeeded','failed')),
  created_at timestamptz not null default now(),
  primary key (user_id,request_id)
);
create unique index one_running_application_attempt on public.application_attempts(job_id) where status='running';
create table public.llm_daily_budget (
  day date primary key,
  reserved integer not null check (reserved >= 0)
);

create table public.promo_grants (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  amount integer not null check (amount between 1 and 100),
  remaining integer not null check (remaining between 0 and amount),
  expires_at timestamptz not null default (now()+interval '30 days')
);
create index promo_inventory on public.promo_grants(user_id,expires_at) where remaining>0;
create table public.promo_movements (
  id uuid primary key,
  grant_id uuid not null references public.promo_grants on delete cascade,
  actor_id uuid references auth.users on delete set null,
  delta integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);
create table public.promo_spends (
  run_id uuid primary key references public.generation_runs on delete cascade,
  grant_id uuid not null references public.promo_grants on delete cascade
);

create table public.checkout_intents (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  package_id text not null references public.credit_packages,
  transaction_id text unique,
  created_at timestamptz not null default now()
);
create table public.billing_refunds (
  adjustment_id text primary key,
  transaction_id text not null references public.purchases(transaction_id),
  created_at timestamptz not null default now()
);

create table public.policy_acceptance (
  user_id uuid not null references auth.users on delete cascade,
  version text not null,
  locale text not null check (locale in ('en','tr','de','fr','es','it','pt','nl')),
  terms_accepted_at timestamptz not null default now(),
  privacy_notice_at timestamptz not null default now(),
  primary key (user_id,version)
);
create table public.account_deletions (
  user_id uuid primary key references auth.users on delete cascade,
  due_at timestamptz not null default (now()+interval '14 days'),
  claimed_until timestamptz
);

create table public.blog_covers (
  post_id uuid primary key references public.blog_posts on delete cascade,
  jpeg_base64 text not null check(length(jpeg_base64) between 1 and 546136),
  alt text not null check(length(trim(alt)) between 1 and 180)
);

do $$
declare t text;
begin
  foreach t in array array['job_matches','application_packs','application_attempts','llm_daily_budget','promo_grants',
    'promo_movements','promo_spends','checkout_intents','billing_refunds','policy_acceptance','account_deletions','blog_covers']
  loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role',t);
  end loop;
end $$;

grant select on public.policy_acceptance,public.account_deletions,public.promo_grants to authenticated;
create policy own_policy_acceptance on public.policy_acceptance for select to authenticated using(user_id=(select auth.uid()));
create policy own_deletion on public.account_deletions for select to authenticated using(user_id=(select auth.uid()));
create policy own_promo on public.promo_grants for select to authenticated using(user_id=(select auth.uid()));

create function public.reserve_llm_budget(p_units integer,p_limit integer)
returns boolean language plpgsql set search_path='' as $$
declare total integer;
begin
  if p_units is null or p_limit is null or p_units<1 or p_limit<1 or p_units>p_limit then return false; end if;
  insert into public.llm_daily_budget(day,reserved) values ((statement_timestamp() at time zone 'UTC')::date,p_units)
  on conflict(day) do update set reserved=llm_daily_budget.reserved+excluded.reserved
    where llm_daily_budget.reserved<=p_limit-excluded.reserved returning reserved into total;
  return total is not null;
end $$;

create function public.start_application(p_user uuid,p_job uuid,p_request uuid,p_regenerate boolean)
returns jsonb language plpgsql set search_path='' as $$
declare
  account public.credit_accounts; pack public.application_packs; attempt public.application_attempts;
  promo public.promo_grants; run uuid;
begin
  perform 1 from public.job_matches where id=p_job and user_id=p_user for update;
  if not found then return jsonb_build_object('state','notFound'); end if;
  select * into attempt from public.application_attempts where user_id=p_user and request_id=p_request;
  select * into pack from public.application_packs where job_id=p_job;
  if attempt.request_id is not null then
    if attempt.job_id<>p_job then return jsonb_build_object('state','conflict'); end if;
    return jsonb_build_object('state',attempt.status,'run',pack.run_id,'output',pack.output);
  end if;
  if exists(select 1 from public.application_attempts where job_id=p_job and status='running') then
    return jsonb_build_object('state','running');
  end if;
  if p_regenerate and pack.output is null then return jsonb_build_object('state','conflict'); end if;
  if pack.output is not null then
    if not p_regenerate then return jsonb_build_object('state','succeeded','output',pack.output); end if;
    update public.generation_runs set regenerations=regenerations+1 where id=pack.run_id and regenerations<3;
    if not found then return jsonb_build_object('state','regenerationLimit'); end if;
    run := pack.run_id;
  else
    account := public.reset_free_credits(p_user);
    if account.free_credits=0 then
      select * into promo from public.promo_grants where user_id=p_user and remaining>0 and expires_at>statement_timestamp()
      order by expires_at,id limit 1 for update;
    end if;
    if promo.id is null then
      run := public.spend_credits(p_user,p_request);
    else
      insert into public.generation_runs(user_id,idempotency_key) values(p_user,p_request) returning id into run;
      update public.promo_grants set remaining=remaining-1 where id=promo.id;
      insert into public.promo_spends values(run,promo.id);
    end if;
    if run is null then return jsonb_build_object('state','noCredits'); end if;
    insert into public.application_packs(job_id,run_id) values(p_job,run)
      on conflict(job_id) do update set run_id=excluded.run_id;
    update public.generation_runs set status='running' where id=run;
  end if;
  insert into public.application_attempts(user_id,request_id,job_id) values(p_user,p_request,p_job);
  return jsonb_build_object('state','started','run',run);
end $$;

create function public.finish_application(p_user uuid,p_job uuid,p_request uuid,p_output jsonb)
returns void language plpgsql set search_path='' as $$
declare pack public.application_packs; promotional uuid;
begin
  perform 1 from public.job_matches where id=p_job and user_id=p_user for update;
  if not found then return; end if;
  perform 1 from public.application_attempts where user_id=p_user and request_id=p_request and job_id=p_job and status='running';
  if not found then return; end if;
  select * into strict pack from public.application_packs where job_id=p_job;
  if p_output is not null then
    update public.application_packs set output=p_output where job_id=p_job;
    update public.generation_runs set status='succeeded' where id=pack.run_id;
  elsif pack.output is null then
    select grant_id into promotional from public.promo_spends where run_id=pack.run_id;
    if promotional is not null then
      perform public.reset_free_credits(p_user);
      update public.promo_grants set remaining=remaining+1 where id=promotional and expires_at>statement_timestamp();
      update public.generation_runs set status='failed' where id=pack.run_id;
    else
      perform public.reverse_spend(p_user,pack.run_id);
    end if;
  end if;
  update public.application_attempts set status=case when p_output is null then 'failed' else 'succeeded' end
  where user_id=p_user and request_id=p_request;
end $$;

create function public.adjust_promo(p_request uuid,p_user uuid,p_grant uuid,p_amount integer,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); lot uuid; previous public.promo_movements; acting_role text:=public.current_admin_role();
begin
  if acting_role is null or acting_role not in ('owner','admin') then raise exception 'Permission denied' using errcode='42501'; end if;
  if p_request is null or p_amount is null or p_amount=0 or p_amount not between -100 and 100 or
    p_reason is null or length(trim(p_reason)) not between 5 and 250 then raise exception 'Invalid adjustment' using errcode='22023'; end if;
  perform public.reset_free_credits(p_user);
  select * into previous from public.promo_movements where id=p_request;
  if found then
    if previous.actor_id=actor and previous.delta=p_amount and previous.reason=trim(p_reason)
       and exists(select 1 from public.promo_grants where id=previous.grant_id and user_id=p_user)
       and (p_grant is null or p_grant=previous.grant_id) then return previous.grant_id; end if;
    raise exception 'Conflicting adjustment' using errcode='22023';
  end if;
  if p_amount>0 and p_grant is null then
    insert into public.promo_grants(id,user_id,amount,remaining) values(p_request,p_user,p_amount,p_amount) returning id into lot;
  elsif p_amount<0 and p_grant is not null then
    update public.promo_grants set remaining=remaining+p_amount
    where id=p_grant and user_id=p_user and remaining>=-p_amount and expires_at>statement_timestamp() returning id into lot;
  end if;
  if lot is null then raise exception 'Insufficient promotional credit' using errcode='22023'; end if;
  insert into public.promo_movements(id,grant_id,actor_id,delta,reason) values(p_request,lot,actor,p_amount,trim(p_reason));
  insert into public.admin_audit(actor_id,action,target_id) values(actor,case when p_amount>0 then 'promo.grant' else 'promo.revoke' end,p_user);
  return lot;
end $$;

create function public.read_promo(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare acting_role text:=public.current_admin_role();
begin
  if acting_role is null or acting_role not in ('owner','admin') then raise exception 'Permission denied' using errcode='42501'; end if;
  return jsonb_build_object('grants',coalesce((select jsonb_agg(to_jsonb(g)) from
    (select id,amount,remaining,expires_at from public.promo_grants where user_id=p_user order by expires_at desc limit 50) g),'[]'::jsonb),
    'history',coalesce((select jsonb_agg(to_jsonb(m)) from
    (select m.grant_id,m.delta,m.reason,m.created_at from public.promo_movements m
     join public.promo_grants g on g.id=m.grant_id where g.user_id=p_user order by m.created_at desc limit 50) m),'[]'::jsonb));
end $$;

create function public.process_credit_event(p_event text,p_kind text,p_fields jsonb)
returns text language plpgsql set search_path='' as $$
declare purchase_tx text := p_fields->>'transaction'; intent public.checkout_intents;
  package public.credit_packages; purchase public.purchases; adjustment text:=p_fields->>'adjustment';
begin
  insert into public.paddle_events(event_id,event_type,payload)
  values(p_event,p_kind,jsonb_build_object('transaction',purchase_tx,'adjustment',adjustment))
  on conflict(event_id) do nothing;
  if not found then return 'duplicate'; end if;
  if p_kind='transaction.completed' then
    select * into intent from public.checkout_intents where id=(p_fields->>'intent')::uuid;
    if intent.id is not null then
      if intent.transaction_id is null then raise exception 'Checkout is not ready'; end if;
      select * into package from public.credit_packages where id=intent.package_id;
      if intent.transaction_id=purchase_tx and package.paddle_price_id=p_fields->>'price' then
        perform public.grant_purchase(intent.user_id,purchase_tx,package.paddle_price_id,p_fields->>'currency',(p_fields->>'amount')::integer);
      end if;
    end if;
  elsif p_kind in ('adjustment.created','adjustment.updated') and adjustment is not null then
    select * into purchase from public.purchases where transaction_id=purchase_tx;
    if purchase.id is null then
      if exists(select 1 from public.checkout_intents where transaction_id=purchase_tx) then raise exception 'Purchase not ready'; end if;
    elsif purchase.currency=p_fields->>'currency' then
      insert into public.billing_refunds(adjustment_id,transaction_id) values(adjustment,purchase_tx) on conflict do nothing;
      if found then
        if purchase.user_id is not null then
          perform public.apply_refund(purchase_tx,adjustment,(p_fields->>'amount')::integer);
        else
          update public.purchases set refunded_cents=least(amount_cents,refunded_cents::bigint+(p_fields->>'amount')::integer)
          where id=purchase.id;
        end if;
      end if;
    end if;
  end if;
  update public.paddle_events set processed_at=clock_timestamp() where event_id=p_event;
  return 'processed';
end $$;

create function public.claim_account_deletions() returns setof uuid language sql set search_path='' as $$
  update public.account_deletions a set claimed_until=statement_timestamp()+interval '15 minutes'
  from (select user_id from public.account_deletions where due_at<=statement_timestamp()
    and (claimed_until is null or claimed_until<statement_timestamp()) order by due_at limit 20 for update skip locked) d
  where a.user_id=d.user_id returning a.user_id
$$;

create function public.maintain_release_data() returns void language plpgsql set search_path='' as $$
declare item public.application_attempts;
begin
  for item in select * from public.application_attempts
  where status='running' and created_at<statement_timestamp()-interval '15 minutes' limit 25
  loop
    perform public.finish_application(item.user_id,item.job_id,item.request_id,null);
  end loop;
  update public.paddle_events set payload='{}'::jsonb where received_at<statement_timestamp()-interval '90 days' and payload<>'{}'::jsonb;
  delete from public.llm_daily_budget where day<(statement_timestamp() at time zone 'UTC')::date-90;
end $$;

create function public.write_blog_cover(p_post uuid,p_jpeg text,p_alt text)
returns void language plpgsql security definer set search_path='' as $$
declare acting_role text:=public.current_admin_role(); current_status text;
begin
  if acting_role is null or acting_role not in ('owner','admin','editor') then raise exception 'Permission denied' using errcode='42501'; end if;
  select status into current_status from public.blog_posts where id=p_post for update;
  if current_status is null or current_status not in ('draft','review') then raise exception 'Unpublish before editing' using errcode='22023'; end if;
  if p_jpeg is null then delete from public.blog_covers where post_id=p_post;
  else insert into public.blog_covers values(p_post,p_jpeg,p_alt)
    on conflict(post_id) do update set jpeg_base64=excluded.jpeg_base64,alt=excluded.alt;
  end if;
  insert into public.admin_audit(actor_id,action,target_id) values(auth.uid(),'blog.cover',p_post);
end $$;

revoke execute on function public.reserve_llm_budget(integer,integer),public.start_application(uuid,uuid,uuid,boolean),
  public.finish_application(uuid,uuid,uuid,jsonb),public.process_credit_event(text,text,jsonb),
  public.claim_account_deletions(),public.maintain_release_data() from public,anon,authenticated;
grant execute on function public.reserve_llm_budget(integer,integer),public.start_application(uuid,uuid,uuid,boolean),
  public.finish_application(uuid,uuid,uuid,jsonb),public.process_credit_event(text,text,jsonb),
  public.claim_account_deletions(),public.maintain_release_data() to service_role;
revoke execute on function public.adjust_promo(uuid,uuid,uuid,integer,text),public.read_promo(uuid),public.write_blog_cover(uuid,text,text)
  from public,anon,service_role;
grant execute on function public.adjust_promo(uuid,uuid,uuid,integer,text),public.read_promo(uuid),public.write_blog_cover(uuid,text,text)
  to authenticated;

commit;
