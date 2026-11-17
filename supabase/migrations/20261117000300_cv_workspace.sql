begin;

create table public.cv_templates (
  id text primary key,
  tier text not null check (tier in ('free','premium')),
  supports_photo boolean not null
);
insert into public.cv_templates (id, tier, supports_photo)
values ('essential','free',false), ('compact','free',false), ('executive','free',false),
  ('atlas','premium',true), ('archive','premium',false), ('anchor','premium',true),
  ('boreal','premium',true), ('brio','premium',true), ('baker','premium',false),
  ('clarity','premium',true), ('coda','premium',false), ('canopy','premium',true),
  ('dune','premium',true), ('delta','premium',true), ('drift','premium',false),
  ('ember','premium',true), ('elm','premium',false), ('etch','premium',true),
  ('folio','premium',true), ('field','premium',false), ('fresco','premium',true),
  ('glen','premium',false), ('grain','premium',true), ('grove','premium',true),
  ('harbor','premium',true), ('halo','premium',true), ('horizon','premium',false),
  ('isle','premium',true), ('index','premium',false), ('inkstone','premium',true);

create table public.cv_template_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  check (expires_at is null or expires_at > granted_at)
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null check (
    jsonb_typeof(data) = 'object' and data @> '{"schema_version":1}'::jsonb
    and length(data::text) <= 170000
  ),
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);

-- Store one normalized, bounded JPEG per owner. Original uploads are never stored.
create table public.cv_profile_photos (
  user_id uuid primary key references auth.users(id) on delete cascade,
  jpeg_base64 text not null check (length(jpeg_base64) between 1 and 546136),
  updated_at timestamptz not null default now()
);

create table public.cvs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  template text not null references public.cv_templates(id),
  cv_language text not null check (cv_language in ('en','tr','de','fr','es','it','pt','nl')),
  paper text not null check (paper in ('A4','Letter')),
  photo_enabled boolean not null default false,
  profile_snapshot jsonb not null check (
    jsonb_typeof(profile_snapshot) = 'object' and profile_snapshot @> '{"schema_version":1}'::jsonb
    and length(profile_snapshot::text) <= 170000
  ),
  created_at timestamptz not null default now()
);
create index cvs_owner_recent on public.cvs (user_id, created_at desc, id);

alter table public.cv_templates enable row level security;
alter table public.cv_template_entitlements enable row level security;
alter table public.profiles enable row level security;
alter table public.cv_profile_photos enable row level security;
alter table public.cvs enable row level security;

revoke all on public.cv_templates, public.cv_template_entitlements, public.profiles, public.cv_profile_photos, public.cvs
  from public, anon, authenticated, service_role;
grant select on public.cv_template_entitlements, public.profiles, public.cv_profile_photos, public.cvs to authenticated;
grant insert, delete on public.cvs to authenticated;
grant select, insert, update, delete on public.cv_template_entitlements, public.cv_profile_photos to service_role;

create policy cv_entitlement_owner on public.cv_template_entitlements for select to authenticated
  using ((select auth.uid()) = user_id);
create policy cv_profile_owner on public.profiles for select to authenticated
  using ((select auth.uid()) = user_id);
create policy cv_photo_owner on public.cv_profile_photos for select to authenticated
  using ((select auth.uid()) = user_id);
create policy cvs_owner_read on public.cvs for select to authenticated
  using ((select auth.uid()) = user_id);
create policy cvs_owner_delete on public.cvs for delete to authenticated
  using ((select auth.uid()) = user_id);

create function public.can_use_cv_template(p_template text, p_photo boolean) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.cv_templates as template
    where template.id = p_template
      and (not p_photo or template.supports_photo)
      and (select auth.uid()) is not null
      and (
        template.tier = 'free' or exists (
          select 1 from public.cv_template_entitlements as entitlement
          where entitlement.user_id = (select auth.uid())
            and entitlement.granted_at <= statement_timestamp()
            and (entitlement.expires_at is null or entitlement.expires_at > statement_timestamp())
        )
      )
  );
$$;
revoke execute on function public.can_use_cv_template(text, boolean) from public, anon, service_role;
grant execute on function public.can_use_cv_template(text, boolean) to authenticated;

create policy cvs_owner_create on public.cvs for insert to authenticated
  with check ((select auth.uid()) = user_id and public.can_use_cv_template(template, photo_enabled));

create function public.save_cv_profile(p_revision integer, p_data jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  new_revision integer;
begin
  if owner_id is null then raise exception 'Permission denied' using errcode = '42501'; end if;
  if p_revision = 0 then
    insert into public.profiles(user_id, data) values (owner_id, p_data)
    on conflict (user_id) do nothing returning revision into new_revision;
  else
    update public.profiles set data = p_data, revision = revision + 1, updated_at = clock_timestamp()
    where user_id = owner_id and revision = p_revision returning revision into new_revision;
  end if;
  if new_revision is null then raise exception 'Stale revision' using errcode = '40001'; end if;
  return new_revision;
end;
$$;
revoke execute on function public.save_cv_profile(integer, jsonb) from public, anon, service_role;
grant execute on function public.save_cv_profile(integer, jsonb) to authenticated;

commit;
