// https://nuxt.com/docs/api/configuration/nuxt-config
const nodeEnv = (globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> }
}).process?.env ?? {}
// In production the backend exposes a plain-HTTP loopback connector for this proxy
// (app.http.loopback-port); the public HTTPS port keeps its self-signed certificate.
const defaultBackendApiBase = nodeEnv.NODE_ENV === 'production'
  ? 'http://127.0.0.1:8080'
  : 'http://localhost:443'

export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  // The site is a fixed dark design; app.vue pins the `dark` class on <html> and main.css
  // retunes the Nuxt UI tokens, so the OS light/dark preference must not flip components.
  ui: {
    colorMode: false
  },

  runtimeConfig: {
    backendApiBase: nodeEnv.NUXT_BACKEND_API_BASE || defaultBackendApiBase,
    backendTlsVerify: nodeEnv.NUXT_BACKEND_TLS_VERIFY === 'true',
    backendProxyTimeoutMs: Number(nodeEnv.NUXT_BACKEND_PROXY_TIMEOUT_MS || 30000),
    public: {
      apiBase: nodeEnv.NUXT_PUBLIC_API_BASE || '/api/backend',
      underConstruction: nodeEnv.NUXT_PUBLIC_UNDER_CONSTRUCTION === 'true'
    }
  },

  compatibilityDate: '2025-01-15',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
