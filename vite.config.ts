import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    // Serve under a sub-path (e.g. "/app/") by setting VITE_BASE_PATH
    base: env.VITE_BASE_PATH || '/',
    server: { port: 5173 },
  };
});
