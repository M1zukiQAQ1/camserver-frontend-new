import { createError, defineEventHandler, getRequestURL, proxyRequest } from 'h3'
import { useRuntimeConfig } from '#imports'

const backendRoutePrefix = '/api/backend'

/**
 * Forwards /api/backend/** to the Spring backend.
 *
 * The timeout only covers the wait for response headers: bodies stream for as long as the
 * backend keeps sending, which the seeing-monitor video (/api/live/stream.mp4) and large FITS
 * downloads need. When the browser drops the connection the upstream request is aborted so the
 * backend stops producing a stream nobody is watching.
 */
export default defineEventHandler(async (event) => {
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

  const upstream = new AbortController()
  const abortUpstream = () => upstream.abort()
  let headersTimer: ReturnType<typeof setTimeout> | undefined = setTimeout(abortUpstream, timeoutMs)
  const clearHeadersTimer = () => {
    if (headersTimer) {
      clearTimeout(headersTimer)
      headersTimer = undefined
    }
  }

  event.node.res.on('close', abortUpstream)

  try {
    return await proxyRequest(event, targetUrl.toString(), {
      fetchOptions: {
        signal: upstream.signal
      },
      onResponse: clearHeadersTimer
    })
  } catch (error) {
    if (upstream.signal.aborted && event.node.res.headersSent) {
      // The client went away while the body was streaming; there is nobody left to answer.
      event.node.res.end()
      return
    }
    throw error
  } finally {
    clearHeadersTimer()
    event.node.res.off('close', abortUpstream)
  }
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
