-- =============================================================================
-- 0009_family_management — ניהול חברי משפחה וקודי כניסה מתוך האתר
--
-- טבלת access_codes אינה נגישה ללקוח בכלל, ובכוונה: היא מכילה את ה-hash
-- של הקודים. לכן הצגת רשימת המוזמנים נעשית דרך פונקציה שמחזירה רק את
-- מה שבטוח להציג — שם, תפקיד, ומתי היה בשימוש אחרון. לעולם לא hash.
-- =============================================================================

create or replace function list_access_codes()
returns table (
  id uuid,
  label text,
  identity_email text,
  role member_role,
  can_see_medical boolean,
  created_at timestamptz,
  last_used_at timestamptz,
  use_count integer,
  is_revoked boolean,
  has_joined boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family uuid;
begin
  select m.family_id into v_family
  from family_members m
  where m.user_id = auth.uid() and m.role = 'admin' and not m.is_suspended;

  if v_family is null then
    raise exception 'רק מנהל יכול לראות את קודי הכניסה'
      using errcode = 'insufficient_privilege';
  end if;

  return query
  select ac.id,
         ac.label,
         ac.identity_email,
         ac.role,
         ac.can_see_medical,
         ac.created_at,
         ac.last_used_at,
         ac.use_count,
         ac.revoked_at is not null as is_revoked,
         exists (
           select 1
           from auth.users u
           join family_members fm on fm.user_id = u.id
           where lower(u.email) = ac.identity_email and fm.family_id = v_family
         ) as has_joined
  from access_codes ac
  where ac.family_id = v_family or ac.family_id is null
  order by ac.created_at;
end;
$$;

/**
 * ביטול קוד.
 *
 * מבטל את הגישה מיידית, אבל לא מוחק את מה שאותו אדם רשם — הרישומים
 * הם של המשפחה ולא שלו, ומחיקתם הייתה מוחקת היסטוריה אמיתית.
 */
create or replace function revoke_access_code(p_code_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family uuid;
  v_email  text;
begin
  select m.family_id into v_family
  from family_members m
  where m.user_id = auth.uid() and m.role = 'admin' and not m.is_suspended;

  if v_family is null then
    raise exception 'רק מנהל יכול לבטל קוד' using errcode = 'insufficient_privilege';
  end if;

  select ac.identity_email into v_email
  from access_codes ac
  where ac.id = p_code_id and (ac.family_id = v_family or ac.family_id is null);

  if v_email is null then
    raise exception 'הקוד לא נמצא';
  end if;

  -- מנהל לא יכול לבטל את הקוד של עצמו ולנעול את עצמו בחוץ
  if v_email = (select lower(email) from auth.users where id = auth.uid()) then
    raise exception 'אי אפשר לבטל את הקוד שלך עצמך';
  end if;

  update access_codes set revoked_at = now() where id = p_code_id;

  -- השעיית החברות, כך שגם סשן פתוח מפסיק לראות נתונים
  update family_members fm
     set is_suspended = true
    from auth.users u
   where fm.user_id = u.id
     and lower(u.email) = v_email
     and fm.family_id = v_family;
end;
$$;

grant execute on function list_access_codes() to authenticated;
grant execute on function revoke_access_code(uuid) to authenticated;
revoke all on function list_access_codes() from public, anon;
revoke all on function revoke_access_code(uuid) from public, anon;
