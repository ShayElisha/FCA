# FCA — מעקב מכולות (Vercel Serverless + Scraping)

סריקת דפי Track & Trace של חברות ספנות באמצעות **Playwright על Vercel Serverless**.  
**אין שימוש ב־API של חברות הספנות.**

## איך זה רץ ב-Vercel

1. ה־UI קורא ל־`POST /api/scrape` לכל חברה בנפרד
2. כל קריאה היא Serverless Function עם Chromium (`@sparticuz/chromium`)
3. אם לא נמצא — ממשיכים לחברה הבאה

## הרצה מקומית (מומלץ ל-MSC)

MSC חוסם Chromium מובנה של Playwright (Akamai). מקומית צריך **Google Chrome מותקן** — הסקרייפר ישתמש ב־`channel: 'chrome'`.

```bash
npm install
npx playwright install chromium
npm run dev
```

- UI: http://localhost:5173  
- שרת: http://localhost:8787  

בדיקת MSC:
`npx tsx scripts/test-msc-container.mts MSCU6789016`


## Production

https://fca-ruby.vercel.app

דורש תוכנית שמאפשרת `maxDuration` מספיק לסריקת דף (מוגדר 60 שנ' לפונקציה).  
זיכרון מומלץ: 1024MB לפונקציית הסריקה.
