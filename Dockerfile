# Persistent Playwright scraper host — real Chrome for MSC/Akamai.
FROM mcr.microsoft.com/playwright:v1.49.1-jammy

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8787
ENV SCRAPE_MODE=chrome
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV DEBIAN_FRONTEND=noninteractive

# Branded Google Chrome (channel: 'chrome') — bundled Chromium is blocked by MSC/Akamai
RUN apt-get update \
  && apt-get install -y --no-install-recommends wget gnupg ca-certificates \
  && wget -qO- https://dl.google.com/linux/linux_signing_key.pub \
    | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg \
  && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" \
    > /etc/apt/sources.list.d/google-chrome.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends google-chrome-stable \
  && rm -rf /var/lib/apt/lists/* \
  && google-chrome --version

COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
  && npm install playwright@1.49.1 playwright-core@1.49.1 --save-exact --omit=dev --no-fund --no-audit \
  && node -e "const p=require('playwright/package.json'); if(p.version!=='1.49.1'){console.error('bad playwright',p.version); process.exit(1)} console.log('playwright',p.version)"

COPY server ./server

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8787/api/health || exit 1

CMD ["./node_modules/.bin/tsx", "server/index.ts"]
