export const useApiBase = () => {
  const config = useRuntimeConfig()
  return String(config.public.apiBase || '/api').replace(/\/+$/, '')
}
