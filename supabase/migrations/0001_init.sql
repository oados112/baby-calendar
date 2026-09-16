-- =============================================================================
-- 0001_init — סכמת הבסיס
--
-- עקרונות:
--  * כל טבלה עם RLS פעיל וברירת מחדל "חסום".
--  * ההרשאות נאכפות כאן, בבסיס הנתונים — לא בממשק.
--  * אין מחיקה קשה של רישומים: deleted_at בלבד.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- טיפוסים
-- -----------------------------------------------------------------------------

create type member_role as enum ('admin', 'logger', 'viewer');

create type event_type as enum (
  'feed_breast',   -- הנקה
  'feed_bottle',   -- בקבוק
  'pump',          -- שאיבה
  'solids',        -- מוצקים
  'drink',         -- מים/שתייה
  'diaper',        -- חיתול
  'sleep',         -- שינה
  'temperature',   -- חום
  'medicine',      -- תרופה/תוסף
  'vaccine',       -- חיסון
  'doctor',        -- ביקור רופא / טיפת חלב
  'growth',        -- מדידות גדילה
  'activity',      -- זמן בטן, אמבטיה, טיול
  'milestone',     -- אבן דרך
  'note'           -- הערה חופשית
);

-- סוגי אירועים שנחשבים מידע רפואי רגיש (מוגבלים למנהלים כברירת מחדל)
create or replace function is_medical_type(t event_type)
returns boolean
language sql
immutable
as $$
  select t in ('temperature', 'medicine', 'vaccine', 'doctor');
$$;

create type reminder_kind as enum (
  'feed_gap',
  'sleep_gap',
  'diaper_gap',
  'medicine',
  'vitamin',
  'vaccine_due',
  'timer_running',
  'daily_summary',
  'partner_activity'
);

-- -----------------------------------------------------------------------------
-- משפחות וחברים
-- -----------------------------------------------------------------------------

create table families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) between 1 and 60),
  -- אזור זמן המשפחה — כל חישובי "יום" ותזכורות נשענים עליו
  timezone    text not null default 'Asia/Jerusalem',
  created_at  timestamptz not null default now()
);

create table family_members (
  family_id     uuid not null references families (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  display_name  text not null check (length(trim(display_name)) between 1 and 40),
  role          member_role not null default 'viewer',
  -- האם מותר לו לראות מידע רפואי (למנהל תמיד כן)
  can_see_medical boolean not null default false,
  is_suspended  boolean not null default false,
  joined_at     timestamptz not null default now(),
  primary key (family_id, user_id)
);

create index family_members_user_idx on family_members (user_id);

-- רשימה לבנה: רק כתובות שנמצאות כאן יכולות להפוך למשתמש
create table allowed_emails (
  email       text primary key check (email = lower(email)),
  note        text,
  added_at    timestamptz not null default now()
);

-- הזמנות בקישור חד-פעמי
create table invites (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references families (id) on delete cascade,
  email         text not null check (email = lower(email)),
  role          member_role not null default 'viewer',
  can_see_medical boolean not null default false,
  display_name  text,
  token_hash    text not null unique,      -- נשמר כ-hash, לא כטוקן גולמי
  expires_at    timestamptz not null,
  created_by    uuid not null references auth.users (id),
  created_at    timestamptz not null default now(),
  accepted_at   timestamptz,
  revoked_at    timestamptz
);

create index invites_family_idx on invites (family_id) where accepted_at is null and revoked_at is null;

-- -----------------------------------------------------------------------------
-- תינוקות
-- -----------------------------------------------------------------------------

create table babies (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families (id) on delete cascade,
  -- השם יכול להיות ריק: בימים הראשונים עדיין אין שם, וזה מצב תקין ולא חסר
  name        text check (name is null or length(trim(name)) between 1 and 40),
  birth_date  date not null,
  -- שעת לידה, אופציונלי — משמשת לחישוב גיל מדויק בימים הראשונים
  birth_time  time,
  sex         text check (sex in ('male', 'female', 'unspecified')) default 'unspecified',
  photo_path  text,
  birth_weight_g  integer check (birth_weight_g between 200 and 10000),
  birth_height_cm numeric(4, 1) check (birth_height_cm between 20 and 70),
  is_active   boolean not null default true,
  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now()
);

create index babies_family_idx on babies (family_id) where is_active;

-- -----------------------------------------------------------------------------
-- אירועים — טבלה אחת גמישה
-- -----------------------------------------------------------------------------

create table events (
  id          uuid primary key default gen_random_uuid(),
  baby_id     uuid not null references babies (id) on delete cascade,
  -- משוכפל מ-babies כדי ש-RLS לא יצטרך join בכל שורה
  family_id   uuid not null references families (id) on delete cascade,
  type        event_type not null,
  started_at  timestamptz not null,
  ended_at    timestamptz,
  data        jsonb not null default '{}'::jsonb,
  note        text check (note is null or length(note) <= 2000),
  photo_path  text,
  created_by  uuid not null references auth.users (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id),
  deleted_at  timestamptz,

  constraint events_range_valid check (ended_at is null or ended_at >= started_at),
  -- שמירה מפני שעון מוטעה: לא מקבלים אירוע יותר משעה בעתיד
  constraint events_not_future check (started_at <= now() + interval '1 hour')
);

-- השאילתה הנפוצה ביותר: אירועי תינוק לפי סדר זמן יורד
create index events_baby_time_idx
  on events (baby_id, started_at desc)
  where deleted_at is null;

-- "מתי בפעם האחרונה X?" — הבסיס למסך הבית ולמנוע התזכורות
create index events_baby_type_time_idx
  on events (baby_id, type, started_at desc)
  where deleted_at is null;

create index events_family_created_idx on events (family_id, created_at desc);
create index events_data_gin_idx on events using gin (data jsonb_path_ops);

-- -----------------------------------------------------------------------------
-- טיימרים פעילים — משותפים בין המכשירים
-- -----------------------------------------------------------------------------

create table active_timers (
  id          uuid primary key default gen_random_uuid(),
  baby_id     uuid not null references babies (id) on delete cascade,
  family_id   uuid not null references families (id) on delete cascade,
  type        event_type not null,
  -- להנקה: הצד הפעיל כרגע, והזמן שנצבר בכל צד עד כה
  side        text check (side in ('left', 'right')),
  left_sec    integer not null default 0 check (left_sec >= 0),
  right_sec   integer not null default 0 check (right_sec >= 0),
  started_at  timestamptz not null default now(),
  -- זמן ההחלפה האחרונה (ממנו סופרים את הצד הנוכחי)
  segment_started_at timestamptz not null default now(),
  paused_at   timestamptz,
  started_by  uuid not null references auth.users (id),

  -- טיימר אחד מכל סוג לכל תינוק
  unique (baby_id, type)
);

-- -----------------------------------------------------------------------------
-- התראות
-- -----------------------------------------------------------------------------

create table push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  last_ok_at  timestamptz,
  fail_count  smallint not null default 0
);

