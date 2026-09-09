<script setup lang="ts">
import type { CameraHealth, HealthReport, HealthStatus, HostProbe } from '~/type/health'
import { formatDateTime } from '~/utils/formatDateTime'

useHead({
  title: 'Health'
})

const apiBase = useApiBase()
const REFRESH_MS = 30000

const report = ref<HealthReport | null>(null)
const loading = ref(false)
const errorMessage = ref('')
const fetchedAt = ref<number | null>(null)
const now = ref(Date.now())
let pollTimer: ReturnType<typeof setInterval> | undefined
let clockTimer: ReturnType<typeof setInterval> | undefined

const load = async (refresh = false) => {
  loading.value = true
  try {
    report.value = await $fetch<HealthReport>(`${apiBase}/api/health`, {
      query: refresh ? { refresh: 'true' } : undefined
    })
    errorMessage.value = ''
    fetchedAt.value = Date.now()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to load the health report.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  load()
  pollTimer = setInterval(() => load(), REFRESH_MS)
  clockTimer = setInterval(() => {
    now.value = Date.now()
  }, 1000)
})

onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer)
  if (clockTimer) clearInterval(clockTimer)
})

type StatusStyle = { label: string, dot: string, text: string, border: string, tile: string }

const STATUS_STYLE: Record<HealthStatus, StatusStyle> = {
  OK: {
    label: 'Healthy',
    dot: 'bg-emerald-300 shadow-[0_0_14px_rgb(141_227_200_/_0.85)]',
    text: 'text-emerald-200',
    border: 'border-emerald-300/25',
    tile: 'text-emerald-200'
  },
  WARN: {
    label: 'Warning',
    dot: 'bg-amber-300 shadow-[0_0_14px_rgb(252_211_77_/_0.8)]',
    text: 'text-amber-200',
    border: 'border-amber-300/40',
    tile: 'text-amber-200'
  },
  DOWN: {
    label: 'Down',
    dot: 'bg-rose-400 shadow-[0_0_14px_rgb(251_113_133_/_0.8)]',
    text: 'text-rose-200',
    border: 'border-rose-400/45',
    tile: 'text-rose-200'
  },
  INACTIVE: {
    label: 'Inactive',
    dot: 'bg-slate-500',
    text: 'text-slate-400',
    border: 'border-white/10',
    tile: 'text-slate-400'
  },
  UNKNOWN: {
    label: 'Unknown',
    dot: 'bg-sky-300 shadow-[0_0_14px_rgb(125_211_252_/_0.7)]',
    text: 'text-sky-200',
    border: 'border-sky-300/30',
    tile: 'text-sky-200'
  }
}

const styleFor = (status: HealthStatus | undefined) => STATUS_STYLE[status ?? 'UNKNOWN']

const overallStyle = computed(() => styleFor(report.value?.status))
const overallHeadline = computed(() => {
  if (!report.value) {
    return errorMessage.value ? 'Health report unavailable' : 'Checking every feed'
  }
  switch (report.value.status) {
    case 'OK':
      return 'All monitored feeds are healthy'
    case 'WARN':
      return 'Some feeds need attention'
    case 'DOWN':
      return 'One or more feeds are down'
    default:
      return 'Status unknown'
  }
})

const summaryTiles = computed(() => {
  const summary = report.value?.summary ?? {}
  return (['OK', 'WARN', 'DOWN', 'INACTIVE'] as HealthStatus[]).map(status => ({
    status,
    count: summary[status.toLowerCase()] ?? 0,
    label: STATUS_STYLE[status].label
  }))
})

const secondsSinceFetch = computed(() => fetchedAt.value ? Math.max(0, Math.round((now.value - fetchedAt.value) / 1000)) : null)
const nextRefreshIn = computed(() => secondsSinceFetch.value === null ? null : Math.max(0, Math.round(REFRESH_MS / 1000) - secondsSinceFetch.value))

