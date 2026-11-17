-- Jobvion Phase 1 credit accounting. Each mutation locks one account before
-- changing its balance, purchase inventory, generation run, or ledger.
begin;

create table public.credit_accounts (
  user_id uuid primary key references auth.users on delete cascade,
  free_credits integer not null default 3 check (free_credits between 0 and 3),
  free_month date not null,
  paid_credits integer not null default 0 check (paid_credits >= 0),
  refund_count integer not null default 0 check (refund_count >= 0)
);

create table public.credit_packages (
  id text primary key,
  paddle_price_id text unique,
  credits integer not null check (credits > 0),
  base_price_cents integer not null check (base_price_cents > 0),
  base_currency text not null default 'USD' check (base_currency ~ '^[A-Z]{3}$')
);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete set null,
  transaction_id text not null unique,
  package_id text not null references public.credit_packages,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount_cents integer not null check (amount_cents > 0),
  refunded_cents integer not null default 0 check (refunded_cents between 0 and amount_cents),
  credits integer not null check (credits > 0),
  remaining_credits integer not null check (remaining_credits between 0 and credits),
  refunded_credits integer not null default 0 check (refunded_credits between 0 and credits),
  created_at timestamptz not null default now()
);
create index purchases_inventory_idx on public.purchases (user_id, created_at, id) where remaining_credits > 0;

create table public.paddle_events (
  event_id text primary key,
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table public.generation_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  idempotency_key uuid not null,
  status text not null default 'pending' check (status in ('pending', 'running', 'succeeded', 'failed')),
  regenerations smallint not null default 0 check (regenerations between 0 and 3),
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  bucket text not null check (bucket in ('free', 'paid')),
  reason text not null check (reason in ('spend', 'reversal', 'monthly_reset', 'purchase', 'refund')),
  delta integer not null,
  balance_after integer not null check (balance_after >= 0),
  purchase_id uuid references public.purchases,
  run_id uuid references public.generation_runs on delete cascade,
  free_month date,
  reference_id text,
  created_at timestamptz not null default now()
);
create index credit_ledger_user_idx on public.credit_ledger (user_id, created_at desc);
create unique index credit_ledger_spend_idx on public.credit_ledger (run_id) where reason = 'spend';
create unique index credit_ledger_reversal_idx on public.credit_ledger (run_id) where reason = 'reversal';
create unique index credit_ledger_refund_idx on public.credit_ledger (reference_id) where reason = 'refund';

create table public.llm_calls (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.generation_runs on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  step text not null,
  provider text not null,
  model text not null,
  input_tokens integer check (input_tokens >= 0),
  output_tokens integer check (output_tokens >= 0),
  cost_usd numeric(16, 9) check (cost_usd >= 0),
  duration_ms integer check (duration_ms >= 0),
  succeeded boolean not null,
  created_at timestamptz not null default now()
);
create index llm_calls_created_idx on public.llm_calls (created_at);

alter table public.credit_accounts enable row level security;
alter table public.credit_packages enable row level security;
alter table public.purchases enable row level security;
alter table public.paddle_events enable row level security;
alter table public.generation_runs enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.llm_calls enable row level security;

revoke all on public.credit_accounts, public.credit_packages, public.purchases, public.paddle_events,
  public.generation_runs, public.credit_ledger, public.llm_calls from public, anon, authenticated;
grant select on public.credit_accounts, public.purchases, public.generation_runs, public.credit_ledger to authenticated;
grant select, insert, update, delete on public.credit_accounts, public.credit_packages, public.purchases,
  public.paddle_events, public.generation_runs, public.credit_ledger, public.llm_calls to service_role;

create policy credit_accounts_owner on public.credit_accounts for select to authenticated using ((select auth.uid()) = user_id);
create policy purchases_owner on public.purchases for select to authenticated using ((select auth.uid()) = user_id);
create policy generation_runs_owner on public.generation_runs for select to authenticated using ((select auth.uid()) = user_id);
create policy credit_ledger_owner on public.credit_ledger for select to authenticated using ((select auth.uid()) = user_id);

create function public.reset_free_credits(p_user_id uuid)
returns public.credit_accounts
language plpgsql
set search_path = ''
as $$
declare
  month_start date := date_trunc('month', statement_timestamp() at time zone 'UTC')::date;
  account public.credit_accounts;
