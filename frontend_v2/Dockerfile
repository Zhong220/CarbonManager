# --- build stage ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# 你的前端 API 呼叫請用 baseURL = /api（見下方 http.ts）
RUN npm run build

# --- serve stage ---
FROM nginx:alpine
# 用我們的 nginx 設定（/api 會反代到後端）
COPY ./nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
