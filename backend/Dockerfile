# Multi-stage build for a lean production image.
# - deps: install everything (dev + prod) so Prisma can generate client
# - build: compile TypeScript
# - runtime: copy dist + node_modules pruned to prod deps

# ─── deps ─────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS deps
WORKDIR /app
ENV NODE_ENV=development
# System packages Prisma expects on Debian-slim.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
COPY prisma ./prisma
# postinstall runs `prisma generate` against the copied schema.
RUN npm install --no-audit --no-fund

# ─── build ────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS build
WORKDIR /app
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ─── runtime ──────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=4000
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Only copy what the runtime needs; dev deps are pruned in a fresh install.
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm install --omit=dev --no-audit --no-fund

# Compiled JS + Prisma-generated client + engine binaries.
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 4000

# `start:prod` runs `prisma migrate deploy` then boots the compiled server.
CMD ["npm", "run", "start:prod"]