create index push_subscriptions_user_idx on push_subscriptions (user_id);

create table reminder_rules (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families (id) on delete cascade,
  baby_id     uuid references babies (id) on delete cascade,
  -- למי נשלחת ההתראה. null = לכל חברי המשפחה שיכולים לקבל
  target_user_id uuid references auth.users (id) on delete cascade,
  kind        reminder_kind not null,
  config      jsonb not null default '{}'::jsonb,
  is_enabled  boolean not null default true,
  -- שעות שקט: אין התראות בטווח הזה (שעון מקומי של המשפחה)
  quiet_from  time,
  quiet_to    time,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index reminder_rules_active_idx on reminder_rules (family_id) where is_enabled;

create table notifications_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  rule_id     uuid references reminder_rules (id) on delete set null,
  -- מפתח ייחודי למניעת כפילות: kind + baby + חלון זמן
  dedupe_key  text not null,
  sent_at     timestamptz not null default now(),
  payload     jsonb not null default '{}'::jsonb
);

create index notifications_log_dedupe_idx on notifications_log (user_id, dedupe_key, sent_at desc);

-- -----------------------------------------------------------------------------
-- פונקציות עזר להרשאות
--
-- security definer + search_path קבוע: הפונקציה קוראת את family_members
-- בלי להיתקל ב-RLS של עצמה (אחרת נוצרת רקורסיה אינסופית במדיניות).
-- -----------------------------------------------------------------------------

create or replace function is_active_member(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from family_members m
    where m.family_id = p_family_id
      and m.user_id = auth.uid()
      and not m.is_suspended
  );
$$;

create or replace function has_role(p_family_id uuid, p_roles member_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from family_members m
    where m.family_id = p_family_id
      and m.user_id = auth.uid()
      and not m.is_suspended
      and m.role = any (p_roles)
  );
$$;

create or replace function can_see_medical(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from family_members m
    where m.family_id = p_family_id
      and m.user_id = auth.uid()
      and not m.is_suspended
      and (m.role = 'admin' or m.can_see_medical)
  );
$$;

-- -----------------------------------------------------------------------------
-- טריגרים
-- -----------------------------------------------------------------------------

create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger events_touch_updated_at
  before update on events
  for each row execute function touch_updated_at();

create trigger reminder_rules_touch_updated_at
  before update on reminder_rules
  for each row execute function touch_updated_at();

