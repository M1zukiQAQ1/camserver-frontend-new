<script setup lang="ts">
import type { SeeingTelemetry, SeeingHistoryPoint, SeeingHistoryResponse } from '~/type/liveStream'

const props = defineProps<{ measurement?: SeeingTelemetry, fresh: boolean, reportAgeSeconds: number }>()
const metric = ref<'jitterRmsPx' | 'jitterArcsec' | 'seeingArcsec' | 'fluxVariationPercent' | 'driftPxPerMinute' | 'fwhmPx'>('jitterArcsec')
const data = computed(() => props.measurement?.version === 1 ? props.measurement : undefined)
const current = computed(() => props.fresh && typeof data.value?.sampleAgeSeconds === 'number'
  && data.value.sampleAgeSeconds + props.reportAgeSeconds <= 3 && data.value.status !== 'stale'
  ? data.value
  : undefined)
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const format = (value: unknown, digits = 2) => finite(value) ? value.toFixed(digits) : '—'
const stateLabels: Record<string, string> = {
  searching: 'Searching for a star',
  saturated: 'Star saturated',
  overexposed: 'Image overexposed',
  low_signal: 'Insufficient star signal',
  collecting: 'Collecting samples',
  relative: 'Relative measurements',
  estimated: 'Seeing estimate available',
  below_noise_floor: 'Below calibrated noise floor'
}
const stateLabel = computed(() => !data.value
  ? 'Waiting for measurement service'
  : !current.value
      ? 'Measurements unavailable · stale data'
      : stateLabels[current.value.status] ?? 'Waiting for measurements')
const explanations: Record<string, string> = {
  simulated: 'Synthetic camera data; atmospheric seeing is unavailable.',
  target_unconfirmed: 'Select an identified Polaris region before estimating seeing.',
  calibration_required: 'Lens scale, aperture, star altitude and centroid noise calibration are required for arcseconds.',
  noise_calibration_mismatch: 'Exposure or gain differs from the centroid noise calibration.',
  noise_signal_mismatch: 'Star brightness or background noise differs from the centroid noise calibration.',
  below_horizon: 'Polaris is below the horizon at the configured site.',
  long_exposure: 'Use an exposure of 10,000 µs or less to reduce averaging of atmospheric motion.'
}
const blockers = computed(() => (current.value?.blockers ?? []).map((key) => {
  if (key === 'calibration_required' && current.value?.calibration) {
    const calibration = current.value.calibration
    const missing = []
    if (!finite(calibration.plate_scale_arcsec_px)) missing.push('image scale')
    if (!finite(calibration.aperture_mm)) missing.push('lens clear aperture')
    if (!finite(current.value.altitudeDeg)) missing.push('star altitude')
    if (!finite(calibration.centroid_noise_px) || !finite(calibration.noise_flux)
      || !finite(calibration.noise_background_rms)) missing.push('measured centroid-noise reference')
    return `Seeing estimate still needs: ${missing.join(', ')}.`
  }
  return explanations[key] ?? key
}))
const seriesLabel = computed(() => ({
  jitterRmsPx: 'Drift-corrected motion · pixels RMS',
  jitterArcsec: 'Angular image motion · arcseconds RMS',
  seeingArcsec: 'Estimated zenith seeing · arcseconds',
  fluxVariationPercent: 'Brightness fluctuation · % RMS',
  driftPxPerMinute: 'Slow drift · pixels per minute',
  fwhmPx: 'Observed star width · pixels FWHM'
})[metric.value])
const range = ref('1h')
const localInput = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
const customStart = ref('')
const customEnd = ref('')
const response = ref<SeeingHistoryResponse>()
const loading = ref(false)
const historyError = ref('')
const timezone = ref('local time')
let requestSequence = 0
let refreshTimer: ReturnType<typeof setInterval> | undefined
let controller: AbortController | undefined
const history = computed(() => response.value?.points.filter(point => finite(point.timestamp)) ?? [])
const exportUrl = computed(() => response.value
  ? `/api/live/seeing/history.csv?${new URLSearchParams({ start: response.value.start, end: response.value.end })}`
  : undefined)
