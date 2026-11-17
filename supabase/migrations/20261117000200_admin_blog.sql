begin;

create table public.admin_memberships (
  user_id uuid primary key references auth.users on delete cascade,
  role text not null check (role in ('owner','admin','editor','support','analyst')),
  created_at timestamptz not null default now()
);
create unique index admin_single_owner on public.admin_memberships (role) where role = 'owner';

create table public.admin_audit (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users on delete set null,
  action text not null,
  target_id uuid,
  occurred_at timestamptz not null default clock_timestamp()
);
create index admin_audit_recent_idx on public.admin_audit (occurred_at desc);

create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  translation_group uuid not null default gen_random_uuid(),
  locale text not null check (locale in ('en','tr','de','fr','es','it','pt','nl')),
  slug text not null check (length(slug) between 1 and 100 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (length(trim(title)) between 1 and 120),
  excerpt text not null check (length(trim(excerpt)) between 1 and 300),
  body text not null check (length(trim(body)) between 1 and 30000),
  author text not null check (length(trim(author)) between 1 and 100),
  category text not null default '' check (length(category) <= 60),
  tags text[] not null default '{}' check (cardinality(tags) <= 8),
  seo_title text not null default '' check (length(seo_title) <= 120),
  seo_description text not null default '' check (length(seo_description) <= 300),
  status text not null default 'draft' check (status in ('draft','review','scheduled','published','archived')),
  scheduled_at timestamptz,
  published_at timestamptz,
  updated_at timestamptz not null default clock_timestamp(),
  revision integer not null default 1 check (revision > 0),
  unique (locale, slug),
  unique (translation_group, locale),
  check (status <> 'published' or published_at is not null),
  check ((status = 'scheduled') = (scheduled_at is not null))
);
create index blog_public_idx on public.blog_posts (locale, published_at desc) where status = 'published';
create index blog_schedule_idx on public.blog_posts (scheduled_at) where status = 'scheduled';
create index blog_admin_idx on public.blog_posts (updated_at desc, id);

create table public.blog_revisions (
  post_id uuid not null references public.blog_posts on delete cascade,
  revision integer not null,
  snapshot jsonb not null,
  actor_id uuid references auth.users on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (post_id, revision)
);

alter table public.admin_memberships enable row level security;
alter table public.admin_audit enable row level security;
alter table public.blog_posts enable row level security;
alter table public.blog_revisions enable row level security;
revoke all on public.admin_memberships, public.admin_audit, public.blog_posts, public.blog_revisions from public, anon, authenticated;
grant select on public.admin_memberships, public.admin_audit, public.blog_posts, public.blog_revisions to authenticated;
grant select on public.blog_posts to anon;
grant select, insert on public.admin_memberships to service_role;
grant select on public.blog_posts to service_role;

create policy admin_self on public.admin_memberships for select to authenticated using ((select auth.uid()) = user_id);

create function public.current_admin_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from public.admin_memberships
  where user_id = (select auth.uid()) and (select auth.jwt()->>'aal') = 'aal2'
$$;
revoke execute on function public.current_admin_role() from public, anon;
grant execute on function public.current_admin_role() to authenticated;

create policy admin_audit_read on public.admin_audit for select to authenticated
  using ((select public.current_admin_role()) in ('owner','admin'));
create policy blog_public_read on public.blog_posts for select to anon, authenticated
  using (status = 'published' and published_at <= statement_timestamp());
create policy blog_editor_read on public.blog_posts for select to authenticated
  using ((select public.current_admin_role()) in ('owner','admin','editor'));
create policy blog_history_read on public.blog_revisions for select to authenticated
  using ((select public.current_admin_role()) in ('owner','admin','editor'));

