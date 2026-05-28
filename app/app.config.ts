export default defineAppConfig({
  ui: {
    colors: {
      primary: 'green',
      neutral: 'slate'
    }
  },
  runtimeConfig: {
    public: {
      apiBase: 'http://localhost:443'
    }
  }
})
