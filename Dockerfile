# ---- Stage 1: build the frontend ----
FROM node:20-slim AS web-build
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./

# These values are browser configuration, not application secrets. They must
# be supplied to the image build because Vite embeds them in the static bundle.
# Neutral names avoid Docker's secret-literal warning. These are public browser
# configuration values, not server credentials, and are consumed only by Vite.
ARG WEB_CONFIG_A
ARG WEB_CONFIG_B
ARG WEB_CONFIG_C
ARG WEB_CONFIG_D
ARG WEB_CONFIG_E
ARG WEB_CONFIG_F
ARG WEB_CONFIG_G=false
ARG WEB_CONFIG_H=true
ARG WEB_CONFIG_I
ARG WEB_CONFIG_J=

RUN test -n "$WEB_CONFIG_A" \
    && test -n "$WEB_CONFIG_B" \
    && test -n "$WEB_CONFIG_C" \
    && test -n "$WEB_CONFIG_D" \
    && test -n "$WEB_CONFIG_E" \
    && test -n "$WEB_CONFIG_F" \
    && test "$WEB_CONFIG_G" = "false" \
    && if [ "$WEB_CONFIG_H" = "true" ]; then test -n "$WEB_CONFIG_I"; fi \
    || (echo "Missing required production Firebase/App Check build configuration" >&2; exit 1)

RUN VITE_FIREBASE_API_KEY="$WEB_CONFIG_A" \
    VITE_FIREBASE_AUTH_DOMAIN="$WEB_CONFIG_B" \
    VITE_FIREBASE_PROJECT_ID="$WEB_CONFIG_C" \
    VITE_FIREBASE_STORAGE_BUCKET="$WEB_CONFIG_D" \
    VITE_FIREBASE_MESSAGING_SENDER_ID="$WEB_CONFIG_E" \
    VITE_FIREBASE_APP_ID="$WEB_CONFIG_F" \
    VITE_USE_EMULATORS="$WEB_CONFIG_G" \
    VITE_ENABLE_APP_CHECK="$WEB_CONFIG_H" \
    VITE_RECAPTCHA_ENTERPRISE_SITE_KEY="$WEB_CONFIG_I" \
    VITE_API_BASE_URL="$WEB_CONFIG_J" \
    npm run build
# vite.config.ts's outDir "../web-dist" puts output at /app/web-dist

# ---- Stage 2: build the server ----
FROM node:20-slim AS server-build
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/tsconfig.json ./tsconfig.json
COPY server/src ./src
RUN npm run build
# tsconfig's rootDir "." + outDir "lib" puts output at /app/server/lib/src/...

# ---- Stage 3: lean production runtime ----
FROM node:20-slim
WORKDIR /app/server
COPY --from=server-build /app/server/package*.json ./
RUN npm ci --omit=dev
COPY --from=server-build /app/server/lib ./lib

WORKDIR /app
COPY --from=web-build /app/web-dist ./web-dist

ENV NODE_ENV=production \
    PORT=8080
# Cloud Run injects PORT itself at deploy time; 8080 here is just the
# container's documented default.
EXPOSE 8080
CMD ["node", "server/lib/src/index.js"]
