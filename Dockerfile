FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm i
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 finaflow
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/db ./db
COPY --from=builder /app/package.json ./
COPY --from=builder /app/drizzle.config.ts drizzle.config.ts
COPY --from=builder /app/scripts/run-migrations.ts scripts/run-migrations.ts
COPY --from=builder /app/scripts/fix-duplicate-ap-accounts.ts scripts/fix-duplicate-ap-accounts.ts
USER finaflow

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 0
CMD ["sh", "-c", "npx tsx scripts/run-migrations.ts && npx tsx scripts/fix-duplicate-ap-accounts.ts && node dist/boot.js"]
