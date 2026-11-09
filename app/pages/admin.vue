<script setup lang="ts">
import type { AdminSession, AlertOverview, AlertSettings, Analytics, Measurement } from '~/type/admin'
import { formatDateTime } from '~/utils/formatDateTime'

// Only reachable over the UCSB VPN: nginx and the backend both refuse other addresses.
useHead({
  title: 'Admin',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }]
})

const apiBase = useApiBase()

const session = ref<AdminSession | null>(null)
const accessError = ref('')
const password = ref('')
const loginError = ref('')
const loggingIn = ref(false)

const days = ref(30)
const analytics = ref<Analytics | null>(null)
const analyticsError = ref('')

const alerts = ref<AlertOverview | null>(null)
const alertForm = ref<AlertSettings | null>(null)
const recipientsText = ref('')
const smtpPassword = ref('')
const alertMessage = ref('')
const alertError = ref('')
const savingAlerts = ref(false)
const testingAlerts = ref(false)

const measurement = ref<Measurement | null>(null)
const measurementForm = ref({ exposure: 10000, gain: 50, autoExposure: true })
const measurementMessage = ref('')
const measurementError = ref('')
const savingMeasurement = ref(false)

let refreshTimer: ReturnType<typeof setInterval> | undefined

const errorText = (error: unknown, fallback: string) => {
  const data = (error as { data?: { error?: string, message?: string } })?.data
  return data?.error || data?.message || (error instanceof Error ? error.message : fallback)
}

const statusCode = (error: unknown) => (error as { statusCode?: number, status?: number })?.statusCode
  ?? (error as { status?: number })?.status

/** Admin API call; a 401 means the session ended, so show the login form again. */
async function api<T>(path: string, options: { method?: 'GET' | 'POST' | 'PUT', body?: unknown } = {}): Promise<T> {
  try {
    return await $fetch<T>(`${apiBase}/admin${path}`, {
      method: options.method ?? 'GET',
      body: options.body as Record<string, unknown> | undefined,
      credentials: 'same-origin'
    })
  } catch (error) {
    if (statusCode(error) === 401 && session.value) {
      session.value = { ...session.value, authenticated: false }
    }
    throw error
  }
}

const loadSession = async () => {
  try {
    session.value = await api<AdminSession>('/session')
    accessError.value = ''
  } catch (error) {
    session.value = null
    accessError.value = errorText(error, 'The admin panel is not reachable.')
  }
}

const login = async () => {
  loginError.value = ''
  loggingIn.value = true
  try {
    await api('/login', { method: 'POST', body: { password: password.value } })
    password.value = ''
    await loadSession()
    await loadAll()
  } catch (error) {
    loginError.value = errorText(error, 'Login failed.')
  } finally {
    loggingIn.value = false
  }
}

const logout = async () => {
  try {
    await api('/logout', { method: 'POST', body: {} })
  } finally {
    await loadSession()
  }
}

const loadAnalytics = async () => {
  try {
    analytics.value = await api<Analytics>(`/analytics?days=${days.value}`)
    analyticsError.value = ''
  } catch (error) {
    analyticsError.value = errorText(error, 'Unable to load visitor statistics.')
  }
}

const applyAlerts = (overview: AlertOverview) => {
  alerts.value = overview
  alertForm.value = { ...overview.settings, recipients: [...overview.settings.recipients], muted: [...overview.settings.muted] }
  recipientsText.value = overview.settings.recipients.join('\n')
  smtpPassword.value = ''
}

const loadAlerts = async (resetForm = false) => {
  try {
    const overview = await api<AlertOverview>('/alerts')
    if (resetForm || !alertForm.value) {
      applyAlerts(overview)
    } else {
      alerts.value = overview
    }
  } catch (error) {
    alertError.value = errorText(error, 'Unable to load alert settings.')
  }
}

const alertPayload = (): AlertSettings | null => {
  if (!alertForm.value) return null
  return {
    ...alertForm.value,
    recipients: recipientsText.value.split(/[\s,;]+/).map(item => item.trim()).filter(Boolean),
    password: smtpPassword.value || null
  }
}

const saveAlerts = async () => {
  alertMessage.value = ''
  alertError.value = ''
  savingAlerts.value = true
  try {
    applyAlerts(await api<AlertOverview>('/alerts', { method: 'PUT', body: alertPayload() }))
    alertMessage.value = 'Alert settings saved.'
  } catch (error) {
    alertError.value = errorText(error, 'Unable to save alert settings.')
  } finally {
    savingAlerts.value = false
  }
}