create function public.assign_admin_role(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.current_admin_role() is distinct from 'owner' or p_user = auth.uid() or
     (p_role is not null and p_role not in ('admin','editor','support','analyst')) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;
  if p_role is null then
    delete from public.admin_memberships where user_id = p_user and role <> 'owner';
  else
    insert into public.admin_memberships (user_id, role) values (p_user, p_role)
    on conflict (user_id) do update set role = excluded.role where admin_memberships.role <> 'owner';
  end if;
  if found then
    insert into public.admin_audit (actor_id, action, target_id)
    values (auth.uid(), case when p_role is null then 'role.remove' else 'role.' || p_role end, p_user);
  end if;
end;
$$;

-- Save editable content or apply one explicit workflow transition. Lock the
-- row and require the caller's revision so a stale browser cannot overwrite it.
create function public.change_blog_post(
  p_id uuid, p_revision integer, p_action text, p_content jsonb default null,
  p_schedule timestamptz default null, p_restore integer default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  member_role text := public.current_admin_role();
  post public.blog_posts;
  next_status text;
begin
  if member_role is null or member_role not in ('owner','admin','editor') then
    raise exception 'Permission denied' using errcode = '42501';
  end if;
  if p_action is null or p_action not in ('save','review','publish','schedule','unpublish','archive','restore') then
    raise exception 'Invalid operation' using errcode = '22023';
  end if;
  if p_action in ('publish','schedule','unpublish','archive','restore') and member_role = 'editor' then
    raise exception 'Permission denied' using errcode = '42501';
  end if;

  if p_id is not null then
    select * into strict post from public.blog_posts where id = p_id for update;
    if post.revision is distinct from p_revision then
      raise exception 'Stale revision' using errcode = '40001';
    end if;
  elsif p_action <> 'save' then
    raise exception 'Invalid operation' using errcode = '22023';
  end if;

  if p_action = 'restore' then
    if post.status not in ('draft','review','archived') then
      raise exception 'Unpublish before restoring' using errcode = '22023';
    end if;
    select snapshot into strict p_content from public.blog_revisions
    where post_id = p_id and revision = p_restore;
  end if;

  if p_action in ('save','restore') then
    if p_action = 'save' and p_id is not null and post.status not in ('draft','review') then
      raise exception 'Unpublish before editing' using errcode = '22023';
    end if;
    if jsonb_typeof(p_content) is distinct from 'object' or
       length(p_content::text) > 220000 or jsonb_typeof(p_content->'tags') is distinct from 'array' or
       exists (select 1 from jsonb_array_elements(p_content->'tags') tag
               where jsonb_typeof(tag) <> 'string' or length(tag #>> '{}') not between 1 and 32) then
      raise exception 'Invalid article' using errcode = '22023';
    end if;
    if p_id is null then
      insert into public.blog_posts
        (translation_group, locale, slug, title, excerpt, body, author, category, tags, seo_title, seo_description)
      values
        (coalesce((p_content->>'translation_group')::uuid, gen_random_uuid()), p_content->>'locale',
         p_content->>'slug', p_content->>'title', p_content->>'excerpt', p_content->>'body', p_content->>'author',
         p_content->>'category', array(select jsonb_array_elements_text(p_content->'tags')),
         p_content->>'seo_title', p_content->>'seo_description')
      returning * into post;
    else
      update public.blog_posts
      set translation_group = coalesce((p_content->>'translation_group')::uuid, translation_group),
          locale = p_content->>'locale', slug = p_content->>'slug', title = p_content->>'title',
          excerpt = p_content->>'excerpt', body = p_content->>'body', author = p_content->>'author',
          category = p_content->>'category', tags = array(select jsonb_array_elements_text(p_content->'tags')),
          seo_title = p_content->>'seo_title', seo_description = p_content->>'seo_description',
          status = 'draft', scheduled_at = null, updated_at = clock_timestamp(), revision = revision + 1
      where id = p_id returning * into post;
    end if;
  else
    next_status := case
      when p_action = 'review' and post.status = 'draft' then 'review'
      when p_action = 'publish' and post.status in ('review','scheduled') then 'published'
      when p_action = 'schedule' and post.status in ('review','scheduled') and p_schedule > clock_timestamp() then 'scheduled'
      when p_action = 'unpublish' and post.status in ('published','scheduled') then 'draft'
      when p_action = 'archive' and post.status in ('draft','review') then 'archived'
      end;
    if next_status is null then raise exception 'Invalid transition' using errcode = '22023'; end if;
    update public.blog_posts
    set status = next_status, scheduled_at = case when next_status = 'scheduled' then p_schedule end,
        published_at = case when next_status = 'published' then coalesce(published_at, clock_timestamp()) else published_at end,
        updated_at = clock_timestamp(), revision = revision + 1
    where id = p_id returning * into post;
  end if;

  insert into public.blog_revisions (post_id, revision, snapshot, actor_id)
  values (post.id, post.revision, to_jsonb(post), actor);
  insert into public.admin_audit (actor_id, action, target_id)
  values (actor, 'blog.' || p_action, post.id);
  return post.id;
end;
$$;

create function public.publish_due_blog_posts() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  post public.blog_posts;
  published_count integer := 0;
begin
  for post in
    with due as (
      select id from public.blog_posts where status = 'scheduled' and scheduled_at <= statement_timestamp()
      order by scheduled_at, id limit 50 for update skip locked
    )
    update public.blog_posts p
    set status = 'published', scheduled_at = null, published_at = coalesce(p.published_at, statement_timestamp()),
        revision = p.revision + 1, updated_at = clock_timestamp()
    from due where p.id = due.id returning p.*
  loop
    insert into public.blog_revisions (post_id, revision, snapshot) values (post.id, post.revision, to_jsonb(post));
    insert into public.admin_audit (action, target_id) values ('blog.scheduled_publish', post.id);
    published_count := published_count + 1;
  end loop;
  return published_count;
end;
$$;

create function public.admin_overview(p_days integer) returns jsonb
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
    'newUsers', (select count(*) from auth.users where created_at >= cutoff),
    'activeUsers', (select count(distinct user_id) from public.generation_runs where created_at >= cutoff),
    'completedPacks', (select count(*) from public.generation_runs where status = 'succeeded' and created_at >= cutoff),
    'creditsSpent', (select coalesce(sum(-delta),0) from public.credit_ledger where reason = 'spend' and created_at >= cutoff),
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

create function public.admin_lookup_account(p_email text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  member_role text := public.current_admin_role();
  account jsonb;
  target uuid;
begin
  if member_role is null or member_role not in ('owner','admin','support') then
    raise exception 'Permission denied' using errcode = '42501';
  end if;
  if p_email is null or length(p_email) > 254 then raise exception 'Invalid lookup' using errcode = '22023'; end if;
  select u.id, jsonb_build_object('id', u.id, 'createdAt', u.created_at,
    'free', c.free_credits, 'paid', c.paid_credits,
    'purchases', (select count(*) from public.purchases where user_id = u.id))
  into target, account
  from auth.users u left join public.credit_accounts c on c.user_id = u.id
  where lower(u.email) = lower(p_email)
  order by u.created_at, u.id limit 1;
  insert into public.admin_audit (actor_id, action, target_id) values (auth.uid(), 'account.lookup', target);
  return account;
end;
$$;

revoke execute on function public.assign_admin_role(uuid,text), public.change_blog_post(uuid,integer,text,jsonb,timestamptz,integer),
  public.publish_due_blog_posts(), public.admin_overview(integer), public.admin_lookup_account(text) from public, anon, authenticated, service_role;
grant execute on function public.assign_admin_role(uuid,text), public.change_blog_post(uuid,integer,text,jsonb,timestamptz,integer),
  public.admin_overview(integer), public.admin_lookup_account(text) to authenticated;
grant execute on function public.publish_due_blog_posts() to service_role;
commit;
