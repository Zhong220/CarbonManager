# ===========================
# 1. Build stage
# ===========================
FROM node:20-alpine AS builder

WORKDIR /app

# 1️⃣ Copy dependency files (use both package.json + package-lock.json)
# This lets Docker cache `npm ci` as long as deps don't change.
COPY package*.json ./

# 2️⃣ Install deps (ci = use lockfile, faster & reproducible)

# Change back to npm ci if lockfile is working properly
# RUN npm ci
RUN npm install 

# 3️⃣ Copy the rest of the app (including src, public, build-static.js, etc.)
COPY . .

# 4️⃣ Build static files into dist/
RUN npm run build

# ===========================
# 2. Runtime stage: nginx
# ===========================
FROM nginx:1.27-alpine

# Optional but nice: set working dir (not strictly required)
WORKDIR /usr/share/nginx/html

# Clear default nginx content
RUN rm -rf ./*

# Copy built frontend
COPY --from=builder /app/dist ./

# Optional: custom nginx config (SPA / routing, gzip, etc.)
# If your `nginx.conf` is meant to be the default site, use:
COPY nginx.conf /etc/nginx/conf.d/default.conf
# COPY nginx_test.conf /etc/nginx/conf.d/default.conf

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]