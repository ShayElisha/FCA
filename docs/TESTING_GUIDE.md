# מדריך בדיקות | Testing Guide

## 🧪 סוגי בדיקות

יצרתי 3 סקריפטי בדיקה שונים לצרכים שונים:

---

## 1️⃣ בדיקה עם מספרים לדוגמה

**קובץ**: `scripts/test-all-carriers.mts`

**מטרה**: לבדוק אם הסקרייפר **מצליח להגיע לאתר** ולא נחסם

```bash
npx tsx scripts/test-all-carriers.mts
```

**מה זה בודק?**
- ✅ האם הדפדפן מצליח לפתוח את האתר
- ✅ האם לא נחסמנו על ידי bot detection
- ✅ האם הסקרייפר מוצא את שדות הקלט
- ✅ האם הסקרייפר יכול לשלוח בקשה

**תוצאות אפשריות**:
- `not_found` = ✅ מצוין! הסקרייפר עובד (המספר פשוט לא קיים)
- `blocked` = 🚫 נחסמנו - צריך Chrome אמיתי
- `error` = ❌ בעיה טכנית

**זמן ריצה**: ~5-10 דקות (כל 13 החברות)

---

## 2️⃣ מחולל מספרי מכולות תקינים

**קובץ**: `scripts/generate-valid-containers.mts`

**מטרה**: ליצור מספרי מכולות **תקינים מתמטית** עם check digit נכון

```bash
npx tsx scripts/generate-valid-containers.mts
```

**מה זה עושה?**
- יוצר מספרי מכולות תקינים לפי תקן ISO 6346
- מחשב check digit נכון לכל מספר
- מציג 3 מספרים לכל owner code

**דוגמאות פלט**:
```
MSC:
  MSCU: MSCU0573380, MSCU8189746, MSCU7989195
  MSDU: MSDU3865564, MSDU5172825, MSDU2430320

ZIM:
  ZIMU: ZIMU0328067, ZIMU7751091, ZIMU4825349
  ZCSU: ZCSU1321371, ZCSU4688709, ZCSU4594317
```

**למה זה חשוב?**
- אתרים לפעמים דוחים מספרים עם check digit שגוי
- מספרים תקינים נראים יותר ריאליסטיים
- טוב לבדיקות regression

**זמן ריצה**: מיידי (~0.5 שניות)

---

## 3️⃣ בדיקה עם מכולות אמיתיות

**קובץ**: `scripts/test-real-containers.mts`

**מטרה**: לבדוק אם אנחנו **מצליחים למשוך מידע אמיתי** על מכולות

```bash
SCRAPE_MODE=chrome npx tsx scripts/test-real-containers.mts
```

**מה זה בודק?**
- ✅ האם הסקרייפר מוצא מכולות **אמיתיות**
- ✅ האם המידע שנמשך נכון (ETA, יעד, אוניה)
- ✅ האם ה-parsing עובד (חילוץ נתונים)
- ✅ שיעור הצלחה אמיתי

**תוצאות אפשריות**:
- `found` = 🎉 מצוין! מצאנו מכולה אמיתית עם מידע!
- `not_found` = ✅ הסקרייפר עובד (המכולה אולי הושלמה)
- `blocked` = 🚫 נחסמנו
- `error` = ❌ בעיה טכנית

**זמן ריצה**: ~5-10 דקות

**פלט דוגמה**:
```
🔍 Testing MSC: MSCU6053867
✅ MSC: found (18639ms)
   📦 Container: MSCU6053867
   📍 Status: In Transit
   🎯 Destination: Ashdod, Israel
   🕐 ETA: 2026-11-20
   🚢 Vessel: MSC ANNA
```

---

## 📊 מטריקות

### Scraping Success Rate
**אחוז ההצלחה לגשת לאתר**

```
Success Rate = (found + not_found) / total
```

- `found` + `not_found` = הסקרייפר **עבד** (הגיע לאתר)
- `blocked` + `error` = הסקרייפר **נכשל**

**יעד**: 85%+ success rate

### Container Tracking Rate
**אחוז ההצלחה למצוא מכולות אמיתיות**

```
Tracking Rate = found / total
```

**יעד**: משתנה (תלוי במכולות)

### Response Time
**זמן תגובה ממוצע**

```
Avg Time = sum(durations) / count
```

**יעד**: < 10 שניות למכולה

---

## 🎯 איזה בדיקה להריץ?

### רוצה לבדוק אם הסקרייפר עובד בכלל?
→ `test-all-carriers.mts`

### רוצה מספרי מכולות תקינים?
→ `generate-valid-containers.mts`

### רוצה לראות מעקב אמיתי אחר מכולות?
→ `test-real-containers.mts`

---

## 🔍 קריאת תוצאות

### ✅ not_found (טוב!)