async function loadHistory() {
  const sequence = ++requestSequence
  controller?.abort()
  controller = new AbortController()
  historyError.value = ''
  const end = range.value === 'custom' ? new Date(customEnd.value) : new Date()
  const hours: Record<string, number> = { '1h': 1, '6h': 6, '24h': 24, '7d': 168, '30d': 720 }
  const start = range.value === 'custom' ? new Date(customStart.value) : new Date(end.getTime() - (hours[range.value] ?? 1) * 3600000)
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end
    || end.getTime() - start.getTime() > 366 * 86400000 || start.getUTCFullYear() < 2020) {
    response.value = undefined
    loading.value = false
    historyError.value = 'Choose a start before the end, from 2020 onward, spanning at most 366 days.'
    return
  }
  loading.value = true
  try {
    const result = await $fetch<SeeingHistoryResponse>('/api/live/seeing/history', {
      query: { start: start.toISOString(), end: end.toISOString(), maxPoints: 1200 },
      signal: controller.signal, timeout: 15000, retry: 0
    })
    if (sequence === requestSequence) response.value = result
  } catch {
    if (sequence === requestSequence) {
      response.value = undefined
      historyError.value = 'Saved measurements could not be loaded. Try again.'
    }
  } finally {
    if (sequence === requestSequence) loading.value = false
  }
}
watch(range, () => {
  if (range.value !== 'custom') void loadHistory()
})
onMounted(() => {
  timezone.value = Intl.DateTimeFormat().resolvedOptions().timeZone
  customStart.value = localInput(new Date(Date.now() - 3600000))
  customEnd.value = localInput(new Date())
  void loadHistory()
  refreshTimer = setInterval(() => {
    if (range.value !== 'custom' && !loading.value) void loadHistory()
  }, 30000)
})
onBeforeUnmount(() => {
  clearInterval(refreshTimer)
  requestSequence++
  controller?.abort()
})
const chart = computed(() => {
  const points = history.value
  const times = points.map(p => p.timestamp as number)
  const start = response.value ? Date.parse(response.value.start) / 1000 : Math.min(...times)
  const end = response.value ? Date.parse(response.value.end) / 1000 : Math.max(...times)
  const max = Math.max(0.01, ...points.map(p => finite(p[metric.value]) ? p[metric.value] as number : 0)) * 1.15
  const paths: string[] = []
  const dots: { x: number, y: number, label: string }[] = []
  let path = ''
  let previous: SeeingHistoryPoint | undefined
  for (const point of points) {
    const value = point[metric.value]
    const ready = ['relative', 'estimated', 'below_noise_floor'].includes(point.status)
    if (!ready || !finite(value)) {
      if (path) paths.push(path)
      path = ''
      previous = undefined
      continue
    }
    const x = 48 + ((point.timestamp as number) - start) / Math.max(30, end - start) * 634
    const y = 162 - value / max * 140
    if (previous && (!point.connectFromPrevious)) {
      if (path) paths.push(path)
      path = ''
    }
    path += `${path ? ' L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`
    dots.push({ x, y, label: `${new Date((point.timestamp as number) * 1000).toLocaleString()}: ${value.toFixed(3)}` })
    previous = point
  }
  if (path) paths.push(path)
  return { paths, dots, max, start, end }
})
const timeLabel = (epoch: number) => finite(epoch)
  ? new Date(epoch * 1000).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—'
</script>

