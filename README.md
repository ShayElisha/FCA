# FCA — מעקב מכולות (Vercel Serverless + Scraping)

סריקת דפי Track & Trace של חברות ספנות באמצעות **Playwright על Vercel Serverless**.  
**אין שימוש ב־API של חברות הספנות.**

## איך זה רץ ב-Vercel

1. ה־UI קורא ל־`POST /api/scrape` לכל חברה בנפרד
2. כל קריאה היא Serverless Function עם Chromium (`@sparticuz/chromium`)
3. אם לא נמצא — ממשיכים לחברה הבאה

## הרצה מקומית

```bash
npm install
npx playwright install chromium
npm run dev
```

- UI: http://localhost:5173  
- שרת תואם ל־`/api/scrape`: http://localhost:8787  

## Production

https://fca-ruby.vercel.app

דורש תוכנית שמאפשרת `maxDuration` מספיק לסריקת דף (מוגדר 60 שנ' לפונקציה).  
זיכרון מומלץ: 1024MB לפונקציית הסריקה.
