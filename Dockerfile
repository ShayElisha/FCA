# Persistent Chrome/Playwright scraper host for Vercel upstream.
FROM mcr.microsoft.com/playwright:v1.49.1-jammy

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8787
ENV SCRAPE_MODE=chrome
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server ./server

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8787/api/health || exit 1

CMD ["npx", "tsx", "server/index.ts"]
