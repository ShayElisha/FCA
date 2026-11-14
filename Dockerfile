# Scraper worker with real Google Chrome (not serverless Chromium).
# Deploy this to a VPS / Railway / Render / Fly — then point the Vercel UI at it.
FROM mcr.microsoft.com/playwright:v1.49.1-jammy

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8787
ENV SCRAPE_MODE=chrome
# Force Playwright to use the image browser; Chrome channel is also available in this image.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server ./server
COPY tsconfig.json ./

EXPOSE 8787

CMD ["npx", "tsx", "server/index.ts"]
