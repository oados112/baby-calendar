-- =============================================================================
-- 0002_rpc — פעולות שהלקוח לא יכול לבצע כהוספה ישירה
--
-- כל פונקציה כאן היא security definer ובודקת הרשאות בעצמה.
-- הסיבה: יצירת משפחה, הזמנה וקבלת הזמנה חוצות גבולות הרשאה מעצם טבען.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- הקמת משפחה ראשונה + תינוק + כללי תזכורת ברירת מחדל
-- -----------------------------------------------------------------------------

create or replace function create_family_with_baby(
  p_family_name  text,
  p_display_name text,
  p_baby_name    text,
  p_birth_date   date,
  p_birth_time   time default null,
  p_sex          text default 'unspecified',
  p_timezone     text default 'Asia/Jerusalem'
)
returns table (family_id uuid, baby_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user   uuid := auth.uid();
  v_family uuid;
  v_baby   uuid;
begin
  if v_user is null then
    raise exception 'נדרשת התחברות' using errcode = 'insufficient_privilege';
  end if;

  -- משתמש שכבר שייך למשפחה לא מקים אחת חדשה בטעות
  if exists (select 1 from family_members where user_id = v_user) then
    raise exception 'המשתמש כבר משויך למשפחה' using errcode = 'unique_violation';
  end if;

  insert into families (name, timezone)
  values (p_family_name, p_timezone)
  returning id into v_family;

  insert into family_members (family_id, user_id, display_name, role, can_see_medical)
  values (v_family, v_user, p_display_name, 'admin', true);

  insert into babies (family_id, name, birth_date, birth_time, sex)
  values (v_family, p_baby_name, p_birth_date, p_birth_time, coalesce(p_sex, 'unspecified'))
  returning id into v_baby;

  -- כללי תזכורת התחלתיים, כבויים חוץ מהבסיסיים
  insert into reminder_rules (family_id, baby_id, kind, config, is_enabled, quiet_from, quiet_to)
  values
    (v_family, v_baby, 'feed_gap',         '{"hours": 3}'::jsonb,        true,  '23:00', '06:00'),
    (v_family, v_baby, 'diaper_gap',       '{"hours": 4}'::jsonb,        false, '23:00', '06:00'),
    (v_family, v_baby, 'timer_running',    '{"minutes": 150}'::jsonb,    true,  null,    null),
    (v_family, v_baby, 'partner_activity', '{}'::jsonb,                  true,  '23:00', '06:00'),
    (v_family, v_baby, 'daily_summary',    '{"at": "21:00"}'::jsonb,     false, null,    null);

  return query select v_family, v_baby;
end;
$$;

-- -----------------------------------------------------------------------------
-- הזמנת אדם נוסף
--
-- הטוקן הגולמי מוחזר פעם אחת בלבד ואינו נשמר — בבסיס הנתונים יש רק hash.
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
set search_path = public
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

  -- ביטול הזמנות קודמות פתוחות לאותה כתובת
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

-- -----------------------------------------------------------------------------
-- קבלת הזמנה
-- -----------------------------------------------------------------------------

create or replace function accept_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
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

  -- ההזמנה אישית: רק בעל כתובת המייל שהוזמנה יכול לממש אותה
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

-- -----------------------------------------------------------------------------
-- מחיקה רכה של אירוע
-- -----------------------------------------------------------------------------

create or replace function soft_delete_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ev events%rowtype;
begin
  select * into v_ev from events where id = p_event_id and deleted_at is null;
  if v_ev.id is null then
    raise exception 'האירוע לא נמצא';
  end if;

  if not (
    has_role(v_ev.family_id, array['admin']::member_role[])
    or (v_ev.created_by = auth.uid() and v_ev.created_at > now() - interval '24 hours')
  ) then
    raise exception 'אין הרשאה למחוק את הרישום הזה' using errcode = 'insufficient_privilege';
  end if;

  update events
     set deleted_at = now(), updated_by = auth.uid()
   where id = p_event_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- "מתי בפעם האחרונה" — שאילתה אחת שמזינה את כל מסך הבית
-- -----------------------------------------------------------------------------

create or replace function last_events_summary(p_baby_id uuid)
returns table (
  type        event_type,
  started_at  timestamptz,
  ended_at    timestamptz,
  data        jsonb,
  created_by  uuid
)
language sql
stable
security invoker  -- כפוף ל-RLS: צופה בלי הרשאה רפואית לא יראה שורות רפואיות
set search_path = public
as $$
  select distinct on (e.type)
         e.type, e.started_at, e.ended_at, e.data, e.created_by
  from events e
  where e.baby_id = p_baby_id
    and e.deleted_at is null
  order by e.type, e.started_at desc;
$$;