const testAlerts = async () => {
  alertMessage.value = ''
  alertError.value = ''
  testingAlerts.value = true
  try {
    await api('/alerts/test', { method: 'POST', body: alertPayload() })
    alertMessage.value = 'Test email sent. Check the inbox (and spam folder) of every recipient.'
  } catch (error) {
    alertError.value = `Test email failed: ${errorText(error, 'unknown error')}`
  } finally {
    testingAlerts.value = false
    await loadAlerts()
  }
}

const toggleMute = (key: string) => {
  if (!alertForm.value) return
  const muted = new Set(alertForm.value.muted)
  if (muted.has(key)) muted.delete(key)
  else muted.add(key)
  alertForm.value.muted = [...muted]
}

const loadMeasurement = async (resetForm = false) => {
  try {
    measurement.value = await api<Measurement>('/measurement')
    const settings = measurement.value.settings
    if (resetForm && typeof settings.exposure === 'number' && typeof settings.gain === 'number') {
      measurementForm.value = { exposure: settings.exposure, gain: settings.gain, autoExposure: settings.autoExposure === true }
    }
  } catch (error) {
    measurementError.value = errorText(error, 'Unable to load the measurement settings.')
  }
}

const saveMeasurement = async () => {
  measurementMessage.value = ''
  measurementError.value = ''
  savingMeasurement.value = true
  try {
    measurement.value = await api<Measurement>('/measurement', { method: 'PUT', body: measurementForm.value })
    measurementMessage.value = 'Saved. The camera applies it within a few seconds.'
  } catch (error) {
    measurementError.value = errorText(error, 'Unable to save the measurement settings.')
  } finally {
    savingMeasurement.value = false
  }
}

const recommended = () => {
  // 10 ms / gain 50 / automatic: the setting that measured Polaris on 2026-09-24.
  measurementForm.value = { exposure: 10000, gain: 50, autoExposure: true }
}

const loadAll = async () => {
  if (!session.value?.authenticated) return
  await Promise.all([loadAnalytics(), loadAlerts(true), loadMeasurement(true)])
}

watch(days, () => loadAnalytics())

onMounted(async () => {
  await loadSession()
  await loadAll()
  refreshTimer = setInterval(() => {
    if (!session.value?.authenticated) return
    loadAnalytics()
    loadAlerts()
    loadMeasurement()
  }, 60000)
})

onBeforeUnmount(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})

// ------------------------------------------------------------------ presentation

const number = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('en-US') : '--'

const place = (item: { country?: string | null, region?: string | null, city?: string | null }) =>
  [item.city, item.region, item.country].filter(Boolean).join(', ') || 'Unknown'

const networkLabel: Record<string, string> = {
  'ucsb-vpn': 'UCSB VPN',
  'ucsb-campus': 'UCSB campus',
  'external': 'Outside UCSB'
}

const topCities = (cities: Record<string, number>) => Object.entries(cities)
  .sort((a, b) => b[1] - a[1]).slice(0, 3).map(([city]) => city).join(', ')

