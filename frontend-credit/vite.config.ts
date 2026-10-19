import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
// 개발 중에는 /api 요청을 Spring Boot로 넘긴다.
// 대상 주소: VITE_API_TARGET → 프로젝트 최상위 .env의 PORT(백엔드와 같은 값) → 8080
export default defineConfig(({ mode }) => {
  const root = loadEnv(mode, "..", "");
  const target =
    process.env.VITE_API_TARGET ?? root.VITE_API_TARGET ?? `http://localhost:${root.PORT || 8080}`;
  return {
    plugins: [react()],
    build: { sourcemap: true },
    server: {
      proxy: {
        "/api": { target, changeOrigin: true, ws: true },
      },
    },
  };
});
