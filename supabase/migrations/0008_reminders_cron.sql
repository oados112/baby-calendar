-- =============================================================================
-- 0008_reminders_cron — תזמון מנוע התזכורות
--
-- למה כאן ולא ב-Vercel: בתוכנית החינמית של Vercel משימת cron רצה פעם
-- ביום בלבד. pg_cron בתוך Supabase רץ בכל תדירות, בלי עלות, וכבונוס
-- גם מונע מהפרויקט להירדם.
--
-- הזרימה: pg_cron → pg_net שולח POST לנתיב באתר → הנתיב מריץ מחזור
-- ושולח את ההתראות. הסוד המשותף נשמר בטבלה ולא בקוד.
-- =============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- -----------------------------------------------------------------------------
-- הגדרות שאסור שיישבו ב-git
-- -----------------------------------------------------------------------------

create table if not exists app_config (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz not null default now()
);

-- אין policy: הטבלה נגישה רק לתפקידי השרת. הלקוח לא רואה אותה כלל.
alter table app_config enable row level security;

comment on table app_config is
  'הגדרות שרת. site_url = כתובת האתר, cron_secret = הסוד שמאפשר להריץ את מנוע התזכורות.';

-- -----------------------------------------------------------------------------
-- הקריאה לאתר
-- -----------------------------------------------------------------------------

create or replace function trigger_reminders()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url    text;
  v_secret text;
begin
  select value into v_url    from app_config where key = 'site_url';
  select value into v_secret from app_config where key = 'cron_secret';

  if v_url is null or v_secret is null then
    raise notice 'מנוע התזכורות לא מוגדר — חסר site_url או cron_secret ב-app_config';
    return;
  end if;

  -- קריאה אסינכרונית: pg_cron לא ממתין לתשובה, כך שתקלה באתר
  -- לא תתקע את בסיס הנתונים
  perform net.http_post(
    url     := v_url || '/api/cron/reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_secret
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$$;

revoke all on function trigger_reminders() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- התזמון
-- -----------------------------------------------------------------------------

-- הסרה קודם, כדי שהרצה חוזרת של הקובץ לא תיצור כפילות
select cron.unschedule('baby-calendar-reminders')
where exists (
  select 1 from cron.job where jobname = 'baby-calendar-reminders'
);

select cron.schedule(
  'baby-calendar-reminders',
  '*/5 * * * *',
  $$select trigger_reminders();$$
);

-- ניקוי יומי של יומן ההתראות, כדי שהטבלה לא תגדל לנצח
select cron.unschedule('baby-calendar-purge-attempts')
where exists (
  select 1 from cron.job where jobname = 'baby-calendar-purge-attempts'
);

select cron.schedule(
  'baby-calendar-purge-attempts',
  '17 4 * * *',
  $$
    delete from notifications_log where sent_at < now() - interval '30 days';
    select purge_old_auth_attempts();
  $$
);
