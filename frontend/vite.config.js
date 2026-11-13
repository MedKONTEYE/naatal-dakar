import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://cdnjs.cloudflare.com https://raw.githubusercontent.com",
  "connect-src 'self'",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'"
].join('; ')

const baseHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), geolocation=(self), microphone=()'
}

const proxy = {
  '/api': {
    target: 'http://localhost:5000',
    changeOrigin: true
  },
  '/socket.io': {
    target: 'http://localhost:5000',
    changeOrigin: true,
    ws: true
  }
}

// Autorise les tunnels Cloudflare rapides (https://xxx.trycloudflare.com)
// pour pouvoir partager l'application en local avec un tiers distant.
const tunnelHosts = ['.trycloudflare.com']

// Injecte une CSP stricte dans le build de production uniquement :
// le serveur de dÃ©veloppement Vite utilise des scripts inline pour le HMR.
const cspPlugin = {
  name: 'naatal-security-headers',
  apply: 'build',
  transformIndexHtml(html) {
    return html.replace(
      '<head>',
      `<head>\n    <meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy}">`
    )
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), cspPlugin],
  server: {
    port: 5173,
    host: '127.0.0.1',
    allowedHosts: tunnelHosts,
    headers: baseHeaders,
    proxy
  },
  preview: {
    port: 4173,
    host: '127.0.0.1',
    allowedHosts: tunnelHosts,
    headers: {
      ...baseHeaders,
      'Content-Security-Policy': contentSecurityPolicy
    },
    proxy
  }
})
