-- =============================================================================
-- 0010_home_snapshot — כל מה שמסך הבית צריך, בפנייה אחת
--
-- תוספת בלבד. הקובץ הזה לא מוחק, לא משנה ולא נוגע באף טבלה או נתון
-- קיים — הוא רק יוצר פונקציית קריאה חדשה.
--
-- למה: מסך הבית ביצע שלוש פניות בזו אחר זו — חברות במשפחה, רשימת
-- הילדים, ואז האירועים. כל פנייה כ-0.4 שניות, וכולן חיכו זו לזו.
-- הפונקציה הזו מחזירה את הכל במכה אחת.
--
-- security invoker (ברירת המחדל): הפונקציה רצה בהרשאות של הקורא, ולכן
-- ה-RLS ממשיך לחול על כל שורה בדיוק כמו קודם. אין כאן שום הרחבת גישה.
-- =============================================================================

create or replace function get_home_snapshot(
  p_baby_id uuid default null,
  p_limit integer default 41
)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_member   family_members%rowtype;
  v_timezone text;
  v_babies   jsonb;
  v_baby_id  uuid;
begin
  select * into v_member
  from family_members
  where user_id = auth.uid() and not is_suspended
  limit 1;

  if v_member.user_id is null then
    return jsonb_build_object('member', null);
  end if;

  select f.timezone into v_timezone from families f where f.id = v_member.family_id;

  select coalesce(jsonb_agg(to_jsonb(b) order by b.sort_order, b.created_at), '[]'::jsonb)
    into v_babies
  from babies b
  where b.family_id = v_member.family_id and b.is_active;

  -- הילד/ה המבוקש/ת, או הראשון/ה אם הבחירה כבר לא קיימת
  select b.id into v_baby_id
  from babies b
  where b.family_id = v_member.family_id and b.is_active and b.id = p_baby_id;

  if v_baby_id is null then
    select b.id into v_baby_id
    from babies b
    where b.family_id = v_member.family_id and b.is_active
    order by b.sort_order, b.created_at
    limit 1;
  end if;

  return jsonb_build_object(
    'member',    to_jsonb(v_member),
    'timezone',  coalesce(v_timezone, 'Asia/Jerusalem'),
    'babies',    v_babies,
    'baby_id',   v_baby_id,
    'events',    coalesce((
      select jsonb_agg(to_jsonb(e) order by e.started_at desc)
      from (
        select *
        from events
        where baby_id = v_baby_id and deleted_at is null
        order by started_at desc
        limit greatest(1, least(p_limit, 200))
      ) e
    ), '[]'::jsonb),
    'timers',    coalesce((
      select jsonb_agg(to_jsonb(t))
      from active_timers t
      where t.baby_id = v_baby_id
    ), '[]'::jsonb),
    'members',   coalesce((
      select jsonb_object_agg(m.user_id, m.display_name)
      from family_members m
      where m.family_id = v_member.family_id
    ), '{}'::jsonb)
  );
end;
$$;

grant execute on function get_home_snapshot(uuid, integer) to authenticated;
