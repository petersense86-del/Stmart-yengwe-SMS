-- 1. Pupils may not change their own A-Level pathway (subjects were already protected).
create or replace function private.profiles_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  protected_keys text[] := array['pupilId', 'teacherId', 'subjects', 'pathway', 'classes', 'departments',
    'employmentStatus', 'statusNote', 'statusDate', 'previousSchool', 'enrollmentYear', 'profilePicture'];
  me text := private.my_role();
begin
  new.updated_at := now();
  new.id := old.id;
  new.username := old.username;
  new.created_at := old.created_at;

  -- Service role (edge functions) and the headteacher may change anything.
  if auth.uid() is null or me = 'headteacher' then
    return new;
  end if;

  if me = 'deputy' then
    -- The deputy cannot alter the headteacher or promote anyone to head/deputy.
    if old.role = 'headteacher' then
      raise exception 'The deputy cannot modify the headteacher account';
    end if;
    if new.role in ('headteacher', 'deputy') and new.role <> old.role then
      raise exception 'Only the headteacher can assign admin roles';
    end if;
    return new;
  end if;

  new.role := old.role;

  if new.id = auth.uid() then
    new.grade := old.grade;
    new.class_section := old.class_section;
    new.hod_department := old.hod_department;
    -- A user may clear their own "must change password" flag, never set it.
    new.must_change_password := old.must_change_password and new.must_change_password;
    if private.is_it_hod() then
      protected_keys := array_remove(protected_keys, 'profilePicture');
    end if;
    new.data := (coalesce(new.data, '{}'::jsonb) - protected_keys) || private.jsonb_pick(old.data, protected_keys);
    return new;
  end if;

  if me = 'hod' and old.role in ('teacher', 'hod') then
    -- HoDs may only (re)assign subjects and classes.
    new.full_name := old.full_name;
    new.grade := old.grade;
    new.class_section := old.class_section;
    new.hod_department := old.hod_department;
    new.must_change_password := old.must_change_password;
    new.data := old.data || private.jsonb_pick(new.data, array['subjects', 'classes']);
    return new;
  end if;

  raise exception 'Not allowed to modify this profile';
end;
$$;

-- 2. Teachers can no longer rewrite other people's result records. A non-admin may
--    not move a result to another pupil/test/form, may publish but not unpublish,
--    and only the stream's class teacher (Forms & Grading) may set the comment.
create or replace function private.results_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  class_teacher text;
  comment_keys text[] := array['classTeacherComment', 'classTeacherId'];
begin
  if auth.uid() is null or private.is_admin() then
    return new;
  end if;

  select c.data #>> array['classTeachers', new.grade, coalesce(p.class_section, 'A')]
    into class_teacher
    from public.profiles p, public.app_config c
   where p.id = new.pupil_id and c.key = 'settings';

  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.pupil_id := old.pupil_id;
    new.term := old.term;
    new.year := old.year;
    new.grade := old.grade;
    new.created_at := old.created_at;
    new.published := old.published or new.published;
    if class_teacher is distinct from auth.uid()::text then
      new.data := (coalesce(new.data, '{}'::jsonb) - comment_keys) || private.jsonb_pick(old.data, comment_keys);
    end if;
  elsif class_teacher is distinct from auth.uid()::text then
    new.data := coalesce(new.data, '{}'::jsonb) - comment_keys;
  end if;
  return new;
end;
$$;

drop trigger if exists results_guard on public.results;
create trigger results_guard before insert or update on public.results
  for each row execute function private.results_guard();
grant execute on function private.results_guard() to authenticated;
