# הקמה — מה שצריך לעשות פעם אחת

כל השירותים כאן חינמיים ו**אף אחד מהם לא מבקש כרטיס אשראי**.
אם מסך כלשהו מבקש אמצעי תשלום — עצור, זה סימן שנבחרה תוכנית לא נכונה.

---

## 1. GitHub — הבית של הקוד

✅ בוצע: <https://github.com/oados112/baby-calendar> (פרטי), וה-remote כבר מחובר
מקומית לענף `main`.

נותר:
1. לדחוף בפעם הראשונה:

```bash
git push -u origin main
```

2. להוסיף את לילך כ-collaborator: `Settings → Collaborators → Add people`.

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
3. את כל התוכן של `supabase/migrations/0003_seed_whitelist.sql`

### 2.2 הרשימה הלבנה — מי בכלל יכול להיכנס

קובץ `0003` כבר מכיל את שתי הכתובות:
`oados112@gmail.com` ו-`lilach451998@gmail.com`.

זו שכבת ההגנה החשובה ביותר: כל ניסיון הרשמה מכתובת אחרת נדחה ברמת בסיס
הנתונים, גם אם מישהו מגיע ישירות ל-API. הוספת אדם נוסף בעתיד לא נעשית
כאן אלא דרך הזמנה מתוך מסך ההגדרות, שגם קובעת את רמת ההרשאה שלו.

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