-- family_id של אירוע נגזר תמיד מהתינוק, לעולם לא נשלח מהלקוח
create or replace function set_event_family_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select b.family_id into new.family_id from babies b where b.id = new.baby_id;
  if new.family_id is null then
    raise exception 'baby % not found', new.baby_id;
  end if;
  return new;
end;
$$;

create trigger events_set_family_id
  before insert or update of baby_id on events
  for each row execute function set_event_family_id();

create trigger active_timers_set_family_id
  before insert or update of baby_id on active_timers
  for each row execute function set_event_family_id();

-- הרשימה הלבנה: חוסמת יצירת משתמש שלא הוזמן.
-- זו שכבת ההגנה האמיתית — גם מי שמגיע ישירות ל-API לא יוכל להירשם.
create or replace function enforce_email_whitelist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(new.email);
begin
  if exists (select 1 from allowed_emails a where a.email = v_email) then
    return new;
  end if;

  if exists (
    select 1 from invites i
    where i.email = v_email
      and i.accepted_at is null
      and i.revoked_at is null
      and i.expires_at > now()
  ) then
    return new;
  end if;

  raise exception 'הרשמה חסומה: כתובת המייל אינה מורשית'
    using errcode = 'insufficient_privilege';
end;
$$;

create trigger enforce_email_whitelist_on_signup
  before insert on auth.users
  for each row execute function enforce_email_whitelist();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table families           enable row level security;
alter table family_members     enable row level security;
alter table allowed_emails     enable row level security;
alter table invites            enable row level security;
alter table babies             enable row level security;
alter table events             enable row level security;
alter table active_timers      enable row level security;
alter table push_subscriptions enable row level security;
alter table reminder_rules     enable row level security;
alter table notifications_log  enable row level security;

-- allowed_emails: אף לקוח לא נוגע בה. ניהול דרך לוח הבקרה בלבד.
-- (אין policy = אין גישה)

-- families
create policy families_read on families
  for select using (is_active_member(id));

create policy families_update on families
  for update using (has_role(id, array['admin']::member_role[]));

-- יצירת משפחה מתבצעת בפונקציה ייעודית (ראו 0002), לא בהוספה ישירה

-- family_members
create policy members_read on family_members
  for select using (is_active_member(family_id));

create policy members_manage on family_members
  for all using (has_role(family_id, array['admin']::member_role[]))
  with check (has_role(family_id, array['admin']::member_role[]));

-- invites — מנהלים בלבד
create policy invites_manage on invites
  for all using (has_role(family_id, array['admin']::member_role[]))
  with check (has_role(family_id, array['admin']::member_role[]));

-- babies
create policy babies_read on babies
  for select using (is_active_member(family_id));

create policy babies_manage on babies
  for all using (has_role(family_id, array['admin']::member_role[]))
  with check (has_role(family_id, array['admin']::member_role[]));

-- events
create policy events_read on events
  for select using (
    is_active_member(family_id)
    and (not is_medical_type(type) or can_see_medical(family_id))
  );

create policy events_insert on events
  for insert with check (
    has_role(family_id, array['admin', 'logger']::member_role[])
    and created_by = auth.uid()
    and (not is_medical_type(type) or can_see_medical(family_id))
  );

-- מנהל עורך הכל; רושם עורך רק את מה שהוא רשם, ורק תוך 24 שעות
create policy events_update on events
  for update using (
    is_active_member(family_id)
    and (
      has_role(family_id, array['admin']::member_role[])
      or (created_by = auth.uid() and created_at > now() - interval '24 hours')
    )
  )
  with check (is_active_member(family_id));

-- אין מחיקה קשה לאף אחד: מוחקים דרך deleted_at (update)

-- active_timers
create policy timers_read on active_timers
  for select using (is_active_member(family_id));

create policy timers_write on active_timers
  for all using (has_role(family_id, array['admin', 'logger']::member_role[]))
  with check (has_role(family_id, array['admin', 'logger']::member_role[]));

-- push_subscriptions — כל אחד רק את המכשירים שלו
create policy push_own on push_subscriptions
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- reminder_rules
create policy rules_read on reminder_rules
  for select using (
    is_active_member(family_id)
    and (target_user_id is null or target_user_id = auth.uid()
         or has_role(family_id, array['admin']::member_role[]))
  );

create policy rules_write on reminder_rules
  for all using (
    has_role(family_id, array['admin']::member_role[])
    or target_user_id = auth.uid()
  )
  with check (
    has_role(family_id, array['admin']::member_role[])
    or target_user_id = auth.uid()
  );

-- notifications_log — קריאה עצמית בלבד; הכתיבה נעשית בצד השרת
create policy notifications_own_read on notifications_log
  for select using (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Realtime — סנכרון חי בין המכשירים
-- -----------------------------------------------------------------------------

alter publication supabase_realtime add table events;
alter publication supabase_realtime add table active_timers;
