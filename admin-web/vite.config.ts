import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** 与 backend 一致：有 `certs/dev-local/*.pem` 时后端仅 HTTPS:3000；自签证书需 secure:false */
const devProxyTarget = process.env.VITE_DEV_PROXY_TARGET || 'https://127.0.0.1:3000';
const devProxySecure = devProxyTarget.startsWith('https:');

export default defineConfig({
  base: '/',
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: devProxyTarget,
        changeOrigin: true,
        ...(devProxySecure ? { secure: false } : {}),
      },
      '/uploads': {
        target: devProxyTarget,
        changeOrigin: true,
        ...(devProxySecure ? { secure: false } : {}),
      },
    },
  },
});
