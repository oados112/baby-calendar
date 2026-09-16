-- =============================================================================
-- 0004_access_codes — כניסה בקוד אישי, בלי מיילים
--
-- כל אדם מקבל קוד אחד קבוע. הקוד הוא בפועל סיסמה, ולכן:
--   * נשמר אך ורק כ-hash. גם למי שיש גישה לבסיס הנתונים אין את הקוד
--   * ניסיונות כושלים נספרים וחוסמים ניחוש שיטתי
--   * ניתן להחלפה או לביטול מיידי, בלי לגעת בשאר הקודים
--
-- הקוד רק מזהה מי אתה. מה מותר לך נקבע כמו קודם ב-family_members וב-RLS.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- הטבלה
-- -----------------------------------------------------------------------------

create table access_codes (
  id            uuid primary key default gen_random_uuid(),
  -- למי הקוד שייך, לתצוגה במסך הניהול ("אוהד", "סבתא רחל")
  label         text not null check (length(trim(label)) between 1 and 40),
  -- מזהה המשתמש ב-Supabase Auth. שום מייל לא נשלח אליו אי פעם.
  identity_email text not null unique check (identity_email = lower(identity_email)),

  code_hash     text not null unique,

  -- התפקיד שיוענק בכניסה
  role          member_role not null default 'viewer',
  can_see_medical boolean not null default false,
  -- למי לצרף. null בקוד הראשון, שמקים את המשפחה
  family_id     uuid references families (id) on delete cascade,

  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users (id),
  last_used_at  timestamptz,
  use_count     integer not null default 0,
  revoked_at    timestamptz
);

create index access_codes_active_idx on access_codes (family_id) where revoked_at is null;

-- אין אף policy: הטבלה אינה נגישה ללקוח בשום צורה.
alter table access_codes enable row level security;

-- -----------------------------------------------------------------------------
-- ניסיונות כניסה — ההגנה העיקרית מפני ניחוש
-- -----------------------------------------------------------------------------

create table auth_attempts (
  id          bigserial primary key,
  ip          text not null,
  succeeded   boolean not null,
  at          timestamptz not null default now()
);

create index auth_attempts_recent_idx on auth_attempts (ip, at desc);
create index auth_attempts_failed_idx on auth_attempts (at desc) where not succeeded;

alter table auth_attempts enable row level security;

-- -----------------------------------------------------------------------------
-- עזרי קוד
-- -----------------------------------------------------------------------------

/** נרמול קלט: אותיות קטנות, בלי רווחים ומקפים. הקוד אינו תלוי רישיות. */
create or replace function normalize_code(p_code text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(coalesce(p_code, ''), '[\s\-]', '', 'g'));
$$;

create or replace function hash_code(p_code text)
returns text
language sql
stable
as $$
  select encode(digest(normalize_code(p_code), 'sha256'), 'hex');
$$;

-- -----------------------------------------------------------------------------
-- הגדרת קוד (יצירה או החלפה)
--
-- מיועד להרצה מה-SQL Editor. ההרשאה לקרוא לו נשללת מהלקוח בסוף הקובץ,
-- כך שאיש מהאינטרנט אינו יכול להגדיר לעצמו קוד.
--
--   select upsert_access_code('אוהד', 'oados112@gmail.com', 'הקוד', 'admin', true);
-- -----------------------------------------------------------------------------

create or replace function upsert_access_code(
  p_label text,
  p_identity_email text,
  p_code text,
  p_role member_role default 'viewer',
  p_can_see_medical boolean default false
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_identity_email));
  v_clean text := normalize_code(p_code);
begin
  if length(v_clean) < 6 then
    raise exception 'קוד קצר מדי — לפחות 6 תווים';
  end if;

  insert into access_codes (
    label, identity_email, code_hash, role, can_see_medical
  )
  values (trim(p_label), v_email, hash_code(p_code), p_role, p_can_see_medical)
  on conflict (identity_email) do update
    set label = excluded.label,
        code_hash = excluded.code_hash,
        role = excluded.role,
        can_see_medical = excluded.can_see_medical,
        revoked_at = null;

  -- מי שיש לו קוד מורשה גם להיווצר כמשתמש Auth
  insert into allowed_emails (email, note)
  values (v_email, trim(p_label))
  on conflict (email) do nothing;

  return 'הקוד של ' || trim(p_label) || ' נקבע';
end;
$$;

-- -----------------------------------------------------------------------------
-- יצירת קוד מתוך האתר (מנהל בלבד)
-- -----------------------------------------------------------------------------

create or replace function create_access_code(
  p_label text,
  p_identity_email text,
  p_code text,
  p_role member_role default 'viewer',
  p_can_see_medical boolean default false
)
returns text
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
    raise exception 'רק מנהל יכול ליצור קוד כניסה' using errcode = 'insufficient_privilege';
  end if;

  perform upsert_access_code(
    p_label, p_identity_email, p_code, p_role, p_can_see_medical
  );

  update access_codes
     set family_id = v_family, created_by = auth.uid()
   where identity_email = lower(trim(p_identity_email));

  return 'הקוד נקבע';
