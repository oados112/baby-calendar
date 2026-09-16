-- =============================================================================
-- 0007_grant_service_role
--
-- תיקון: ב-0004 שללנו את הרשאת ההרצה מ-public כדי שאיש מהאינטרנט לא יוכל
-- לקרוא ישירות לפונקציות הכניסה. זה נכון — אבל ב-Postgres ההרשאה הראשונית
-- ניתנת ל-PUBLIC, ושלילה ממנו שוללת גם מ-service_role, שהוא התפקיד שהשרת
-- שלנו משתמש בו. התוצאה: מסלול הכניסה נחסם בפני עצמו.
--
-- כאן מחזירים את ההרשאה לתפקיד אחד ויחיד — service_role — ומשאירים את
-- anon ואת authenticated חסומים, שזו הייתה הכוונה מלכתחילה.
-- =============================================================================

grant execute on function redeem_access_code(text, text)                to service_role;
grant execute on function attach_code_user(uuid, uuid)                  to service_role;
grant execute on function link_orphan_codes_to_family(uuid)             to service_role;
grant execute on function hash_code(text)                               to service_role;
grant execute on function purge_old_auth_attempts()                     to service_role;
grant execute on function upsert_access_code(text, text, text, member_role, boolean)
  to service_role;

-- ווידוא שהחסימה מהלקוח נשארת בתוקף
revoke all on function redeem_access_code(text, text)     from anon, authenticated;
revoke all on function attach_code_user(uuid, uuid)       from anon, authenticated;
revoke all on function link_orphan_codes_to_family(uuid)  from anon, authenticated;
revoke all on function hash_code(text)                    from anon, authenticated;
revoke all on function upsert_access_code(text, text, text, member_role, boolean)
  from anon, authenticated;