<template>
  <section
    class="mt-5 border-t border-white/10 px-1 pt-5"
    aria-labelledby="conditions-heading"
  >
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p class="astro-eyebrow">
          Atmospheric monitoring
        </p>
        <h2
          id="conditions-heading"
          class="mt-1 text-xl font-black text-white"
        >
          Polaris image motion
        </h2>
        <p
          class="mt-1 text-xs text-slate-400"
          role="status"
        >
          {{ stateLabel }}
        </p>
      </div>
      <UButton
        icon="i-lucide-download"
        color="neutral"
        variant="subtle"
        :disabled="!response?.totalRecords || loading"
        :href="exportUrl"
        external
        download="seeing-history.csv"
      >
        Export measurements
      </UButton>
    </div>

    <dl class="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div class="rounded-lg bg-sky-200/5 p-3">
        <dt class="text-xs text-slate-400">
          Motion after drift removal
        </dt>
        <dd class="mt-2 text-2xl font-bold text-sky-200">
          {{ format(current?.jitterArcsec, 3) }} <span class="text-xs">arcsec RMS</span>
          <span class="mt-1 block text-xs font-normal text-slate-400">{{ format(current?.jitterRmsPx, 3) }} px RMS</span>
        </dd>
      </div>
      <div class="rounded-lg bg-sky-200/5 p-3">
        <dt class="text-xs text-slate-400">
          Estimated zenith seeing
        </dt>
        <dd class="mt-2 text-2xl font-bold text-emerald-200">
          {{ format(current?.seeingArcsec) }} <span class="text-xs">arcsec</span>
        </dd>
      </div>
      <div class="rounded-lg bg-sky-200/5 p-3">
        <dt class="text-xs text-slate-400">
          Brightness fluctuation
        </dt>
        <dd class="mt-2 text-2xl font-bold text-sky-200">
          {{ format(current?.fluxVariationPercent, 1) }} <span class="text-xs">% RMS</span>
        </dd>
      </div>
      <div class="rounded-lg bg-sky-200/5 p-3">
        <dt class="text-xs text-slate-400">
          Slow drift
        </dt>
        <dd class="mt-2 text-2xl font-bold text-sky-200">
          {{ format(current?.driftPxPerMinute) }} <span class="text-xs">px/min</span>
        </dd>
      </div>
    </dl>
    <p
      v-if="current"
      class="mt-3 text-xs leading-5 text-slate-400"
    >
      {{ current.samples }} samples over {{ format(current.durationSeconds, 1) }} s · rolling {{ current.windowSeconds }} s window.
      {{ current.target === 'polaris_roi' ? 'Identified Polaris region.' : 'Tracking an unconfirmed star.' }}
      <span v-if="current.status === 'collecting'">Estimate needs {{ current.requiredSamples }} samples and {{ current.requiredDurationSeconds }} s.</span>
    </p>
    <p
      v-if="current?.plateScaleArcsecPx"
      class="mt-2 text-xs text-slate-400"
    >
      Calibrated scale: {{ format(current.plateScaleArcsecPx, 3) }} arcsec/px · Polaris altitude: {{ format(current.altitudeDeg, 2) }}°.
      Angular motion includes sensor noise and vibration. It is separate from the atmospheric seeing estimate.
    </p>
    <p
      v-if="current?.historyStorageError"
      role="alert"
      class="mt-2 text-xs text-amber-200"
    >
      Camera history storage needs attention; some records may not be saved.
    </p>
    <ul
      v-if="blockers.length"
      class="mt-3 list-disc space-y-1 pl-5 text-xs leading-5 text-amber-200"
    >
      <li
        v-for="reason in blockers"
        :key="reason"
      >
        {{ reason }}
      </li>
    </ul>

    <div class="mt-5 rounded-lg border border-white/10 p-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <label
          for="seeing-metric"
          class="text-xs font-semibold text-slate-300"
        >Saved measurement history</label>
        <select
          id="seeing-metric"
          v-model="metric"
          class="max-w-full rounded border border-white/15 bg-slate-900 px-2 py-1 text-xs text-slate-200"
        >
          <option value="jitterRmsPx">
            Motion · px RMS
          </option>
          <option value="jitterArcsec">
            Angular motion · arcsec RMS
          </option>
          <option value="seeingArcsec">
            Seeing estimate · arcsec
          </option>
          <option value="fluxVariationPercent">
            Brightness fluctuation · %
          </option>
          <option value="driftPxPerMinute">
            Slow drift · px/min
          </option>
          <option value="fwhmPx">
            Observed star width · px
          </option>
        </select>
      </div>
      <form
        class="mt-3 flex flex-wrap items-end gap-3"
        @submit.prevent="loadHistory"
      >
        <label class="text-xs text-slate-400">
          Time period
          <select
            v-model="range"
            class="mt-1 block rounded border border-white/15 bg-slate-900 p-2 text-slate-200"
          >
            <option value="1h">Last hour</option>
            <option value="6h">Last 6 hours</option>
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="custom">Custom period</option>
          </select>
        </label>
        <template v-if="range === 'custom'">
          <label class="text-xs text-slate-400">
            Start
            <input
              v-model="customStart"
              type="datetime-local"
              required
              class="mt-1 block rounded border border-white/15 bg-slate-900 p-2 text-slate-200 [color-scheme:dark]"
            >
          </label>
          <label class="text-xs text-slate-400">
            End
            <input
              v-model="customEnd"
              type="datetime-local"
              required
              class="mt-1 block rounded border border-white/15 bg-slate-900 p-2 text-slate-200 [color-scheme:dark]"
            >
          </label>
        </template>
        <UButton
          type="submit"
          color="neutral"
          variant="subtle"
          :loading="loading"
        >
          {{ range === 'custom' ? 'Apply period' : 'Refresh' }}
        </UButton>
      </form>
      <p class="mt-2 text-xs text-slate-500">
        Times in {{ timezone }}. Custom periods can span up to 366 days.
      </p>
      <p
        v-if="historyError"
        role="alert"
        class="mt-3 text-sm text-amber-200"
      >
        {{ historyError }}
      </p>
      <p
        v-else-if="loading"
        role="status"
        class="mt-3 text-xs text-slate-400"
      >
        Loading saved measurements…
      </p>
      <svg
        v-if="chart.dots.length"
        viewBox="0 0 700 192"
        class="mt-3 w-full"
        role="img"
        :aria-label="seriesLabel"
      >
        <title>{{ seriesLabel }}</title>
        <path
          d="M48,22 V162 H682"
          fill="none"
          stroke="#475569"
        />
        <path
          d="M48,92 H682 M48,22 H682"
          fill="none"
          stroke="#334155"
          stroke-dasharray="4 4"
        />
        <text
          x="40"
          y="26"
          text-anchor="end"
          fill="#94a3b8"
          font-size="11"
        >{{ format(chart.max) }}</text>
        <text
          x="40"
          y="166"
          text-anchor="end"
          fill="#94a3b8"
          font-size="11"
        >0</text>
        <path
          v-for="(path, index) in chart.paths"
          :key="index"
          :d="path"
          fill="none"
          stroke="#7dd3fc"
          stroke-width="2"
        />
        <circle
          v-for="(point, index) in chart.dots"
          :key="index"
          :cx="point.x"
          :cy="point.y"
          r="2.5"
          fill="#7dd3fc"
        >
          <title>{{ point.label }}</title>
        </circle>
        <text
          x="48"
          y="185"
          fill="#94a3b8"
          font-size="11"
        >{{ timeLabel(chart.start) }}</text>
        <text
          x="682"
          y="185"
          text-anchor="end"
          fill="#94a3b8"
          font-size="11"
        >{{ timeLabel(chart.end) }}</text>
      </svg>
      <p
        v-else
        class="py-8 text-center text-sm text-slate-500"
      >
        No completed measurements for this metric in the selected period.
      </p>
      <p class="mt-2 text-xs leading-5 text-slate-500">
        Measurements are saved every 30 seconds and survive service restarts.
        <template v-if="response">
          {{ response.totalRecords.toLocaleString() }} saved records in this period. Graph: {{ response.bucketSeconds }}-second averages.
        </template>
        Gaps mark unavailable data, restarts or changed settings; mixed or incomplete intervals are left blank. Export downloads the original records for the applied period.
      </p>
    </div>
    <p class="mt-3 text-xs leading-5 text-slate-500">
      Rapid star motion can indicate atmospheric turbulence. Mount vibration, focus and sensor noise also affect it.
      Seeing is a single-star model estimate at 500 nm; brightness fluctuation also includes clouds and measurement noise.
    </p>
  </section>
</template>
