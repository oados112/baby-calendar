-- -----------------------------------------------------------------------------
-- תזכורת חיסונים
--
-- לוח החיסונים עצמו חי בקוד ואינו דורש טבלה: "מה ניתן" נשמר כאירוע
-- רגיל מסוג vaccine, עם vaccine_id בתוך ה-data, ו"מה צריך" נגזר מתאריך
-- הלידה. לכן כל המיגרציה הזו היא שורת כלל אחת.
--
-- תוספתית בלבד: שום דבר קיים לא נמחק ולא משתנה, וההרצה בטוחה גם אם
-- היא רצה פעמיים.
--
-- הערך 'vaccine_due' כבר קיים ב-enum של reminder_kind מאז 0001, אז
-- אין כאן גם alter type.
-- -----------------------------------------------------------------------------

insert into reminder_rules (family_id, baby_id, kind, config, is_enabled, quiet_from, quiet_to)
select f.id, null, 'vaccine_due', '{}'::jsonb, true, '21:00', '08:00'
from families f
where not exists (
  select 1 from reminder_rules r
  where r.family_id = f.id and r.kind = 'vaccine_due'
);
