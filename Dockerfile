FROM node:26-slim@sha256:e6bedef217677b276c591795e169840edd9096dbf13f29df8ef8d1856b8820bc AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME/bin:$PATH
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm install -g corepack@0.36.0 && corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN --mount=type=secret,id=npm_token \
    env "npm_config_//npm.pkg.github.com/:_authToken=$(cat /run/secrets/npm_token)" \
        pnpm install --frozen-lockfile

FROM base AS dev
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["pnpm", "exec", "next", "dev", "-H", "0.0.0.0", "-p", "3000"]

FROM mcr.microsoft.com/playwright:v1.65.1-noble@sha256:1507cbfc550a63a6b7396791ca4f00df17beb56342d2447b3f106c306f525579 AS e2e
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME/bin:$PATH
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm install -g --force corepack@0.36.0 && corepack enable
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
CMD ["pnpm", "test:e2e"]

FROM base AS build
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:26-slim@sha256:e6bedef217677b276c591795e169840edd9096dbf13f29df8ef8d1856b8820bc AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/db ./db
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
