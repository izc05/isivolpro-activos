import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/isivolpro-activos/' : '/',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          pdf: ['jspdf'],
          canvas: ['html2canvas'],
          qr: ['qrcode', 'html5-qrcode']
        }
      }
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173
  }
});