const formatAge = (seconds: number | null | undefined) => {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return '--'
  const s = Math.max(0, Math.round(seconds))
  if (s < 60) return `${s} s`
  const minutes = Math.floor(s / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return minutes % 60 ? `${hours} h ${minutes % 60} min` : `${hours} h`
  const days = Math.floor(hours / 24)
  return hours % 24 ? `${days} d ${hours % 24} h` : `${days} d`
}

// Ages keep counting between polls: the report's age is measured from when it was generated.
const liveAge = (ageSeconds: number | null | undefined) => {
  if (typeof ageSeconds !== 'number' || !report.value) return null
  const generated = Date.parse(report.value.generatedAt)
  const drift = Number.isFinite(generated) ? (now.value - generated) / 1000 : 0
  return ageSeconds + Math.max(0, drift)
}

const formatNumber = (value: number | null | undefined, digits = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '--'

const formatBytes = (bytes: number | null | undefined) => {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes)) return '--'
  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(1)} TB`
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`
  return `${Math.round(bytes / 1e3)} kB`
}

const formatExposure = (microseconds: number | null | undefined) => {
  if (typeof microseconds !== 'number' || !Number.isFinite(microseconds)) return '--'
  if (microseconds >= 1_000_000) return `${(microseconds / 1_000_000).toFixed(microseconds % 1_000_000 ? 1 : 0)} s`
  if (microseconds >= 1000) return `${(microseconds / 1000).toFixed(microseconds % 1000 ? 1 : 0)} ms`
  return `${microseconds} µs`
}

// Capture scripts store the all-sky exposure in microseconds, as the gallery assumes.
const thumbnailFor = (camera: CameraHealth) =>
  camera.latestFrame?.fileName ? `${apiBase}/api/images/${camera.latestFrame.fileName}.jpg` : null

const hostSummary = (probe: HostProbe | null | undefined) => {
  if (!probe) return 'No host configured'
  if (probe.error) return probe.error
  if (probe.reachable) {
    return typeof probe.latencyMs === 'number' ? `Reachable · ${probe.latencyMs > 0 ? `${probe.latencyMs} ms` : '<1 ms'}` : 'Reachable'
  }
  return 'Unreachable'
}

const hostPorts = (probe: HostProbe | null | undefined) =>
  Object.entries(probe?.tcp ?? {}).map(([port, open]) => ({ port, open }))

const cameraCards = computed(() => report.value?.cameras ?? [])
const seeing = computed(() => report.value?.seeing ?? null)
const server = computed(() => report.value?.server ?? null)

const seeingVideoLabel = computed(() => {
  const s = seeing.value
  if (!s?.live) return 'No stream'
  const size = s.width && s.height ? `${s.width}×${s.height}` : ''
  const fps = typeof s.fps === 'number' ? `${formatNumber(s.fps, 1)} fps` : ''
  const rate = typeof s.averageKbps === 'number'
    ? (s.averageKbps >= 1000 ? `${(s.averageKbps / 1000).toFixed(1)} Mb/s` : `${s.averageKbps} kb/s`)
    : ''
  return [size, fps, rate].filter(Boolean).join(' · ') || 'Live'
})

const telemetryValue = (key: string) => {
  const value = seeing.value?.telemetry?.[key]
  if (value === null || value === undefined || value === '') return null
  return typeof value === 'number' ? formatNumber(value, Number.isInteger(value) ? 0 : 1) : String(value)
}

const gpsLabel = computed(() => telemetryValue('gps') ?? '--')
const captureFpsLabel = computed(() => telemetryValue('captureFps') ?? '--')
const seeingExposureLabel = computed(() => formatExposure(seeing.value?.settings?.exposure))
const seeingGainLabel = computed(() => seeing.value?.settings?.gain ?? '--')

const diskUsedPercent = computed(() => {
  const total = server.value?.diskTotalBytes
  const free = server.value?.diskFreeBytes
  if (!total || typeof free !== 'number') return null
  return Math.min(100, Math.max(0, Math.round((1 - free / total) * 100)))
})

