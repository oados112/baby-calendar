# הקמה — מה שצריך לעשות פעם אחת

כל השירותים כאן חינמיים ו**אף אחד מהם לא מבקש כרטיס אשראי**.
אם מסך כלשהו מבקש אמצעי תשלום — עצור, זה סימן שנבחרה תוכנית לא נכונה.

---

## 1. GitHub — הבית של הקוד

1. היכנס ל-[github.com](https://github.com) עם החשבון שלך.
2. צור repository חדש בשם `baby-calendar`, וסמן **Private**.
   אל תסמן "Add a README" — כבר יש לנו קוד.
3. חבר את התיקייה המקומית ודחוף (הרץ בתיקיית הפרויקט):

```bash
git remote add origin https://github.com/<שם-המשתמש-שלך>/baby-calendar.git
git branch -M main
git push -u origin main
```

4. הוסף את אשתך: `Settings → Collaborators → Add people`.

---

## 2. Supabase — בסיס הנתונים וההתחברות

1. היכנס ל-[supabase.com](https://supabase.com) והתחבר עם GitHub.
2. `New project`:
   - **Plan**: Free (ברירת מחדל)
   - **Name**: `baby-calendar`
   - **Region**: `Central EU (Frankfurt)` — הכי קרוב לישראל
   - **Database password**: צור סיסמה חזקה ושמור אותה במנהל סיסמאות
3. חכה ~2 דקות עד שהפרויקט עולה.

### 2.1 הרצת המיגרציות

ב-Supabase: `SQL Editor` → `New query`. הדבק והרץ **לפי הסדר**:

1. את כל התוכן של `supabase/migrations/0001_init.sql`
2. את כל התוכן של `supabase/migrations/0002_rpc.sql`

### 2.2 הרשימה הלבנה — מי בכלל יכול להיכנס

עדיין ב-SQL Editor, החלף לכתובות האמיתיות והרץ:

```sql
insert into allowed_emails (email, note) values
  ('הכתובת-שלך@gmail.com', 'אבא'),
  ('הכתובת-של-אשתך@gmail.com', 'אמא');
```

זו שכבת ההגנה החשובה ביותר: כל ניסיון הרשמה מכתובת אחרת נדחה ברמת בסיס
הנתונים, גם אם מישהו מגיע ישירות ל-API.

### 2.3 הגדרות אימות

`Authentication → Providers`:
- **Email**: פעיל, עם `Confirm email` דלוק
- **Enable email signups**: אפשר להשאיר דלוק — הרשימה הלבנה חוסמת ממילא

`Authentication → URL Configuration`:
- **Site URL**: כתובת האתר בפרודקשן (נמלא אחרי שלב 3)
- **Redirect URLs**: הוסף `http://localhost:3000/**`

### 2.4 המפתחות

`Project Settings → API`. העתק:
- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

צור בתיקיית הפרויקט קובץ `.env.local` לפי `.env.example` ומלא אותם.
**הקובץ הזה לעולם לא נכנס ל-git.**

---

## 3. Vercel — אחסון האתר

1. היכנס ל-[vercel.com](https://vercel.com) עם GitHub.
2. בחר **Hobby** (חינם, בלי כרטיס אשראי).
3. `Add New → Project` → בחר את `baby-calendar` → `Import`.
4. ב-`Environment Variables` הוסף את אותם שני משתנים מהשלב הקודם,
   ובנוסף `NEXT_PUBLIC_SITE_URL` עם הכתובת שתקבל (למשל
   `https://baby-calendar.vercel.app`).
5. `Deploy`.
6. חזור ל-Supabase → `Authentication → URL Configuration` והגדר את
   **Site URL** לכתובת שקיבלת, והוסף אותה גם ל-Redirect URLs עם `/**`.

מרגע זה, כל `git push` ל-`main` מעדכן את האתר תוך כדקה.

### מה לא להפעיל ב-Vercel
כדי שלא ייווצר חיוב: אל תפעיל `Analytics`, `Speed Insights`, `Blob`, `KV`
או `Image Optimization` בתשלום. תמונות נשמרות ב-Supabase Storage.

---

## 4. התראות (שלב מאוחר יותר)

ייווצרו מפתחות VAPID ויתווספו כמשתני סביבה. ה-cron יושב בתוך Supabase
(`pg_cron`) ולא ב-Vercel — כי ב-Vercel החינמית cron רץ פעם ביום בלבד.

---

## 5. הרצה מקומית

```bash
npm install
npm run dev
```

האתר עולה ב-[http://localhost:3000](http://localhost:3000).
כל עוד אין `.env.local`, האתר רץ ב**מצב תצוגה** עם נתוני דוגמה — אפשר
לפתח ולבחון את הממשק בלי חשבון Supabase.
