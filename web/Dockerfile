FROM node:22-bookworm-slim AS dependencies
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci

FROM dependencies AS build
COPY web/src/ ./src/
COPY web/static/ ./static/
COPY web/migrations/ ./migrations/
COPY web/scripts/ ./scripts/
COPY web/vite.config.ts web/tsconfig.json ./
COPY ui/ /app/ui/
COPY infra/beta/ /app/infra/beta/
RUN npm run build

# Migration and worker tools retain the locked TypeScript runtime.
FROM build AS tools
ENV NODE_ENV=production
USER node
CMD ["node", "/app/infra/beta/run-jobs.mjs"]

FROM node:22-bookworm-slim AS runtime
WORKDIR /app/web
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY --from=build /app/web/package.json /app/web/package-lock.json ./
COPY --from=build /app/web/node_modules ./node_modules
RUN npm prune --omit=dev && npm cache clean --force
COPY --from=build /app/web/build ./build
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e 'fetch("http://127.0.0.1:3000/api/health").then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))'
CMD ["node", "build"]
