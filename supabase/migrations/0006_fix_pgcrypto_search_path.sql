-- =============================================================================
-- 0006_fix_pgcrypto_search_path
--
-- תיקון: ב-Supabase התוסף pgcrypto מותקן בסכמה `extensions`, לא ב-`public`.
-- הפונקציות שלנו הוגדרו עם `set search_path = public` — הגדרה נכונה מבחינת
-- אבטחה, אבל היא גם הסתירה את digest() ו-gen_random_bytes() ולכן כל
-- פעולה שמערבת hash נכשלה ב-"function digest(text, unknown) does not exist".
--
-- הפתרון: להוסיף את extensions ל-search_path של הפונקציות האלה בלבד.
-- לא מעבירים את התוסף ל-public — זה היה משנה הגדרות של הפרויקט כולו.
--
-- הערה נוספת: הוספת ה-SET ל-hash_code גם מונעת מ-Postgres "להטמיע" אותה
-- בתוך הפונקציה הקוראת, וזו הייתה הסיבה שהשגיאה צצה דווקא ב-upsert.
-- =============================================================================

create or replace function hash_code(p_code text)
returns text
language sql
stable
set search_path = public, extensions
as $$
  select encode(digest(normalize_code(p_code), 'sha256'), 'hex');
$$;

revoke all on function hash_code(text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- אותו תיקון לפונקציות ההזמנות מ-0002, שסובלות מאותה בעיה
-- -----------------------------------------------------------------------------

create or replace function create_invite(
  p_family_id    uuid,
  p_email        text,
  p_role         member_role,
  p_display_name text default null,
  p_can_see_medical boolean default false,
  p_valid_days   integer default 7
)
returns table (invite_id uuid, token text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email text := lower(trim(p_email));
  v_token text;
  v_id    uuid;
begin
  if not has_role(p_family_id, array['admin']::member_role[]) then
    raise exception 'רק מנהל יכול להזמין' using errcode = 'insufficient_privilege';
  end if;

  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'כתובת מייל לא תקינה';
  end if;

  if p_valid_days not between 1 and 30 then
    raise exception 'תוקף ההזמנה חייב להיות בין יום ל-30 ימים';
  end if;

  update invites
     set revoked_at = now()
   where family_id = p_family_id
     and email = v_email
     and accepted_at is null
     and revoked_at is null;

  v_token := encode(gen_random_bytes(32), 'hex');

  insert into invites (
    family_id, email, role, can_see_medical, display_name,
    token_hash, expires_at, created_by
  )
  values (
    p_family_id, v_email, p_role, p_can_see_medical, p_display_name,
    encode(digest(v_token, 'sha256'), 'hex'),
    now() + make_interval(days => p_valid_days),
    auth.uid()
  )
  returning id into v_id;

  return query select v_id, v_token;
end;
$$;

create or replace function accept_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user  uuid := auth.uid();
  v_email text;
  v_inv   invites%rowtype;
begin
  if v_user is null then
    raise exception 'נדרשת התחברות' using errcode = 'insufficient_privilege';
  end if;

  select lower(email) into v_email from auth.users where id = v_user;

  select * into v_inv
  from invites
  where token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and accepted_at is null
    and revoked_at is null
    and expires_at > now();

  if v_inv.id is null then
    raise exception 'ההזמנה אינה תקפה או שפג תוקפה';
  end if;

  if v_inv.email <> v_email then
    raise exception 'ההזמנה נשלחה לכתובת מייל אחרת' using errcode = 'insufficient_privilege';
  end if;

  insert into family_members (family_id, user_id, display_name, role, can_see_medical)
  values (
    v_inv.family_id, v_user,
    coalesce(v_inv.display_name, split_part(v_email, '@', 1)),
    v_inv.role, v_inv.can_see_medical
  )
  on conflict (family_id, user_id) do update
    set role = excluded.role,
        can_see_medical = excluded.can_see_medical,
        is_suspended = false;

  update invites set accepted_at = now() where id = v_inv.id;

  return v_inv.family_id;
end;
$$;