end;
$$;

-- -----------------------------------------------------------------------------
-- מימוש קוד — נקרא אך ורק מהשרת שלנו, עם מפתח service_role
--
-- סף החסימה נמוך בכוונה: באתר של שני הורים אין שום תרחיש לגיטימי של
-- חמישה כשלונות ברבע שעה, ולעומת זאת זה מה שהופך ניחוש לבלתי אפשרי
-- גם כשהקוד עצמו קצר.
-- -----------------------------------------------------------------------------

create or replace function redeem_access_code(p_code text, p_ip text)
returns table (
  identity_email text,
  code_id uuid,
  role member_role,
  can_see_medical boolean,
  family_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_by_ip     integer;
  v_global    integer;
  v_row       access_codes%rowtype;
begin
  select count(*) into v_by_ip
  from auth_attempts
  where ip = p_ip and not succeeded and at > now() - interval '15 minutes';

  if v_by_ip >= 5 then
    raise exception 'too_many_attempts';
  end if;

  -- חסם נוסף שאינו תלוי בכתובת IP, נגד ניסיון מבוזר
  select count(*) into v_global
  from auth_attempts
  where not succeeded and at > now() - interval '15 minutes';

  if v_global >= 30 then
    raise exception 'too_many_attempts';
  end if;

  select * into v_row
  from access_codes
  where code_hash = hash_code(p_code)
    and revoked_at is null;

  if v_row.id is null then
    insert into auth_attempts (ip, succeeded) values (p_ip, false);
    raise exception 'invalid_code';
  end if;

  insert into auth_attempts (ip, succeeded) values (p_ip, true);

  update access_codes
     set last_used_at = now(), use_count = use_count + 1
   where id = v_row.id;

  identity_email  := v_row.identity_email;
  code_id         := v_row.id;
  role            := v_row.role;
  can_see_medical := v_row.can_see_medical;
  family_id       := v_row.family_id;
  return next;
end;
$$;

-- -----------------------------------------------------------------------------
-- צירוף למשפחה בכניסה של מי שקיבל קוד
-- -----------------------------------------------------------------------------

create or replace function attach_code_user(p_code_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row access_codes%rowtype;
begin
  select * into v_row from access_codes where id = p_code_id;
  if v_row.id is null or v_row.family_id is null then
    -- הקוד הראשון: המשפחה עוד לא קיימת, מסך ההקמה ייצור אותה
    return;
  end if;

  insert into family_members (family_id, user_id, display_name, role, can_see_medical)
  values (v_row.family_id, p_user_id, v_row.label, v_row.role, v_row.can_see_medical)
  on conflict (family_id, user_id) do update
    set role = excluded.role,
        can_see_medical = excluded.can_see_medical,
        is_suspended = false;
end;
$$;

/**
 * כשהמנהל הראשון מקים את המשפחה, הקודים שעדיין אינם משויכים
 * נקשרים אליה אוטומטית — כדי שבן/בת הזוג פשוט ייכנסו עם הקוד שלהם.
 */
create or replace function link_orphan_codes_to_family(p_family_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update access_codes set family_id = p_family_id where family_id is null;
$$;

-- -----------------------------------------------------------------------------
-- ניקוי ניסיונות ישנים
-- -----------------------------------------------------------------------------

create or replace function purge_old_auth_attempts()
returns void
language sql
security definer
set search_path = public
as $$
  delete from auth_attempts where at < now() - interval '7 days';
$$;

-- -----------------------------------------------------------------------------
-- הרשאות הקריאה לפונקציות
--
-- PostgREST חושף כל פונקציה ב-schema הציבורי. בלי השורות האלה, כל אדם
-- באינטרנט היה יכול לקרוא ל-redeem_access_code ישירות ולנחש קודים
-- בלי לעבור דרך השרת שלנו. זה החלק החשוב ביותר בקובץ.
-- -----------------------------------------------------------------------------

revoke all on function upsert_access_code(text, text, text, member_role, boolean)
  from public, anon, authenticated;
revoke all on function redeem_access_code(text, text) from public, anon, authenticated;
revoke all on function attach_code_user(uuid, uuid) from public, anon, authenticated;
revoke all on function link_orphan_codes_to_family(uuid) from public, anon, authenticated;
revoke all on function purge_old_auth_attempts() from public, anon, authenticated;
revoke all on function hash_code(text) from public, anon, authenticated;

-- זו כן נקראת מהאתר, והיא בודקת בעצמה שהקורא הוא מנהל
grant execute on function create_access_code(text, text, text, member_role, boolean)
  to authenticated;
