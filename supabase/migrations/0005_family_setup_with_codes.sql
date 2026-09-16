-- =============================================================================
-- 0005_family_setup_with_codes
--
-- שני תיקונים על גבי 0002:
--   1. החתימה של create_family_with_baby השתנתה (נוסף משקל לידה).
--      Postgres יוצר עומס-יתר ולא מחליף, ולכן קודם מוחקים את הישנה —
--      אחרת PostgREST לא יידע לאיזו גרסה לפנות.
--   2. אחרי הקמת המשפחה, קודי הכניסה שעדיין אינם משויכים נקשרים אליה,
--      כדי שבן/בת הזוג פשוט ייכנסו עם הקוד שלהם בלי שום שלב נוסף.
-- =============================================================================

drop function if exists create_family_with_baby(text, text, text, date, time, text, text);
drop function if exists create_family_with_baby(text, text, text, date, time, text, integer, text);

create function create_family_with_baby(
  p_family_name  text,
  p_display_name text,
  p_baby_name    text,          -- מותר null כשעדיין אין שם
  p_birth_date   date,
  p_birth_time   time default null,
  p_sex          text default 'unspecified',
  p_birth_weight_g integer default null,
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
  v_name   text;
begin
  if v_user is null then
    raise exception 'נדרשת התחברות' using errcode = 'insufficient_privilege';
  end if;

  if exists (select 1 from family_members where user_id = v_user) then
    raise exception 'המשתמש כבר משויך למשפחה' using errcode = 'unique_violation';
  end if;

  insert into families (name, timezone)
  values (p_family_name, p_timezone)
  returning id into v_family;

  -- אם למשתמש הזה כבר יש קוד כניסה, השם שבקוד הוא מקור האמת
  select ac.label into v_name
  from access_codes ac
  join auth.users u on lower(u.email) = ac.identity_email
  where u.id = v_user;

  insert into family_members (family_id, user_id, display_name, role, can_see_medical)
  values (v_family, v_user, coalesce(v_name, p_display_name), 'admin', true);

  insert into babies (family_id, name, birth_date, birth_time, sex, birth_weight_g)
  values (
    v_family, nullif(trim(coalesce(p_baby_name, '')), ''),
    p_birth_date, p_birth_time, coalesce(p_sex, 'unspecified'), p_birth_weight_g
  )
  returning id into v_baby;

  -- משקל הלידה הוא גם המדידה הראשונה בגרף הגדילה
  if p_birth_weight_g is not null then
    insert into events (baby_id, family_id, type, started_at, data, created_by, note)
    values (
      v_baby, v_family, 'growth',
      (p_birth_date::timestamp + coalesce(p_birth_time, '00:00'::time))
        at time zone p_timezone,
      jsonb_build_object('weight_g', p_birth_weight_g),
      v_user, 'משקל לידה'
    );
  end if;

  insert into reminder_rules (family_id, baby_id, kind, config, is_enabled, quiet_from, quiet_to)
  values
    (v_family, v_baby, 'feed_gap',         '{"hours": 3}'::jsonb,     true,  '23:00', '06:00'),
    (v_family, v_baby, 'diaper_gap',       '{"hours": 4}'::jsonb,     false, '23:00', '06:00'),
    (v_family, v_baby, 'timer_running',    '{"minutes": 150}'::jsonb, true,  null,    null),
    (v_family, v_baby, 'partner_activity', '{}'::jsonb,               true,  '23:00', '06:00'),
    (v_family, v_baby, 'daily_summary',    '{"at": "21:00"}'::jsonb,  false, null,    null);

  -- מכאן כל מי שיש לו קוד מצטרף אוטומטית למשפחה הזו
  perform link_orphan_codes_to_family(v_family);

  return query select v_family, v_baby;
end;
$$;