const shortDate = (iso: string) => {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(Date.UTC(year!, month! - 1, day!)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

// Daily page views: one series, so no legend; the heading names it.
const CHART = { width: 720, height: 200, top: 12, bottom: 24, left: 36, right: 8 }
const hovered = ref<number | null>(null)

const niceCeiling = (value: number) => {
  if (value <= 4) return 4
  const power = 10 ** Math.floor(Math.log10(value))
  const step = [1, 2, 2.5, 5, 10].map(f => f * power).find(candidate => candidate >= value / 4) ?? power * 10
  return Math.ceil(value / step) * step
}

const chart = computed(() => {
  const data = analytics.value?.daily ?? []
  const max = niceCeiling(Math.max(0, ...data.map(d => d.views)))
  const plotWidth = CHART.width - CHART.left - CHART.right
  const plotHeight = CHART.height - CHART.top - CHART.bottom
  const slot = data.length ? plotWidth / data.length : plotWidth
  const barWidth = Math.max(2, Math.min(24, slot - 2))
  const labelEvery = Math.ceil(data.length / 8)
  const bars = data.map((day, index) => {
    const height = max ? (day.views / max) * plotHeight : 0
    const x = CHART.left + index * slot + (slot - barWidth) / 2
    const y = CHART.top + plotHeight - height
    const r = Math.min(4, barWidth / 2, height)
    // Rounded data end, square at the baseline.
    const path = height <= 0
      ? ''
      : `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + barWidth - r}Q${x + barWidth},${y} ${x + barWidth},${y + r}V${y + height}Z`
    return { day, index, path, slotX: CHART.left + index * slot, slot, center: x + barWidth / 2, label: index % labelEvery === 0 || index === data.length - 1 }
  })
  const ticks = [0, max / 2, max].map(value => ({ value, y: CHART.top + plotHeight - (max ? value / max : 0) * plotHeight }))
  return { bars, ticks, baseline: CHART.top + plotHeight }
})

const tooltip = computed(() => {
  if (hovered.value === null) return null
  const bar = chart.value.bars[hovered.value]
  if (!bar) return null
  return { left: `${(bar.center / CHART.width) * 100}%`, day: bar.day }
})

const componentStatusClass = (status: string) => ({
  OK: 'text-emerald-200',
  WARN: 'text-amber-200',
  DOWN: 'text-rose-200',
  INACTIVE: 'text-slate-400',
  UNKNOWN: 'text-slate-300'
}[status] ?? 'text-slate-300')

const seeing = computed(() => measurement.value?.telemetry?.extras?.seeing)
const polaris = computed(() => measurement.value?.telemetry?.extras?.polaris as
  { onSensor?: boolean, offsetX?: number, offsetY?: number } | undefined)
</script>

<template>
  <UContainer class="py-8 lg:py-10">
    <div class="mb-8 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
      <div>
        <p class="astro-eyebrow">
          Administration
        </p>
        <h1 class="mt-2 text-4xl font-black leading-none tracking-normal text-white md:text-6xl">
          Admin panel
        </h1>
        <p
          v-if="session"
          class="mt-3 text-sm text-slate-400"
        >
          Connected from {{ session.clientAddress }}<span v-if="session.network"> · {{ session.network === 'loopback' ? 'this server' : `VPN range ${session.network}` }}</span>
        </p>
      </div>
      <UButton
        v-if="session?.authenticated"
        color="neutral"
        variant="outline"
        icon="i-lucide-log-out"
        @click="logout"
      >
        Log out
      </UButton>
    </div>

    <UAlert
      v-if="accessError"
      color="warning"
      variant="subtle"
      icon="i-lucide-shield-alert"
      title="Admin access requires the UCSB VPN"
      :description="accessError"
    />

    <UCard
      v-else-if="session && !session.authenticated"
      class="astro-panel mx-auto max-w-md"
      :ui="{ body: 'p-5 sm:p-6' }"
    >
      <form
        class="grid gap-4"
        @submit.prevent="login"
      >
        <label class="grid gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
          Admin password
          <input
            v-model="password"
            type="password"
            autocomplete="current-password"
            required
            class="rounded-md border border-white/15 bg-white/5 px-3 py-2 text-base font-normal normal-case tracking-normal text-white outline-none focus:border-sky-300"
          >
        </label>
        <UButton
          type="submit"
          :loading="loggingIn"
          icon="i-lucide-log-in"
          block
        >
          Log in
        </UButton>
        <p
          v-if="session.passwordConfigured === false"
          class="text-sm text-amber-200"
        >
          No admin password is set on the server yet.
        </p>
        <p
          v-if="loginError"
          class="text-sm text-rose-200"
        >
          {{ loginError }}
        </p>
      </form>
    </UCard>

    <div
      v-else-if="session?.authenticated"
      class="grid gap-6"
    >
      <AdminCameraHosts :api="api" />

      <!-- Visitors -->
      <section class="grid gap-4">
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p class="astro-eyebrow">
              Visitors
            </p>
            <h2 class="mt-1 text-2xl font-black text-white">
              Page views
            </h2>
          </div>
          <div class="flex gap-1 rounded-md border border-white/10 p-1">
            <button
              v-for="option in [7, 30, 90]"
              :key="option"
              type="button"
              class="rounded px-3 py-1 text-sm font-bold"
              :class="days === option ? 'bg-sky-300/15 text-sky-100' : 'text-slate-400 hover:text-slate-200'"
              @click="days = option"
            >
              {{ option }} days
            </button>
          </div>
        </div>

        <UAlert
          v-if="analyticsError"
          color="error"
          variant="subtle"
          :title="analyticsError"
        />

        <div
          v-if="analytics"
          class="grid grid-cols-2 gap-3 md:grid-cols-5"
        >
          <div class="astro-panel-strong p-4">
            <div class="text-xs font-bold uppercase tracking-wider text-slate-500">
              Views, {{ days }} days
            </div>
            <div class="mt-1 text-3xl font-black text-white">
              {{ number(analytics.views) }}
            </div>
          </div>
          <div class="astro-panel-strong p-4">
            <div class="text-xs font-bold uppercase tracking-wider text-slate-500">
              Visitors, {{ days }} days
            </div>
            <div class="mt-1 text-3xl font-black text-white">
              {{ number(analytics.visitors) }}
            </div>
          </div>
          <div class="astro-panel-strong p-4">
            <div class="text-xs font-bold uppercase tracking-wider text-slate-500">
              Today
            </div>
            <div class="mt-1 text-3xl font-black text-white">
              {{ number(analytics.todayViews) }}
            </div>
            <div class="text-xs text-slate-400">
              {{ number(analytics.todayVisitors) }} visitors
            </div>
          </div>
          <div class="astro-panel-strong p-4">
            <div class="text-xs font-bold uppercase tracking-wider text-slate-500">
              Watching live now
            </div>
            <div class="mt-1 text-3xl font-black text-white">
              {{ number(analytics.liveViewersNow) }}
            </div>
          </div>
          <div class="astro-panel-strong p-4">
            <div class="text-xs font-bold uppercase tracking-wider text-slate-500">
              Most live viewers
            </div>
            <div class="mt-1 text-3xl font-black text-white">
              {{ number(analytics.peakLiveViewers) }}
            </div>
            <div class="text-xs text-slate-400">
              at once, {{ days }} days
            </div>
          </div>
        </div>

        <UCard
          v-if="analytics"
          class="astro-panel"
          :ui="{ body: 'p-4 sm:p-5' }"
        >
          <h3 class="text-sm font-bold text-slate-200">
            Page views per day <span class="font-normal text-slate-500">({{ analytics.timeZone }})</span>
          </h3>
          <div
            class="relative mt-3"
            @pointerleave="hovered = null"
          >
            <svg
              :viewBox="`0 0 ${CHART.width} ${CHART.height}`"
              class="block h-auto w-full"
              role="img"
              :aria-label="`Page views per day, ${analytics.from} to ${analytics.to}`"
            >
              <g
                v-for="tick in chart.ticks"
                :key="tick.value"
              >
                <line
                  :x1="CHART.left"
                  :x2="CHART.width - CHART.right"
                  :y1="tick.y"
                  :y2="tick.y"
                  stroke="rgb(184 206 233 / 0.12)"
                  stroke-width="1"
                />
                <text
                  :x="CHART.left - 6"
                  :y="tick.y + 4"
                  text-anchor="end"
                  class="fill-slate-500 text-[11px]"
                >{{ number(tick.value) }}</text>
              </g>
              <g
                v-for="bar in chart.bars"
                :key="bar.day.date"
              >
                <path
                  v-if="bar.path"
                  :d="bar.path"
                  :fill="hovered === bar.index ? '#6aa6f0' : '#3987e5'"
                />
                <text
                  v-if="bar.label"
                  :x="bar.center"
                  :y="CHART.height - 6"
                  text-anchor="middle"
                  class="fill-slate-500 text-[11px]"
                >{{ shortDate(bar.day.date) }}</text>
                <rect
                  :x="bar.slotX"
                  :y="CHART.top"
                  :width="bar.slot"
                  :height="chart.baseline - CHART.top"
                  fill="transparent"
                  tabindex="0"
                  :aria-label="`${bar.day.date}: ${bar.day.views} views, ${bar.day.visitors} visitors`"
                  @pointerenter="hovered = bar.index"
                  @focus="hovered = bar.index"
                  @blur="hovered = null"
                />
              </g>
            </svg>
            <div
              v-if="tooltip"
              class="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md border border-white/15 bg-slate-950/95 px-3 py-2 text-xs text-slate-200 shadow-lg"
              :style="{ left: tooltip.left }"
            >
              <div class="font-bold text-white">
                {{ shortDate(tooltip.day.date) }}
              </div>
              <div>{{ number(tooltip.day.views) }} views · {{ number(tooltip.day.visitors) }} visitors</div>
              <div class="text-slate-400">
                Most live viewers: {{ number(tooltip.day.peakLiveViewers) }}
              </div>
            </div>
          </div>
          <details class="mt-3 text-sm text-slate-300">
            <summary class="cursor-pointer text-xs font-bold uppercase tracking-wider text-slate-500">
              Table
            </summary>
            <table class="mt-2 w-full text-left tabular-nums">
              <thead class="text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th class="py-1">
                    Date
                  </th>
                  <th>Views</th>
                  <th>Visitors</th>
                  <th>Most live viewers</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="day in [...analytics.daily].reverse()"
                  :key="day.date"
                  class="border-t border-white/5"
                >
                  <td class="py-1">
                    {{ day.date }}
                  </td>
                  <td>{{ number(day.views) }}</td>
                  <td>{{ number(day.visitors) }}</td>
                  <td>{{ number(day.peakLiveViewers) }}</td>
                </tr>
              </tbody>
            </table>
          </details>
        </UCard>

        <div
          v-if="analytics"
          class="grid gap-4 lg:grid-cols-3"
        >
          <UCard
            class="astro-panel lg:col-span-2"
            :ui="{ body: 'p-4 sm:p-5' }"
          >
            <h3 class="text-sm font-bold text-slate-200">
              Regions visited
            </h3>
            <p
              v-if="!analytics.regions.length"
              class="mt-3 text-sm text-slate-400"
            >
              No visits recorded yet.
            </p>
            <table
              v-else
              class="mt-3 w-full text-left text-sm tabular-nums"
            >
              <thead class="text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th class="py-1">
                    Region
                  </th>
                  <th class="hidden sm:table-cell">
                    Cities
                  </th>
                  <th class="text-right">
                    Visitors
                  </th>
                  <th class="text-right">
                    Views
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="region in analytics.regions.slice(0, 25)"
                  :key="`${region.countryCode}-${region.region}`"
                  class="border-t border-white/5 text-slate-200"
                >
                  <td class="py-1.5">
                    {{ [region.region, region.country].filter(Boolean).join(', ') || 'Unknown' }}
                  </td>
                  <td class="hidden text-slate-400 sm:table-cell">
                    {{ topCities(region.cities) }}
                  </td>
                  <td class="text-right">
                    {{ number(region.visitors) }}
                  </td>
                  <td class="text-right">
                    {{ number(region.views) }}
                  </td>
                </tr>
              </tbody>
            </table>
            <p class="mt-3 text-xs text-slate-500">
              Approximate locations from an offline database<span v-if="analytics.geoDatabase"> ({{ analytics.geoDatabase }})</span>:
              <a
                href="https://db-ip.com"
                class="underline"
                target="_blank"
                rel="noopener"
              >IP Geolocation by DB-IP</a>. Addresses are not stored; a visitor is counted once per day.
            </p>
          </UCard>

          <div class="grid content-start gap-4">
            <UCard
              class="astro-panel"
              :ui="{ body: 'p-4 sm:p-5' }"
            >
              <h3 class="text-sm font-bold text-slate-200">
                Pages
              </h3>
              <ul class="mt-2 grid gap-1 text-sm">
                <li
                  v-for="page in analytics.pages.slice(0, 10)"
                  :key="page.path"
                  class="flex justify-between gap-3 text-slate-300"
                >
                  <span class="truncate">{{ page.path }}</span>
                  <span class="tabular-nums text-slate-400">{{ number(page.views) }}</span>
                </li>
              </ul>
            </UCard>
            <UCard
              class="astro-panel"
              :ui="{ body: 'p-4 sm:p-5' }"
            >
              <h3 class="text-sm font-bold text-slate-200">
                Where visitors come from
              </h3>
              <ul class="mt-2 grid gap-1 text-sm">
                <li
                  v-for="item in analytics.networks"
                  :key="item.network"
                  class="flex justify-between gap-3 text-slate-300"
                >
                  <span>{{ networkLabel[item.network] || item.network }}</span>
                  <span class="tabular-nums text-slate-400">{{ number(item.views) }}</span>
                </li>
                <li
                  v-for="item in analytics.referrers.slice(0, 5)"
                  :key="item.site"
                  class="flex justify-between gap-3 text-slate-400"
                >
                  <span class="truncate">via {{ item.site }}</span>
                  <span class="tabular-nums">{{ number(item.views) }}</span>
                </li>
              </ul>
            </UCard>
          </div>
        </div>

        <details
          v-if="analytics?.recent.length"
          class="astro-panel p-4 text-sm"
        >
          <summary class="cursor-pointer text-xs font-bold uppercase tracking-wider text-slate-500">
            Latest {{ analytics.recent.length }} views
          </summary>
          <ul class="mt-2 grid gap-1 text-slate-300">
            <li
              v-for="view in analytics.recent"
              :key="`${view.ts}-${view.path}`"
              class="flex flex-wrap gap-x-3"
            >
              <span class="tabular-nums text-slate-500">{{ formatDateTime(view.ts) }}</span>
              <span>{{ view.path }}</span>
              <span class="text-slate-400">{{ place(view) }}</span>
            </li>
          </ul>
        </details>
      </section>

      <!-- Alerts -->
      <section class="grid gap-4">
        <div>
          <p class="astro-eyebrow">
            Monitoring
          </p>
          <h2 class="mt-1 text-2xl font-black text-white">
            Email alerts
          </h2>
          <p class="mt-1 max-w-3xl text-sm text-slate-400">
            Sends an email when a camera, the seeing monitor or the server checks on the
            <NuxtLink
              to="/health"
              class="underline"
            >health page</NuxtLink> stay down longer than the delay below, and again when they recover.
            The alerts run on armageddon itself, so they cannot report armageddon going down.
          </p>
        </div>

        <div
          v-if="alertForm && alerts"
          class="grid gap-4 lg:grid-cols-3"
        >
          <UCard
            class="astro-panel lg:col-span-2"
            :ui="{ body: 'p-4 sm:p-5' }"
          >
            <form
              class="grid gap-4 sm:grid-cols-2"
              @submit.prevent="saveAlerts"
            >
              <label class="flex items-center gap-3 text-sm font-bold text-slate-200 sm:col-span-2">
                <input
                  v-model="alertForm.enabled"
                  type="checkbox"
                  class="size-4 accent-sky-300"
                >
                Send alerts
              </label>
              <label class="grid gap-1 text-xs font-bold uppercase tracking-wider text-slate-400 sm:col-span-2">
                Recipients (one per line)
                <textarea
                  v-model="recipientsText"
                  rows="3"
                  class="rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm font-normal normal-case tracking-normal text-white outline-none focus:border-sky-300"
                  placeholder="name@ucsb.edu"
                />
              </label>
              <label class="grid gap-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                Alert after (minutes down)
                <input
                  v-model.number="alertForm.downAfterMinutes"
                  type="number"
                  min="1"
                  max="1440"
                  class="rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm font-normal text-white outline-none focus:border-sky-300"
                >
              </label>
              <label class="grid gap-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                Remind every (hours, 0 = never)
                <input
                  v-model.number="alertForm.repeatHours"
                  type="number"
                  min="0"
                  max="720"
                  class="rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm font-normal text-white outline-none focus:border-sky-300"
                >
              </label>
              <label class="flex items-center gap-3 text-sm text-slate-200 sm:col-span-2">
                <input
                  v-model="alertForm.alertOnWarn"
                  type="checkbox"
                  class="size-4 accent-sky-300"
                >
                Also alert on warnings (for example a night without seeing measurements)
              </label>

              <details class="sm:col-span-2">
                <summary class="cursor-pointer text-xs font-bold uppercase tracking-wider text-slate-500">
                  Mail server · {{ alertForm.smtpHost }}:{{ alertForm.smtpPort }}
                </summary>
                <div class="mt-3 grid gap-4 sm:grid-cols-2">
                  <label class="grid gap-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                    SMTP host
                    <input
                      v-model="alertForm.smtpHost"
                      class="rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm font-normal normal-case text-white outline-none focus:border-sky-300"
                    >
                  </label>
                  <label class="grid gap-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                    Port
                    <input
                      v-model.number="alertForm.smtpPort"
                      type="number"
                      min="1"
                      max="65535"
                      class="rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm font-normal text-white outline-none focus:border-sky-300"
                    >
                  </label>
                  <label class="grid gap-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                    Encryption
                    <select
                      v-model="alertForm.security"
                      class="rounded-md border border-white/15 bg-slate-900 px-3 py-2 text-sm font-normal normal-case text-white outline-none focus:border-sky-300"
                    >
                      <option value="starttls">STARTTLS when offered</option>
                      <option value="starttls-required">STARTTLS required</option>
                      <option value="ssl">SSL/TLS (port 465)</option>
                      <option value="none">None</option>
                    </select>
                  </label>
                  <label class="grid gap-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                    Sender
                    <input
                      v-model="alertForm.from"
                      class="rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm font-normal normal-case text-white outline-none focus:border-sky-300"
                    >
                  </label>
                  <label class="grid gap-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                    Username (blank = no login)
                    <input
                      v-model="alertForm.username"
                      autocomplete="off"
                      class="rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm font-normal normal-case text-white outline-none focus:border-sky-300"
                    >
                  </label>
                  <label class="grid gap-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                    Password {{ alertForm.passwordSet ? '(set; blank keeps it)' : '' }}
                    <input
                      v-model="smtpPassword"
                      type="password"
                      autocomplete="new-password"
                      class="rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm font-normal text-white outline-none focus:border-sky-300"
                    >
                  </label>
                  <p class="text-xs leading-5 text-slate-500 sm:col-span-2">
                    The default is the campus relay smtp.ucsb.edu (port 25, reachable from armageddon).
                    If it refuses to relay, use an account's submission server instead, for example
                    smtp.gmail.com, port 587, STARTTLS required, with an app password.
                  </p>
                </div>
              </details>

              <div class="flex flex-wrap gap-2 sm:col-span-2">
                <UButton
                  type="submit"
                  :loading="savingAlerts"
                  icon="i-lucide-save"
                >
                  Save
                </UButton>
                <UButton
                  color="neutral"
                  variant="outline"
                  :loading="testingAlerts"
                  icon="i-lucide-send"
                  @click="testAlerts"
                >
                  Send test email
                </UButton>
              </div>
              <p
                v-if="alertMessage"
                class="text-sm text-emerald-200 sm:col-span-2"
              >
                {{ alertMessage }}
              </p>
              <p
                v-if="alertError"
                class="text-sm text-rose-200 sm:col-span-2"
              >
                {{ alertError }}
              </p>
            </form>
          </UCard>

          <div class="grid content-start gap-4">
            <UCard
              class="astro-panel"
              :ui="{ body: 'p-4 sm:p-5' }"
            >
              <h3 class="text-sm font-bold text-slate-200">
                Watched components
              </h3>
              <p class="mt-1 text-xs text-slate-500">
                Muted components never send email. Save to apply.
              </p>
              <ul class="mt-3 grid gap-2 text-sm">
                <li
                  v-for="component in alerts.components"
                  :key="component.key"
                  class="flex items-center justify-between gap-3"
                >
                  <span class="min-w-0">
                    <span class="block truncate text-slate-200">{{ component.name }}</span>
                    <span
                      class="text-xs font-bold"
                      :class="componentStatusClass(component.status)"
                    >{{ component.status }}</span>
                    <span class="text-xs text-slate-500"> since {{ formatDateTime(component.since) }}</span>
                  </span>
                  <button
                    type="button"
                    class="shrink-0 rounded border px-2 py-0.5 text-xs font-bold"
                    :class="alertForm.muted.includes(component.key) ? 'border-amber-300/40 text-amber-200' : 'border-white/15 text-slate-400'"
                    @click="toggleMute(component.key)"
                  >
                    {{ alertForm.muted.includes(component.key) ? 'Muted' : 'Mute' }}
                  </button>
                </li>
              </ul>
            </UCard>
            <UCard
              class="astro-panel"
              :ui="{ body: 'p-4 sm:p-5' }"
            >
              <h3 class="text-sm font-bold text-slate-200">
                Sent
              </h3>
              <p
                v-if="!alerts.log.length"
                class="mt-2 text-sm text-slate-400"
              >
                Nothing sent yet.
              </p>
              <ul class="mt-2 grid gap-2 text-xs">
                <li
                  v-for="entry in alerts.log.slice(0, 10)"
                  :key="`${entry.at}-${entry.subject}`"
                >
                  <span :class="entry.ok ? 'text-emerald-200' : 'text-rose-200'">{{ entry.ok ? 'Sent' : 'Failed' }}</span>
                  <span class="text-slate-500"> {{ formatDateTime(entry.at) }}</span>
                  <span class="block text-slate-300">{{ entry.subject }}</span>
                  <span
                    v-if="entry.error"
                    class="block text-rose-200"
                  >{{ entry.error }}</span>
                </li>
              </ul>
            </UCard>
          </div>
        </div>
      </section>

      <!-- Measurement -->
      <section class="grid gap-4">
        <div>
          <p class="astro-eyebrow">
            Seeing monitor
          </p>
          <h2 class="mt-1 text-2xl font-black text-white">
            Measurement camera
          </h2>
          <p class="mt-1 max-w-3xl text-sm text-slate-400">
            Every frame is captured with these settings, and the Polaris measurement runs on them day and night
            whether or not anyone is watching. Visitors can only change how the live video looks.
          </p>
        </div>
        <UCard
          class="astro-panel"
          :ui="{ body: 'p-4 sm:p-5' }"
        >
          <form
            class="grid gap-4 sm:grid-cols-4 sm:items-end"
            @submit.prevent="saveMeasurement"
          >
            <label class="grid gap-1 text-xs font-bold uppercase tracking-wider text-slate-400">
              {{ measurementForm.autoExposure ? 'Maximum exposure (µs)' : 'Exposure (µs)' }}
              <input
                v-model.number="measurementForm.exposure"
                type="number"
                min="100"
                max="10000000"
                class="rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm font-normal text-white outline-none focus:border-sky-300"
              >
            </label>
            <label class="grid gap-1 text-xs font-bold uppercase tracking-wider text-slate-400">
              Gain
              <input
                v-model.number="measurementForm.gain"
                type="number"
                min="1"
                max="100"
                class="rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm font-normal text-white outline-none focus:border-sky-300"
              >
            </label>
            <label class="flex items-center gap-3 text-sm text-slate-200">
              <input
                v-model="measurementForm.autoExposure"
                type="checkbox"
                class="size-4 accent-sky-300"
              >
              Automatic exposure
            </label>
            <div class="flex flex-wrap gap-2">
              <UButton
                type="submit"
                :loading="savingMeasurement"
                icon="i-lucide-save"
              >
                Save
              </UButton>
              <UButton
                color="neutral"
                variant="ghost"
                @click="recommended"
              >
                Recommended
              </UButton>
            </div>
          </form>
          <p class="mt-3 text-xs leading-5 text-slate-500">
            Recommended: automatic, at most 10,000 µs, gain 50. Seeing estimates need exposures of 10 ms or less, and
            about 1 ms is too faint to hold Polaris. Automatic exposure shortens it in daylight and returns to the
            maximum after dark.
          </p>
          <dl
            v-if="measurement"
            class="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4"
          >
            <div>
              <dt class="font-bold uppercase tracking-wider text-slate-500">
                Saved
              </dt>
              <dd class="mt-0.5 text-slate-200">
                {{ measurement.settings.autoExposure ? 'Automatic ≤' : 'Manual' }} {{ number(measurement.settings.exposure) }} µs · gain {{ measurement.settings.gain }}
              </dd>
            </div>
            <div>
              <dt class="font-bold uppercase tracking-wider text-slate-500">
                Camera now
              </dt>
              <dd class="mt-0.5 text-slate-200">
                {{ number(measurement.telemetry?.extras?.exposureUs as number) }} µs · {{ number(measurement.telemetry?.extras?.captureFps as number) }} fps
              </dd>
            </div>
            <div>
              <dt class="font-bold uppercase tracking-wider text-slate-500">
                Measurement
              </dt>
              <dd class="mt-0.5 text-slate-200">
                {{ seeing?.status || '--' }}
              </dd>
            </div>
            <div>
              <dt class="font-bold uppercase tracking-wider text-slate-500">
                Polaris
              </dt>
              <dd class="mt-0.5 text-slate-200">
                {{ polaris ? (polaris.onSensor ? 'on the sensor' : 'off the sensor') : '--' }}<span v-if="polaris && typeof polaris.offsetX === 'number'"> · offset {{ polaris.offsetX?.toFixed(0) }}, {{ polaris.offsetY?.toFixed(0) }} px</span>
              </dd>
            </div>
          </dl>
          <p
            v-if="measurementMessage"
            class="mt-3 text-sm text-emerald-200"
          >
            {{ measurementMessage }}
          </p>
          <p
            v-if="measurementError"
            class="mt-3 text-sm text-rose-200"
          >
            {{ measurementError }}
          </p>
        </UCard>
      </section>
    </div>

    <div
      v-else
      class="py-16 text-center text-slate-400"
    >
      Checking access…
    </div>
  </UContainer>
</template>
