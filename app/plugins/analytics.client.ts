// Reports each page view to the backend's visitor statistics (admin panel). No cookies and
// no identifiers are sent; the server derives an anonymous per-day visitor id itself.
export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter()
  const endpoint = `${useApiBase()}/analytics/view`
  let lastPath = ''
  let referrer: string | undefined = document.referrer || undefined

  const report = (path: string) => {
    if (path === lastPath || path.startsWith('/admin')) return
    lastPath = path
    const body = JSON.stringify({ path, referrer })
    referrer = undefined // only the landing page has an outside referrer
    try {
      const sent = navigator.sendBeacon?.(endpoint, new Blob([body], { type: 'application/json' }))
      if (!sent) {
        void fetch(endpoint, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } })
          .catch(() => {})
      }
    } catch {
      // Statistics must never break the page.
    }
  }

  nuxtApp.hook('app:mounted', () => report(router.currentRoute.value.path))
  router.afterEach(to => report(to.path))
})