```
🔍 MSC: not_found (18639ms)
   ℹ️  Not found in system
```

**משמעות**: הסקרייפר **עובד מעולה!**
- הגיע לאתר ✅
- לא נחסם ✅
- מצא את שדות הקלט ✅
- שלח בקשה ✅
- קיבל תשובה ✅

המכולה פשוט לא קיימת (או הושלמה).

---

### 🎉 found (מעולה!)

```
✅ MSC: found (18639ms)
   📦 Container: MSCU6053867
   📍 Status: In Transit
   🎯 Destination: Ashdod
```

**משמעות**: **הכל עובד!**
- הסקרייפר עובד ✅
- המכולה קיימת ✅
- המידע נמשך נכון ✅
- ה-parsing עובד ✅

---

### 🚫 blocked (בעיה!)

```
🚫 MSC: blocked (4193ms)
   ⚠️  Blocked: MSC/Akamai blocked automated browser
```

**משמעות**: **האתר זיהה אותנו כ-bot**

**פתרונות**:
1. וודא ש-`SCRAPE_MODE=chrome` מוגדר
2. התקן Chrome אמיתי (לא Chromium)
3. המתן 5-10 דקות ונסה שוב
4. בדוק `/api/health` → `readyForMsc: true`

---

### ❌ error (בעיה טכנית)

```
❌ MSC: error (3910ms)
   ⚠️  Error: Could not locate container input
```

**משמעות**: **בעיה בקוד הסקרייפר**

**פתרונות**:
1. האתר שינה את המבנה → צריך לעדכן selectors
2. JavaScript לא נטען → הגדל timeout
3. Bug בקוד → פתח issue

---

## 📈 דוגמת תוצאות

```
📊 TEST SUMMARY
======================================================================

📈 Results:
   Total Carriers Tested: 13
   ✅ Found & Tracked: 2
   🔍 Not Found: 8 (may be delivered/inactive)
   🚫 Blocked: 2
   ❌ Errors: 1
   ⏱️  Average Duration: 15234ms

🎯 Scraping Success Rate: 76.9%
   (found + not_found = successful communication with website)

📦 Container Tracking Rate: 15.4%
   (found = actually found tracking data)
```

**פירוש**:
- **76.9% success rate** = 10/13 חברות הסקרייפר עובד
- **15.4% tracking rate** = 2/13 מצאנו מכולות אמיתיות
- **2 blocked** = צריך לטפל בהם (Chrome, timing)
- **1 error** = צריך לתקן

---

## 💾 קבצי פלט

### test-results.json
מבדיקה רגילה:
```json
{
  "timestamp": "2026-11-14T11:36:23.456Z",
  "summary": {
    "total": 13,
    "found": 0,
    "notFound": 8,
    "blocked": 2,
    "error": 3
  },
  "results": [...]
}
```

### test-real-results.json
מבדיקה עם מכולות אמיתיות:
```json
{
  "timestamp": "2026-11-14T11:36:23.456Z",
  "summary": {...},
  "successRate": 76.9,
  "trackingRate": 15.4,
  "results": [
    {
      "carrier": "msc",
      "status": "found",
      "data": {
        "containerNumber": "MSCU6053867",
        "status": "In Transit",
        "destinationPort": "Ashdod",
        "eta": "2026-11-20",
        ...
      }
    }
  ]
}
```

---

## 🔄 CI/CD Integration

### GitHub Actions

```yaml
name: Carrier Tests

on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install Chrome
        run: |
          wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
          echo "deb http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google.list
          sudo apt-get update
          sudo apt-get install -y google-chrome-stable
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        env:
          SCRAPE_MODE: chrome
        run: npx tsx scripts/test-all-carriers.mts
      
      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: test-results.json
```

---

## 🎓 Best Practices

### ✅ כן:
1. הרץ בדיקות עם `SCRAPE_MODE=chrome`
2. המתן בין בדיקות (rate limiting)
3. שמור תוצאות היסטוריות
4. עקוב אחרי trends (success rate לאורך זמן)
5. בדוק לוגים כשיש כשלים

### ❌ לא:
1. אל תריץ בדיקות כל דקה (rate limiting!)
2. אל תשתמש ב-Chromium לבדיקות
3. אל תתעלם מ-blocked carriers
4. אל תניח שה-success rate יישאר קבוע
5. אל תשכח לעדכן container numbers

---

## 📞 עזרה

אם הבדיקות נכשלות:

1. **בדוק Chrome**: `google-chrome --version`
2. **בדוק משתנה**: `echo $SCRAPE_MODE`
3. **בדוק health**: `curl http://localhost:8787/api/health`
4. **קרא לוגים**: `cat test-real-output.log`
5. **פתח issue**: https://github.com/ShayElisha/FCA/issues

---

**עודכן**: נובמבר 2026
