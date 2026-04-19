# syntax=docker/dockerfile:1.7
# =========================================================
# TrustLayer frontend — Next.js 15 + Tailwind
# =========================================================
FROM node:22-alpine AS base

ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=development

WORKDIR /app

# =========================================================
# Stage: deps — tylko package.json dla cache Dockera
# =========================================================
FROM base AS deps

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# =========================================================
# Stage: dev — next dev z Fast Refresh + hot reload
# =========================================================
FROM deps AS dev

# Telemetry off, aliasy paths działają z bind-mountu
ENV WATCHPACK_POLLING=true \
    CHOKIDAR_USEPOLLING=true

EXPOSE 3000

CMD ["npm", "run", "dev"]

# =========================================================
# Stage: builder — next build
# =========================================================
FROM deps AS builder

ENV NODE_ENV=production

COPY . .
RUN npm run build

# =========================================================
# Stage: prod — tylko standalone output + statyki
# =========================================================
FROM node:22-alpine AS prod

ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    PORT=3000

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Kopiujemy tylko to co potrzeba do uruchomienia
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3000/ > /dev/null || exit 1

CMD ["npm", "run", "start"]
