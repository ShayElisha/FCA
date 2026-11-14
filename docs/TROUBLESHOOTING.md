# פתרון בעיות | Troubleshooting

## 🚫 "הסריקה נחסמה באתר החברה (הגנת בוטים)"

אם אתה מקבל הודעה זו, זה אומר שאתר חברת השילוח זיהה את הסקרייפר כ-bot וחסם אותו.

### ✅ פתרון 1: השתמש ב-Chrome אמיתי (מומלץ ביותר!)

**הבעיה**: Chromium המובנה של Playwright מזוהה בקלות על ידי מערכות אנטי-בוט.

**הפתרון**: התקן Chrome אמיתי והפעל עם `SCRAPE_MODE=chrome`

#### Linux (Ubuntu/Debian):
```bash
# התקן Chrome
wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
echo "deb http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google.list
sudo apt-get update
sudo apt-get install -y google-chrome-stable

# הרץ את השרת
SCRAPE_MODE=chrome npm run server
```

#### macOS:
```bash
# התקן Chrome (אם לא מותקן)
brew install --cask google-chrome

# הרץ את השרת
SCRAPE_MODE=chrome npm run server
```

#### Docker:
```dockerfile
FROM mcr.microsoft.com/playwright:v1.49.1-jammy

# Install Google Chrome
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add -
RUN echo "deb http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list
RUN apt-get update && apt-get install -y google-chrome-stable

# Set environment
ENV SCRAPE_MODE=chrome

# Your app...
```

#### Windows:
1. התקן Chrome מ-https://www.google.com/chrome/
2. הוסף למשתני הסביבה: `SCRAPE_MODE=chrome`
3. הרץ: `npm run server`

---

### ✅ פתרון 2: בדוק את ה-/api/health

גש ל-`http://localhost:8787/api/health` ובדוק:

```json
{
  "ok": true,
  "readyForMsc": true,  // ← צריך להיות true!
  "mode": "chrome-host"  // ← צריך להיות "chrome-host"
}
```

אם `readyForMsc: false` או `mode: "local-scrape"` - זה אומר שאתה לא משתמש ב-Chrome אמיתי.

---

### ✅ פתרון 3: הגדל Timeouts

חלק מהאתרים איטיים ודורשים יותר זמן:

```bash
SCRAPE_PAGE_TIMEOUT_MS=40000 SCRAPE_MODE=chrome npm run server
```

---

### ✅ פתרון 4: נסה שוב עם Refresh

לפעמים חסימה זמנית. פשוט רענן את הדף ונסה שוב.

---

### ✅ פתרון 5: בדוק את הלוגים

הפעל את השרת ובדוק את ההודעות בקונסול:

```bash
npm run server
```

אמור להופיע:
```
🔍 Attempting to launch real Chrome (recommended for bypass)...
✅ Real Chrome launched successfully
```

אם מופיע:
```
⚠️  Real Chrome not found, falling back to Chromium (may be blocked)
```

אז Chrome לא מותקן. עקוב אחרי פתרון 1.

---

## 🔍 חברות ספציפיות

### Hapag-Lloyd

חברה זו משתמשת באבטחה חזקה מאוד. נסה:
1. Chrome אמיתי (חובה!)
2. Timeout של 40 שניות
3. נסה מספר פעמים (יש rate limiting)

### Yang Ming

דומה ל-Hapag-Lloyd. דורש Chrome אמיתי + timeouts גבוהים.

### ONE, Evergreen, OOCL

אם מקבל "Could not locate container input":
1. האתר אולי שינה את המבנה שלו
2. פתח issue ב-GitHub עם הפרטים
3. נבדוק ונעדכן את הסקרייפר

---

## 📊 בדיקה מהירה

רוצה לבדוק אם הכל עובד? הרץ:

```bash
npx tsx scripts/test-all-carriers.mts
```

זה יבדוק את כל 13 החברות ויראה לך מי עובד ומי נחסם.

---

## 🆘 עדיין לא עובד?

1. **ודא ש-Chrome מותקן**: `google-chrome --version` (Linux/Mac) או `chrome --version` (Windows)
2. **ודא שהמשתנה מוגדר**: `echo $SCRAPE_MODE` צריך להראות `chrome`
3. **נקה ונסה שוב**:
   ```bash
   rm -rf node_modules
   npm install
   SCRAPE_MODE=chrome npm run server
   ```
4. **פתח Issue** ב-GitHub עם:
   - מערכת הפעלה
   - גרסת Chrome (`google-chrome --version`)
   - הלוגים מהקונסול
   - איזו חברה נחסמת

---

## 💡 טיפים נוספים

### כדי למנוע חסימות:
- ✅ השתמש תמיד ב-Chrome אמיתי
- ✅ אל תשלח יותר מדי בקשות ברצף (המתן 2-3 שניות בין בקשות)
- ✅ השתמש ב-timeout גבוה (30-40 שניות)
- ❌ אל תריץ סקרייפינג מאסיבי (מאות מכולות בפעם)

### מדוע Chrome אמיתי עובד טוב יותר?
1. **חתימה דיגיטלית**: Chrome אמיתי חתום על ידי Google
2. **Updates**: Chrome מתעדכן ומכיל את כל התכונות האחרונות
3. **Fingerprint**: Chrome אמיתי קשה הרבה יותר לזהות
4. **Extensions**: Chrome תומך ב-extensions שמוסיפים legitimacy

---

**עדכון אחרון**: נובמבר 2026
