# node:20-slim (glibc): @libsql/client's native bindings are happier here than on alpine.
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV TZ=America/Los_Angeles
# Prisma's migrate CLI wants libssl; without it the start log prints a warning.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/* \
  && groupadd -r nodejs && useradd -r -g nodejs nextjs
COPY --from=builder /app ./
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app
USER nextjs
EXPOSE 3000
ENV PORT=3000
VOLUME ["/app/data"]
# Applies pending migrations, then starts.
CMD ["npm", "run", "docker:start"]
