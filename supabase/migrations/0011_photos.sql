-- =============================================================================
-- 0011_photos — אחסון תמונות
--
-- תוספת בלבד. לא מוחק ולא משנה שום טבלה או נתון קיים.
--
-- הדלי פרטי. אין לתמונות כתובת ציבורית, וכל צפייה עוברת דרך קישור חתום
-- עם תפוגה. תמונה של תינוק לא צריכה להיות נגישה למי שמנחש כתובת.
--
-- מבנה הנתיב: <family_id>/<baby_id>/<קובץ>
-- התיקייה הראשונה היא המשפחה, וזה מה שמדיניות ההרשאות נשענת עליו.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'baby-photos',
  'baby-photos',
  false,
  5 * 1024 * 1024,                       -- 5MB לתמונה, אחרי דחיסה בדפדפן
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;

/**
 * מחלץ את מזהה המשפחה מנתיב הקובץ.
 * מחזיר null אם הנתיב אינו בתבנית הצפויה, כדי שהמרה כושלת ל-uuid
 * לא תפיל את בדיקת ההרשאות אלא פשוט תדחה אותה.
 */
create or replace function public.family_from_storage_path(p_name text)
returns uuid
language plpgsql
immutable
as $$
declare
  v_first text := split_part(p_name, '/', 1);
begin
  if v_first !~ '^[0-9a-fA-F-]{36}$' then
    return null;
  end if;
  return v_first::uuid;
exception
  when others then
    return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- הרשאות על הקבצים
-- -----------------------------------------------------------------------------

drop policy if exists "baby photos: family can read" on storage.objects;
create policy "baby photos: family can read" on storage.objects
  for select
  using (
    bucket_id = 'baby-photos'
    and public.is_active_member(public.family_from_storage_path(name))
  );

drop policy if exists "baby photos: family can upload" on storage.objects;
create policy "baby photos: family can upload" on storage.objects
  for insert
  with check (
    bucket_id = 'baby-photos'
    and public.has_role(
      public.family_from_storage_path(name),
      array['admin', 'logger']::member_role[]
    )
  );

-- מחיקה למנהל בלבד, באותו היגיון שבו רק מנהל מוחק רישום של אחרים
drop policy if exists "baby photos: admin can delete" on storage.objects;
create policy "baby photos: admin can delete" on storage.objects
  for delete
  using (
    bucket_id = 'baby-photos'
    and public.has_role(
      public.family_from_storage_path(name),
      array['admin']::member_role[]
    )
  );
