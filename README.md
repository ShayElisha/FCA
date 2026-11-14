# FCA — מעקב מכולות רב־חברתי

סריקת דפי Track & Trace עם Playwright. **אין שימוש ב־API רשמי של חברות הספנות.**

## למה יש חסימה ב־Vercel?

MSC (ואתרים דומים) משתמשים ב־Akamai נגד בוטים.  
Chromium של Vercel Serverless נחסם. **לא נעקוף את ההגנה** (stealth / CAPTCHA solvers) — זה שביר ומנוגד ל־ToS.

## הפתרון שעובד

להריץ את הסקרייפר על **מארח עם דפדפן אמיתי** (המחשב שלכם / Docker / VPS), ולחבר אליו את ה־UI ב־Vercel.

```
[Vercel UI]  --POST /api/track-->  [Vercel proxy]  -->  [Chrome scraper host]
```

### 1) הרצה מקומית (הכי פשוט)

דורש Google Chrome מותקן:

```bash
npm install
npm run dev
```

- UI: http://localhost:5173  
- Scraper: http://localhost:8787  
- בדיקה: `npx tsx scripts/test-msc-container.mts MSCU6789016`

### 2) Docker (ל־VPS / Railway / Render / Fly)

```bash
docker build -t fca-scraper .
docker run -p 8787:8787 -e SCRAPE_MODE=chrome fca-scraper
```

בדקו: `curl http://HOST:8787/api/health`

### 3) חיבור ל־Vercel

בפרויקט Vercel הגדירו Environment Variable:

```
SCRAPER_UPSTREAM_URL=https://scraper-production-c76b4a13.up.railway.app
```

אחרי זה `https://fca-ruby.vercel.app` יעביר את הסריקות לשרת ה־Chrome — בלי עקיפת Akamai.

Scraper host (Railway): https://scraper-production-c76b4a13.up.railway.app  
Health: `/api/health` → `readyForMsc: true` כשהחיבור תקין.

## Production UI

https://fca-ruby.vercel.app