const archiveLastRun = computed(() => {
  const archive = server.value?.archive
  if (!archive) return null
  const job = archive.lastJob as Record<string, unknown> | undefined
  return {
    outcome: typeof job?.message === 'string' ? job.message : (typeof archive.lastOutcome === 'string' ? archive.lastOutcome : '--'),
    state: typeof job?.state === 'string' ? job.state : null,
    failed: typeof job?.failed === 'number' ? job.failed : null,
    at: typeof archive.lastAttemptAt === 'string' ? archive.lastAttemptAt : null,
    next: typeof archive.nextScheduledRun === 'string' ? archive.nextScheduledRun : null,
    enabled: archive.enabled === true
  }
})

const localTime = (value: string | null | undefined) => {
  if (!value) return '--'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
</script>

<template>
  <UContainer class="py-8 lg:py-10">
    <div class="mb-8 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
      <div>
        <p class="astro-eyebrow">
          System status
        </p>
        <h1 class="mt-2 text-4xl font-black leading-none tracking-normal text-white md:text-6xl">
          Health
        </h1>
        <p class="mt-3 max-w-2xl text-base leading-7 text-slate-400">
          Upload freshness, host reachability and stream state for every all-sky camera and the seeing monitor,
          as seen from the backend server.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <span
          v-if="secondsSinceFetch !== null"
          class="text-xs font-semibold text-slate-500"
        >
          Checked {{ formatAge(secondsSinceFetch) }} ago · refreshes in {{ nextRefreshIn }} s
        </span>
        <UButton
          :loading="loading"
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="subtle"
          @click="load(true)"
        >
          Re-check now
        </UButton>
      </div>
    </div>

    <UAlert
      v-if="errorMessage"
      class="mb-6"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="The health report could not be loaded"
      :description="errorMessage"
    />

    <section
      class="astro-panel mb-6 border p-5"
      :class="overallStyle.border"
    >
      <div class="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div class="flex items-center gap-4">
          <span
            class="size-3 shrink-0 rounded-full"
            :class="overallStyle.dot"
          />
          <div>
            <p
              class="text-xs font-black uppercase tracking-wider"
              :class="overallStyle.text"
            >
              {{ report ? overallStyle.label : (errorMessage ? 'Unavailable' : 'Checking') }}
            </p>
            <h2 class="mt-1 text-2xl font-black text-white">
              {{ overallHeadline }}
            </h2>
            <p
              v-if="report"
              class="mt-1 text-xs text-slate-500"
            >
              Report generated {{ localTime(report.generatedAt) }} on {{ server?.hostname || 'the backend' }}.
            </p>
          </div>
        </div>

        <div class="grid grid-cols-4 gap-2 text-center">
          <div
            v-for="tile in summaryTiles"
            :key="tile.status"
            class="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2"
          >
            <div
              class="text-xl font-black tabular-nums"
              :class="STATUS_STYLE[tile.status].tile"
            >
              {{ report ? tile.count : '--' }}
            </div>
            <div class="text-[0.62rem] font-bold uppercase tracking-wider text-slate-500">
              {{ tile.label }}
            </div>
          </div>
        </div>
      </div>
    </section>

    <div
      v-if="!report && !errorMessage"
      class="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
      aria-hidden="true"
    >
      <div
        v-for="n in 5"
        :key="n"
        class="astro-panel h-72 animate-pulse"
      />
    </div>

    <div
      v-else-if="report"
      class="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
    >
      <article
        v-for="camera in cameraCards"
        :key="camera.cameraId"
        class="astro-panel flex flex-col overflow-hidden border"
        :class="styleFor(camera.status).border"
      >
        <div class="relative aspect-[4/3] bg-black">
          <img
            v-if="thumbnailFor(camera)"
            :src="thumbnailFor(camera) ?? undefined"
            :alt="`Latest frame from ${camera.siteName}`"
            loading="lazy"
            decoding="async"
            class="h-full w-full object-cover saturate-125"
            :class="camera.status === 'INACTIVE' ? 'opacity-40 grayscale' : ''"
          >
          <div
            v-else
            class="grid h-full place-items-center text-slate-500"
          >
            <UIcon
              name="i-lucide-image-off"
              class="size-8"
            />
          </div>
          <div class="absolute left-3 top-3 flex items-center gap-2 rounded-md border border-white/10 bg-slate-950/75 px-2 py-1 backdrop-blur">
            <span
              class="size-2 rounded-full"
              :class="styleFor(camera.status).dot"
            />
            <span
              class="text-[0.68rem] font-black uppercase tracking-wider"
              :class="styleFor(camera.status).text"
            >
              {{ styleFor(camera.status).label }}
            </span>
          </div>
          <div
            v-if="camera.latestFrame"
            class="absolute bottom-3 right-3 rounded-md border border-white/10 bg-slate-950/75 px-2 py-1 text-[0.68rem] font-bold text-slate-200 backdrop-blur"
          >
            {{ formatAge(liveAge(camera.lastFrameAgeSeconds)) }} ago
          </div>
        </div>

        <div class="flex flex-1 flex-col gap-4 p-4">
          <div class="min-w-0">
            <h3 class="truncate text-lg font-extrabold text-white">
              {{ camera.siteName }}
            </h3>
            <p class="mt-0.5 truncate font-mono text-[0.7rem] text-slate-500">
              {{ camera.cameraId }}
            </p>
          </div>

          <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
            <div>
              <dt class="font-bold uppercase tracking-wider text-slate-500">
                Last frame
              </dt>
              <dd class="mt-0.5 font-semibold text-slate-200">
                {{ camera.latestFrame ? formatDateTime(camera.latestFrame.timestamp, camera.timeZone) : 'Never' }}
              </dd>
            </div>
            <div>
              <dt class="font-bold uppercase tracking-wider text-slate-500">
                Frames 24 h / 1 h
              </dt>
              <dd class="mt-0.5 font-semibold tabular-nums text-slate-200">
                {{ camera.framesLast24h ?? '--' }} / {{ camera.framesLastHour ?? '--' }}
              </dd>
            </div>
            <div>
              <dt class="font-bold uppercase tracking-wider text-slate-500">
                Exposure · gain
              </dt>
              <dd class="mt-0.5 font-semibold text-slate-200">
                {{ camera.latestFrame ? `${formatExposure(camera.latestFrame.exposure)} · ${camera.latestFrame.gain}` : '--' }}
              </dd>
            </div>
            <div>
              <dt class="font-bold uppercase tracking-wider text-slate-500">
                Temp · humidity
              </dt>
              <dd class="mt-0.5 font-semibold text-slate-200">
                {{ camera.latestFrame ? `${formatNumber(camera.latestFrame.temperature, 1)} °C · ${formatNumber(camera.latestFrame.humidity, 0)} %` : '--' }}
              </dd>
            </div>
            <div class="col-span-2">
              <dt class="font-bold uppercase tracking-wider text-slate-500">
                Host
              </dt>
              <dd class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold text-slate-200">
                <UIcon
                  :name="camera.host ? (camera.host.reachable ? 'i-lucide-wifi' : 'i-lucide-wifi-off') : 'i-lucide-circle-dashed'"
                  class="size-3.5"
                  :class="camera.host ? (camera.host.reachable ? 'text-emerald-200' : 'text-rose-300') : 'text-slate-500'"
                />
                <span
                  v-if="camera.host"
                  class="font-mono text-[0.72rem]"
                >{{ camera.host.host }}<span
                  v-if="camera.host.address && camera.host.address !== camera.host.host"
                  class="text-slate-500"
                > ({{ camera.host.address }})</span></span>
                <span :class="camera.host?.reachable ? 'text-emerald-200' : (camera.host ? 'text-rose-200' : 'text-slate-500')">
                  {{ hostSummary(camera.host) }}
                </span>
                <span
                  v-for="probe in hostPorts(camera.host)"
                  :key="probe.port"
                  class="rounded border px-1.5 py-0.5 font-mono text-[0.65rem]"
                  :class="probe.open ? 'border-emerald-300/30 text-emerald-200' : 'border-white/10 text-slate-500 line-through'"
                >
                  tcp/{{ probe.port }}
                </span>
              </dd>
            </div>
          </dl>

          <ul
            v-if="camera.reasons.length"
            class="grid gap-1.5 text-xs leading-5"
            :class="camera.status === 'INACTIVE' ? 'text-slate-400' : (camera.status === 'DOWN' ? 'text-rose-200' : 'text-amber-200')"
          >
            <li
              v-for="reason in camera.reasons"
              :key="reason"
              class="flex gap-2"
            >
              <UIcon
                :name="camera.status === 'INACTIVE' ? 'i-lucide-circle-minus' : 'i-lucide-triangle-alert'"
                class="mt-0.5 size-3.5 shrink-0"
              />
              <span>{{ reason }}</span>
            </li>
          </ul>

          <p
            v-if="camera.note"
            class="text-xs leading-5 text-slate-500"
          >
            {{ camera.note }}
          </p>

          <div class="mt-auto flex items-center justify-between border-t border-white/10 pt-3 text-xs">
            <span class="font-semibold uppercase tracking-wider text-slate-500">All-sky camera</span>
            <NuxtLink
              v-if="camera.latestFrame"
              :to="`/gallery/${camera.latestFrame.imgId}`"
              class="flex items-center gap-1 font-semibold text-sky-200 no-underline hover:text-sky-100"
            >
              Latest frame
              <UIcon
                name="i-lucide-arrow-up-right"
                class="size-3.5"
              />
            </NuxtLink>
          </div>
        </div>
      </article>

      <article
        v-if="seeing"
        class="astro-panel flex flex-col border"
        :class="styleFor(seeing.status).border"
      >
        <div class="flex flex-1 flex-col gap-4 p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span
                  class="size-2 rounded-full"
                  :class="styleFor(seeing.status).dot"
                />
                <span
                  class="text-[0.68rem] font-black uppercase tracking-wider"
                  :class="styleFor(seeing.status).text"
                >
                  {{ styleFor(seeing.status).label }}
                </span>
              </div>
              <h3 class="mt-2 truncate text-lg font-extrabold text-white">
                {{ seeing.label }}
              </h3>
              <p class="mt-0.5 text-xs text-slate-500">
                {{ seeing.live ? 'Streaming' : (seeing.state || 'offline') }} · {{ seeingVideoLabel }}
              </p>
            </div>
            <UIcon
              name="i-lucide-radio-tower"
              class="size-5 shrink-0 text-sky-200"
            />
          </div>

          <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
            <div>
              <dt class="font-bold uppercase tracking-wider text-slate-500">
                Last video
              </dt>
              <dd class="mt-0.5 font-semibold text-slate-200">
                {{ seeing.live && typeof seeing.lastFragmentAgeMs === 'number' ? `${formatAge(liveAge(seeing.lastFragmentAgeMs / 1000))} ago` : '--' }}
              </dd>
            </div>
            <div>
              <dt class="font-bold uppercase tracking-wider text-slate-500">
                Telemetry
              </dt>
              <dd class="mt-0.5 font-semibold text-slate-200">
                {{ typeof seeing.telemetryAgeSeconds === 'number' ? `${formatAge(liveAge(seeing.telemetryAgeSeconds))} ago` : '--' }}
              </dd>
            </div>
            <div>
              <dt class="font-bold uppercase tracking-wider text-slate-500">
                Exposure · gain
              </dt>
              <dd class="mt-0.5 font-semibold text-slate-200">
                {{ seeingExposureLabel }} · {{ seeingGainLabel }}
              </dd>
            </div>
            <div>
              <dt class="font-bold uppercase tracking-wider text-slate-500">
                Capture rate
              </dt>
              <dd class="mt-0.5 font-semibold text-slate-200">
                {{ captureFpsLabel }} fps
              </dd>
            </div>
            <div>
              <dt class="font-bold uppercase tracking-wider text-slate-500">
                Star tracking
              </dt>
              <dd class="mt-0.5 font-semibold text-slate-200">
                {{ seeing.position || '--' }}
              </dd>
            </div>
            <div>
              <dt class="font-bold uppercase tracking-wider text-slate-500">
                Viewers
              </dt>
              <dd class="mt-0.5 font-semibold tabular-nums text-slate-200">
                {{ seeing.viewers ?? 0 }}
              </dd>
            </div>
            <div class="col-span-2">
              <dt class="font-bold uppercase tracking-wider text-slate-500">
                GPS
              </dt>
              <dd class="mt-0.5 font-semibold text-slate-200">
                {{ gpsLabel }}
              </dd>
            </div>
            <div class="col-span-2">
              <dt class="font-bold uppercase tracking-wider text-slate-500">
                Host
              </dt>
              <dd class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold text-slate-200">
                <UIcon
                  :name="seeing.host ? (seeing.host.reachable ? 'i-lucide-wifi' : 'i-lucide-wifi-off') : 'i-lucide-circle-dashed'"
                  class="size-3.5"
                  :class="seeing.host ? (seeing.host.reachable ? 'text-emerald-200' : 'text-rose-300') : 'text-slate-500'"
                />
                <span
                  v-if="seeing.host"
                  class="font-mono text-[0.72rem]"
                >{{ seeing.host.host }}<span
                  v-if="seeing.host.address && seeing.host.address !== seeing.host.host"
                  class="text-slate-500"
                > ({{ seeing.host.address }})</span></span>
                <span :class="seeing.host?.reachable ? 'text-emerald-200' : (seeing.host ? 'text-rose-200' : 'text-slate-500')">
                  {{ hostSummary(seeing.host) }}
                </span>
                <span
                  v-for="probe in hostPorts(seeing.host)"
                  :key="probe.port"
                  class="rounded border px-1.5 py-0.5 font-mono text-[0.65rem]"
                  :class="probe.open ? 'border-emerald-300/30 text-emerald-200' : 'border-white/10 text-slate-500 line-through'"
                >
                  tcp/{{ probe.port }}
                </span>
              </dd>
            </div>
            <div
              v-if="seeing.live"
              class="col-span-2"
            >
              <dt class="font-bold uppercase tracking-wider text-slate-500">
                Producer
              </dt>
              <dd class="mt-0.5 font-semibold text-slate-200">
                {{ seeing.remoteAddress || '--' }} · session since {{ localTime(seeing.startedAt) }}
              </dd>
            </div>
            <div
              v-else-if="seeing.lastSessionEndedAt"
              class="col-span-2"
            >
              <dt class="font-bold uppercase tracking-wider text-slate-500">
                Last session
              </dt>
              <dd class="mt-0.5 font-semibold text-slate-200">
                Ended {{ localTime(seeing.lastSessionEndedAt) }}<span v-if="seeing.lastSessionEndReason"> · {{ seeing.lastSessionEndReason }}</span>
              </dd>
            </div>
          </dl>

          <ul
            v-if="seeing.reasons.length"
            class="grid gap-1.5 text-xs leading-5"
            :class="seeing.status === 'DOWN' ? 'text-rose-200' : 'text-amber-200'"
          >
            <li
              v-for="reason in seeing.reasons"
              :key="reason"
              class="flex gap-2"
            >
              <UIcon
                name="i-lucide-triangle-alert"
                class="mt-0.5 size-3.5 shrink-0"
              />
              <span>{{ reason }}</span>
            </li>
          </ul>

          <p
            v-if="seeing.note"
            class="text-xs leading-5 text-slate-500"
          >
            {{ seeing.note }}
          </p>

          <div class="mt-auto flex items-center justify-between border-t border-white/10 pt-3 text-xs">
            <span class="font-semibold uppercase tracking-wider text-slate-500">Seeing camera</span>
            <NuxtLink
              to="/seeing-monitor"
              class="flex items-center gap-1 font-semibold text-sky-200 no-underline hover:text-sky-100"
            >
              Open monitor
              <UIcon
                name="i-lucide-arrow-up-right"
                class="size-3.5"
              />
            </NuxtLink>
          </div>
        </div>
      </article>

      <article
        v-if="server"
        class="astro-panel flex flex-col border"
        :class="styleFor(server.status).border"
      >
        <div class="flex flex-1 flex-col gap-4 p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span
                  class="size-2 rounded-full"
                  :class="styleFor(server.status).dot"
                />
                <span
                  class="text-[0.68rem] font-black uppercase tracking-wider"
                  :class="styleFor(server.status).text"
                >
                  {{ styleFor(server.status).label }}
                </span>
              </div>
              <h3 class="mt-2 truncate text-lg font-extrabold text-white">
                Backend server
              </h3>
              <p class="mt-0.5 truncate font-mono text-[0.7rem] text-slate-500">
                {{ server.hostname || '--' }}
              </p>
            </div>
            <UIcon
              name="i-lucide-server"
              class="size-5 shrink-0 text-sky-200"
            />
          </div>

          <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
            <div>
              <dt class="font-bold uppercase tracking-wider text-slate-500">
                Backend up
              </dt>
              <dd class="mt-0.5 font-semibold text-slate-200">
                {{ formatAge(liveAge(server.uptimeSeconds)) }}
              </dd>
            </div>
            <div>
              <dt class="font-bold uppercase tracking-wider text-slate-500">
                Database
              </dt>
              <dd
                class="mt-0.5 font-semibold"
                :class="server.databaseOk ? 'text-emerald-200' : 'text-rose-200'"
              >
                {{ server.databaseOk ? 'Answering' : 'Failing' }}
              </dd>
            </div>
            <div class="col-span-2">
              <dt class="font-bold uppercase tracking-wider text-slate-500">
                Image disk
              </dt>
              <dd class="mt-1">
                <div class="flex items-center justify-between font-semibold text-slate-200">
                  <span>{{ formatBytes(server.diskFreeBytes) }} free of {{ formatBytes(server.diskTotalBytes) }}</span>
                  <span class="tabular-nums text-slate-400">{{ diskUsedPercent ?? '--' }}% used</span>
                </div>
                <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    class="h-full rounded-full"
                    :class="(diskUsedPercent ?? 0) > 90 ? 'bg-rose-400' : ((diskUsedPercent ?? 0) > 75 ? 'bg-amber-300' : 'bg-sky-300')"
                    :style="{ width: `${diskUsedPercent ?? 0}%` }"
                  />
                </div>
                <div class="mt-1 truncate font-mono text-[0.68rem] text-slate-500">
                  {{ server.imagesDir }}
                </div>
              </dd>
            </div>
            <div
              v-if="archiveLastRun"
              class="col-span-2"
            >
              <dt class="font-bold uppercase tracking-wider text-slate-500">
                FITS archive job
              </dt>
              <dd class="mt-0.5 font-semibold text-slate-200">
                <span :class="archiveLastRun.failed ? 'text-amber-200' : ''">{{ archiveLastRun.outcome }}</span>
                <span
                  v-if="archiveLastRun.at"
                  class="text-slate-500"
                > · ran {{ localTime(archiveLastRun.at) }}</span>
                <span
                  v-if="archiveLastRun.enabled && archiveLastRun.next"
                  class="text-slate-500"
                > · next {{ localTime(archiveLastRun.next) }}</span>
              </dd>
            </div>
            <div>
              <dt class="font-bold uppercase tracking-wider text-slate-500">
                Live viewers
              </dt>
              <dd class="mt-0.5 font-semibold tabular-nums text-slate-200">
                {{ server.liveViewers ?? 0 }}
              </dd>
            </div>
            <div>
              <dt class="font-bold uppercase tracking-wider text-slate-500">
                Started
              </dt>
              <dd class="mt-0.5 font-semibold text-slate-200">
                {{ localTime(server.startedAt) }}
              </dd>
            </div>
          </dl>

          <ul
            v-if="server.reasons.length"
            class="grid gap-1.5 text-xs leading-5"
            :class="server.status === 'DOWN' ? 'text-rose-200' : 'text-amber-200'"
          >
            <li
              v-for="reason in server.reasons"
              :key="reason"
              class="flex gap-2"
            >
              <UIcon
                name="i-lucide-triangle-alert"
                class="mt-0.5 size-3.5 shrink-0"
              />
              <span>{{ reason }}</span>
            </li>
          </ul>

          <div class="mt-auto flex items-center justify-between border-t border-white/10 pt-3 text-xs">
            <span class="font-semibold uppercase tracking-wider text-slate-500">Backend</span>
            <span class="text-slate-500">Report cached {{ report.cacheSeconds }} s</span>
          </div>
        </div>
      </article>
    </div>
  </UContainer>
</template>
