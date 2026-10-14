import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 개발 중에는 /api 요청(실시간 채널 /api/ws 포함)을 Spring Boot(8080)로 넘긴다.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET ?? 'http://localhost:8080',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
