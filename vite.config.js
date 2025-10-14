import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
      server: {
        port: 3002,
        host: '192.168.1.11', // IP correto para contornar CORS
        open: true,
        allowedHosts: [
          'localhost',
          '127.0.0.1',
          '192.168.1.11',
          '.ngrok.io',
          '.ngrok-free.app',
          '.ngrok.app'
        ],
        proxy: {
          '/api/solaryum': {
            target: 'https://api-d1297.cloud.solaryum.com.br',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api\/solaryum/, ''),
            secure: true,
            configure: (proxy, _options) => {
              proxy.on('error', (err, _req, _res) => {
                console.log('❌ Proxy error:', err);
              });
              proxy.on('proxyReq', (proxyReq, req, _res) => {
                console.log('🚀 Enviando requisição para:', req.method, req.url);
                
                // Simula que a requisição vem do Swagger (same-origin)
                proxyReq.setHeader('Origin', 'https://api-d1297.cloud.solaryum.com.br');
                proxyReq.setHeader('Referer', 'https://api-d1297.cloud.solaryum.com.br/swagger/index.html');
                proxyReq.setHeader('Host', 'api-d1297.cloud.solaryum.com.br');
                
                // Headers para simular IP correto
                proxyReq.setHeader('X-Forwarded-For', '192.168.1.11');
                proxyReq.setHeader('X-Real-IP', '192.168.1.11');
                proxyReq.setHeader('X-Client-IP', '192.168.1.11');
                proxyReq.setHeader('X-Original-IP', '192.168.1.11');
                proxyReq.setHeader('Client-IP', '192.168.1.11');
                proxyReq.setHeader('Remote-Addr', '192.168.1.11');
                proxyReq.setHeader('X-Forwarded-Proto', 'https');
                proxyReq.setHeader('X-Forwarded-Host', 'api-d1297.cloud.solaryum.com.br');
                
                console.log('📋 Headers enviados:', proxyReq.getHeaders());
              });
              proxy.on('proxyRes', (proxyRes, req, _res) => {
                console.log('✅ Resposta recebida:', proxyRes.statusCode, req.url);
                console.log('📋 Headers da resposta:', proxyRes.headers);
              });
            },
          }
        }
      }
})
