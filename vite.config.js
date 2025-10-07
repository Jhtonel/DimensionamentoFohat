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
        host: '192.168.1.9', // IP correto da máquina
        open: true,
        proxy: {
          '/api/solaryum': {
            target: 'https://api-d1297.cloud.solaryum.com.br',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api\/solaryum/, ''),
            secure: true,
            headers: {
              'Origin': 'https://api-d1297.cloud.solaryum.com.br',
              'Referer': 'https://api-d1297.cloud.solaryum.com.br/swagger/index.html',
              'X-Forwarded-For': '192.168.1.9',
              'X-Real-IP': '192.168.1.9',
              'X-Client-IP': '192.168.1.9',
              'X-Original-IP': '192.168.1.9',
              'Client-IP': '192.168.1.9',
              'Remote-Addr': '192.168.1.9'
            },
            configure: (proxy, _options) => {
              proxy.on('error', (err, _req, _res) => {
                console.log('proxy error', err);
              });
              proxy.on('proxyReq', (proxyReq, req, _res) => {
                console.log('Sending Request to the Target:', req.method, req.url);
                console.log('Client IP:', req.connection.remoteAddress);
                
                // Simula que a requisição vem do Swagger
                proxyReq.setHeader('Origin', 'https://api-d1297.cloud.solaryum.com.br');
                proxyReq.setHeader('Referer', 'https://api-d1297.cloud.solaryum.com.br/swagger/index.html');
                proxyReq.setHeader('Host', 'api-d1297.cloud.solaryum.com.br');
                
                // Força o IP correto
                proxyReq.setHeader('X-Forwarded-For', '192.168.1.9');
                proxyReq.setHeader('X-Real-IP', '192.168.1.9');
                proxyReq.setHeader('X-Client-IP', '192.168.1.9');
                proxyReq.setHeader('X-Original-IP', '192.168.1.9');
                proxyReq.setHeader('Client-IP', '192.168.1.9');
                proxyReq.setHeader('Remote-Addr', '192.168.1.9');
                
                console.log('Headers enviados:', proxyReq.getHeaders());
              });
              proxy.on('proxyRes', (proxyRes, req, _res) => {
                console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
                console.log('Response headers:', proxyRes.headers);
              });
            },
          }
        }
      }
})
