-- =============================================================================
-- 0012_medication_plans — סל תרופות וויטמינים
--
-- תוספתי בלבד: יוצר טבלה חדשה, ומוסיף שורת הגדרה אחת לכל משפחה קיימת
-- כדי שהמתג הראשי של ההתראות יופיע. לא נוגע באף רישום קיים.
--
-- ההבחנה החשובה כאן היא schedule:
--   'interval' / 'daily_at' — תרופה קבועה. מתריעים כשהגיע הזמן ולא ניתנה.
--   'as_needed'             — ניתנת רק כשצריך (אקמול לחום). **לעולם לא
--                             מתריעים עליה.** התראה כזו דוחפת לתת תרופה
--                             שאין בה צורך, וזה מזיק ולא מועיל.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'medication_schedule') then
    create type medication_schedule as enum ('interval', 'daily_at', 'as_needed');
  end if;
end
$$;

create table if not exists medication_plans (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references families (id) on delete cascade,
  baby_id       uuid not null references babies (id) on delete cascade,

  kind          text not null default 'vitamin'
                check (kind in ('vitamin', 'medicine')),
  name          text not null check (length(trim(name)) between 1 and 60),

  -- המינון שנקבע על ידי הרופא או האריזה. האתר רק זוכר אותו.
  dose_amount   numeric(8, 3) check (dose_amount is null or dose_amount > 0),
  dose_unit     text,

  schedule      medication_schedule not null default 'interval',
  -- ל-'interval': כל כמה שעות
  every_hours   numeric(5, 2) check (every_hours is null or every_hours between 0.5 and 168),
  -- ל-'daily_at': באיזו שעה ביום, לפי אזור הזמן של המשפחה
  daily_at      time,

  max_per_day   integer check (max_per_day is null or max_per_day between 1 and 24),
  -- קורס עם התחלה וסוף: אנטיביוטיקה לשבוע מפסיקה להתריע מעצמה
  starts_on     date,
  ends_on       date,

  reminder_enabled boolean not null default true,
  is_active     boolean not null default true,
  note          text check (note is null or length(note) <= 500),

  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users (id),
  updated_at    timestamptz not null default now(),

  -- תזמון חייב להיות שלם: אין 'interval' בלי שעות, ואין 'daily_at' בלי שעה
  constraint medication_schedule_complete check (
    (schedule = 'interval'  and every_hours is not null)
    or (schedule = 'daily_at' and daily_at is not null)
    or schedule = 'as_needed'
  ),
  constraint medication_dates_ordered check (
    starts_on is null or ends_on is null or ends_on >= starts_on
  )
);

create index if not exists medication_plans_baby_idx
  on medication_plans (baby_id)
  where is_active;

alter table medication_plans enable row level security;

-- -----------------------------------------------------------------------------
-- הרשאות
--
-- קריאה: כמו כל מידע רפואי — רק מי שהורשה לראות אותו.
-- שינוי: מנהל בלבד. זו הגדרה של טיפול, לא רישום יומיומי.
-- -----------------------------------------------------------------------------

drop policy if exists medication_plans_read on medication_plans;
create policy medication_plans_read on medication_plans
  for select using (can_see_medical(family_id));

drop policy if exists medication_plans_manage on medication_plans;
create policy medication_plans_manage on medication_plans
  for all using (has_role(family_id, array['admin']::member_role[]))
  with check (has_role(family_id, array['admin']::member_role[]));

create trigger medication_plans_touch_updated_at
  before update on medication_plans
  for each row execute function touch_updated_at();

-- family_id נגזר מהתינוק ולא נשלח מהלקוח, כמו באירועים
create trigger medication_plans_set_family_id
  before insert or update of baby_id on medication_plans
  for each row execute function set_event_family_id();

-- -----------------------------------------------------------------------------
-- המתג הראשי בהגדרות ההתראות
--
-- quiet_from/quiet_to נשארים ריקים בכוונה: תזכורת תרופה עוברת מעל שעות
-- שקט. מנה שהוחמצה בלילה היא בדיוק המקרה שבו כן רוצים להתעורר.
-- -----------------------------------------------------------------------------

insert into reminder_rules (family_id, baby_id, kind, config, is_enabled)
select f.id, null, 'medicine', '{}'::jsonb, true
from families f
where not exists (
  select 1 from reminder_rules r
  where r.family_id = f.id and r.kind = 'medicine'
);