begin
  insert into public.credit_accounts (user_id, free_month) values (p_user_id, month_start)
    on conflict (user_id) do nothing;
  select * into strict account from public.credit_accounts where user_id = p_user_id for update;

  if account.free_month < month_start then
    if account.free_credits <> 3 then
      insert into public.credit_ledger (user_id, bucket, reason, delta, balance_after, free_month)
      values (p_user_id, 'free', 'monthly_reset', 3 - account.free_credits, 3, month_start);
    end if;
    update public.credit_accounts set free_credits = 3, free_month = month_start
    where user_id = p_user_id returning * into account;
  end if;
  return account;
end;
$$;

-- One call spends one credit or returns the previous run for this user's key.
-- NULL means that there is no balance to spend.
create function public.spend_credits(p_user_id uuid, p_idempotency_key uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  account public.credit_accounts;
  selected_purchase uuid;
  generation_id uuid;
begin
  account := public.reset_free_credits(p_user_id);

  select id into generation_id from public.generation_runs
  where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then return generation_id; end if;
  if account.free_credits + account.paid_credits = 0 then return null; end if;

  insert into public.generation_runs (user_id, idempotency_key)
  values (p_user_id, p_idempotency_key) returning id into generation_id;

  if account.free_credits > 0 then
    update public.credit_accounts set free_credits = free_credits - 1 where user_id = p_user_id;
    insert into public.credit_ledger (user_id, bucket, reason, delta, balance_after, run_id, free_month)
    values (p_user_id, 'free', 'spend', -1, account.free_credits - 1, generation_id, account.free_month);
  else
    select id into strict selected_purchase from public.purchases
    where user_id = p_user_id and remaining_credits > 0 order by created_at, id limit 1;
    update public.purchases set remaining_credits = remaining_credits - 1 where id = selected_purchase;
    update public.credit_accounts set paid_credits = paid_credits - 1 where user_id = p_user_id;
    insert into public.credit_ledger (user_id, bucket, reason, delta, balance_after, run_id, purchase_id)
    values (p_user_id, 'paid', 'spend', -1, account.paid_credits - 1, generation_id, selected_purchase);
  end if;
  return generation_id;
end;
$$;

create function public.reverse_spend(p_user_id uuid, p_run_id uuid)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  account public.credit_accounts;
  spent public.credit_ledger;
  run public.generation_runs;
  restored integer;
begin
  account := public.reset_free_credits(p_user_id);
  select * into strict run from public.generation_runs where user_id = p_user_id and id = p_run_id for update;
  select delta into restored from public.credit_ledger where run_id = p_run_id and reason = 'reversal';
  if found then return restored; end if;
  if run.status = 'succeeded' then
    raise exception 'Cannot reverse a successful run' using errcode = '22023';
  end if;

  select * into strict spent from public.credit_ledger where run_id = p_run_id and reason = 'spend';
  restored := 0;
  if spent.bucket = 'free' then
    if spent.free_month = account.free_month and account.free_credits < 3 then
      update public.credit_accounts set free_credits = free_credits + 1
      where user_id = p_user_id returning * into account;
      restored := 1;
    end if;
  else
    update public.purchases set remaining_credits = remaining_credits + 1
    where id = spent.purchase_id and refunded_credits = 0;
    if found then
      update public.credit_accounts set paid_credits = paid_credits + 1
      where user_id = p_user_id returning * into account;
      restored := 1;
    else
      -- If this pack contributed a refunded credit that was already spent,
      -- release the failed run only when the retained entitlement covers it.
      update public.purchases as purchase set remaining_credits = remaining_credits + 1
      where purchase.id = spent.purchase_id
      and purchase.credits - purchase.refunded_credits > purchase.remaining_credits + (
        select count(*) from public.credit_ledger as debit
        where debit.purchase_id = purchase.id and debit.reason = 'spend' and debit.run_id <> p_run_id
          and not exists (select 1 from public.credit_ledger as reversal
            where reversal.run_id = debit.run_id and reversal.reason = 'reversal')
      );
      if found then
        update public.credit_accounts set paid_credits = paid_credits + 1
        where user_id = p_user_id returning * into account;
        restored := 1;
      end if;
    end if;
  end if;

  insert into public.credit_ledger (user_id, bucket, reason, delta, balance_after, run_id, purchase_id, free_month)
  values (p_user_id, spent.bucket, 'reversal', restored,
    case when spent.bucket = 'free' then account.free_credits else account.paid_credits end,
    p_run_id, spent.purchase_id, spent.free_month);
  update public.generation_runs set status = 'failed' where id = p_run_id;
  return restored;
end;
$$;

create function public.grant_purchase(
  p_user_id uuid, p_transaction_id text, p_price_id text, p_currency text, p_amount_cents integer
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  package public.credit_packages;
  purchase public.purchases;
  balance integer;
begin
  perform public.reset_free_credits(p_user_id);
  select * into strict package from public.credit_packages where paddle_price_id = p_price_id;

  insert into public.purchases (user_id, transaction_id, package_id, currency, amount_cents, credits, remaining_credits)
  values (p_user_id, p_transaction_id, package.id, p_currency, p_amount_cents, package.credits, package.credits)
  on conflict (transaction_id) do nothing returning * into purchase;
  if not found then
    select * into strict purchase from public.purchases where transaction_id = p_transaction_id;
    if (purchase.user_id, purchase.package_id, purchase.currency, purchase.amount_cents)
      is distinct from (p_user_id, package.id, p_currency, p_amount_cents) then
      raise exception 'Inconsistent purchase replay' using errcode = '22023';
    end if;
    return purchase.id;
  end if;

  update public.credit_accounts set paid_credits = paid_credits + purchase.credits
  where user_id = p_user_id returning paid_credits into balance;
  insert into public.credit_ledger (user_id, bucket, reason, delta, balance_after, purchase_id)
  values (p_user_id, 'paid', 'purchase', purchase.credits, balance, purchase.id);
  return purchase.id;
end;
$$;

create function public.apply_refund(
  p_transaction_id text, p_adjustment_id text, p_refund_cents integer
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  purchase public.purchases;
  refunded_total integer;
  entitled_reduction integer;
  deducted integer;
  balance integer;
begin
  if p_adjustment_id is null or p_adjustment_id = '' or p_refund_cents is null or p_refund_cents <= 0 then
    raise exception 'Invalid refund' using errcode = '22023';
  end if;
  select * into strict purchase from public.purchases where transaction_id = p_transaction_id;
  if purchase.user_id is null then return 0; end if;
  perform public.reset_free_credits(purchase.user_id);
  select * into strict purchase from public.purchases where transaction_id = p_transaction_id for update;
  select -delta into deducted from public.credit_ledger
  where reference_id = p_adjustment_id and purchase_id = purchase.id and reason = 'refund';
  if found then return deducted; end if;

  refunded_total := least(purchase.refunded_cents::bigint + p_refund_cents, purchase.amount_cents)::integer;
  entitled_reduction := floor(purchase.credits::numeric * refunded_total / purchase.amount_cents)::integer;
  deducted := least(purchase.remaining_credits, entitled_reduction - purchase.refunded_credits);

  update public.purchases
  set remaining_credits = remaining_credits - deducted, refunded_cents = refunded_total,
      refunded_credits = entitled_reduction
  where id = purchase.id;
  update public.credit_accounts
  set paid_credits = paid_credits - deducted, refund_count = refund_count + 1
  where user_id = purchase.user_id returning paid_credits into balance;

  insert into public.credit_ledger (user_id, bucket, reason, delta, balance_after, purchase_id, reference_id)
  values (purchase.user_id, 'paid', 'refund', -deducted, balance, purchase.id, p_adjustment_id);
  return deducted;
end;
$$;

revoke execute on function public.reset_free_credits(uuid),
  public.spend_credits(uuid, uuid), public.reverse_spend(uuid, uuid),
  public.grant_purchase(uuid, text, text, text, integer), public.apply_refund(text, text, integer)
  from public, anon, authenticated;
grant execute on function public.reset_free_credits(uuid),
  public.spend_credits(uuid, uuid), public.reverse_spend(uuid, uuid),
  public.grant_purchase(uuid, text, text, text, integer), public.apply_refund(text, text, integer)
  to service_role;

commit;
