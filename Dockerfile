# Builder
FROM node:21-alpine3.18 as builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate
ENV PNPM_HOME=/usr/local/bin

# Copiamos solo lo necesario para instalar deps
COPY package*.json pnpm-lock.yaml* ./

RUN apk add --no-cache --virtual .gyp \
        python3 make g++ \
    && pnpm install --frozen-lockfile \
    && apk del .gyp

# Ahora copiamos el código
COPY . .

RUN pnpm run build


# Deploy
FROM node:21-alpine3.18 as deploy
WORKDIR /app

ARG PORT
ENV PORT=$PORT
EXPOSE $PORT

RUN corepack enable && corepack prepare pnpm@latest --activate
ENV PNPM_HOME=/usr/local/bin

# Copiamos solo lo necesario para producción
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/assets ./assets
COPY package*.json pnpm-lock.yaml* ./

RUN pnpm install --prod --ignore-scripts \
    && addgroup -g 1001 -S nodejs \
    && adduser -S -u 1001 nodejs \
    && rm -rf $PNPM_HOME/.npm $PNPM_HOME/.node-gyp

USER nodejs
CMD ["node", "dist/app.js"]
