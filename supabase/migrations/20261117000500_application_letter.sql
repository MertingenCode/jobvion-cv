begin;
create function public.edit_application_letter(p_user uuid,p_job uuid,p_cover text)
returns boolean language plpgsql set search_path='' as $$
begin
  if p_cover is null or length(trim(p_cover)) not between 1 and 8000 then return false; end if;
  perform 1 from public.job_matches where id=p_job and user_id=p_user for update;
  if not found or exists(select 1 from public.application_attempts where job_id=p_job and status='running') then return false; end if;
  update public.application_packs set output=jsonb_set(output,'{cover}',to_jsonb(p_cover))
  where job_id=p_job and output is not null;
  return found;
end $$;
revoke execute on function public.edit_application_letter(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.edit_application_letter(uuid,uuid,text) to service_role;
commit;
