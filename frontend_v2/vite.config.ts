import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": {
        target: "http://localhost:5001",
        changeOrigin: true,
        // ✅ 保持你原本的設定：把前綴 /api 拿掉再轉給後端
        //   /api/auth/login   → 後端收到 /auth/login
        //   /api/products/... → 後端收到 /products/...
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
    },
  },
});
