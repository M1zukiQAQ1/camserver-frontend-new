// https://nuxt.com/docs/api/configuration/nuxt-config
const nodeEnv = (globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> }
}).process?.env ?? {}
const defaultBackendApiBase = nodeEnv.NODE_ENV === 'production'
  ? 'https://localhost:443'
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
