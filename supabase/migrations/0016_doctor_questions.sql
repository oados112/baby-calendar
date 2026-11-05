-- -----------------------------------------------------------------------------
-- שאלות לרופא
--
-- נזכרים בשאלה בשלוש לפנות בוקר ושוכחים אותה בחדר הטיפולים. הטבלה
-- הזו היא המקום שבו היא ממתינה עד הביקור.
--
-- למה טבלה ולא אירוע: שאלה אינה דבר שקרה בזמן מסוים, אלא פריט פתוח
-- שמחכה. יש לה מצב (נענתה או לא) ותשובה, ואין לה מקום על ציר הזמן
-- של היומן.
--
-- תוספתית בלבד: טבלה חדשה, בלי מגע בשום דבר קיים. הרצה חוזרת בטוחה.
-- -----------------------------------------------------------------------------

create table if not exists doctor_questions (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families (id) on delete cascade,
  baby_id     uuid not null references babies (id) on delete cascade,
  text        text not null check (length(trim(text)) between 1 and 500),
  -- התשובה שקיבלתם, אם נרשמה
  answer      text check (answer is null or length(answer) <= 2000),
  answered_at timestamptz,
  created_at  timestamptz not null default now(),
  created_by  uuid not null references auth.users (id)
);

-- השאילתה היחידה: השאלות הפתוחות של תינוק, החדשות קודם
create index if not exists doctor_questions_open_idx
  on doctor_questions (baby_id, created_at desc)
  where answered_at is null;

create index if not exists doctor_questions_baby_idx
  on doctor_questions (baby_id, created_at desc);

alter table doctor_questions enable row level security;

-- -----------------------------------------------------------------------------
-- הרשאות
--
-- שאלה לרופא אינה מידע רפואי מוגבל אלא תזכורת של ההורים, ולכן כל מי
-- שבמשפחה רואה אותה. כתיבה — כל מי שרשאי לרשום.
-- -----------------------------------------------------------------------------

drop policy if exists questions_read on doctor_questions;
create policy questions_read on doctor_questions
  for select using (
    family_id in (
      select m.family_id from family_members m
      where m.user_id = auth.uid() and not m.is_suspended
    )
  );

drop policy if exists questions_write on doctor_questions;
create policy questions_write on doctor_questions
  for all using (
    family_id in (
      select m.family_id from family_members m
      where m.user_id = auth.uid()
        and not m.is_suspended
        and m.role in ('admin', 'logger')
    )
  )
  with check (
    family_id in (
      select m.family_id from family_members m
      where m.user_id = auth.uid()
        and not m.is_suspended
        and m.role in ('admin', 'logger')
    )
  );

-- family_id נגזר מהתינוק/ת ולא נשלח מהלקוח, כמו באירועים
create or replace function doctor_questions_set_family()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select b.family_id into new.family_id from babies b where b.id = new.baby_id;
  if new.family_id is null then
    raise exception 'unknown baby';
  end if;
  return new;
end;
$$;

drop trigger if exists doctor_questions_family on doctor_questions;
create trigger doctor_questions_family
  before insert on doctor_questions
  for each row execute function doctor_questions_set_family();
