import { createError, defineEventHandler, getRequestURL, proxyRequest } from 'h3'
import { useRuntimeConfig } from '#imports'

const backendRoutePrefix = '/api/backend'

export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)
  const backendBase = String(config.backendApiBase || '').replace(/\/+$/, '')

  if (!backendBase) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Backend API base URL is not configured'
    })
  }

  const requestUrl = getRequestURL(event)
  const targetUrl = buildTargetUrl(backendBase, requestUrl)
  const timeoutMs = Number(config.backendProxyTimeoutMs || 30000)

  return proxyRequest(event, targetUrl.toString(), {
    fetchOptions: {
      signal: AbortSignal.timeout(timeoutMs)
    }
  })
})

function buildTargetUrl(backendBase: string, requestUrl: URL) {
  const baseUrl = new URL(backendBase)
  const forwardedPath = requestUrl.pathname.startsWith(backendRoutePrefix)
    ? requestUrl.pathname.slice(backendRoutePrefix.length)
    : requestUrl.pathname

  baseUrl.pathname = joinUrlPaths(baseUrl.pathname, forwardedPath)
  baseUrl.search = requestUrl.search

  return baseUrl
}

function joinUrlPaths(basePath: string, forwardedPath: string) {
  const normalizedBase = basePath.replace(/\/+$/, '')
  const normalizedForwarded = forwardedPath.replace(/^\/+/, '')

  return normalizedForwarded
    ? `${normalizedBase}/${normalizedForwarded}`
    : normalizedBase || '/'
}
