<script setup lang="ts">
import type { CameraSettings, LiveStatus } from '~/type/liveStream'

useHead({
  title: 'Seeing Monitor'
})

const apiBase = useApiBase()

const streamUrl = `${apiBase}/api/live/stream.mp4`
const polarisDataUrl = `${apiBase}/api/images/PolarisData.csv`

const {
  video,
  state: playerState,
  message: playerMessage,
  codecs,
  bytesReceived,
  playerLagSeconds,
  retryInSeconds,
  restart
} = useLiveVideo(streamUrl)

const status = ref<LiveStatus | null>(null)
const statusError = ref(false)
const exposure = ref<number | undefined>()
const gain = ref<number | undefined>()
const settingsDirty = ref(false)
const statusMessage = ref('')
const errorMessage = ref('')
const isSaving = ref(false)
let statusTimer: ReturnType<typeof setInterval> | undefined

const applySettings = (settings?: CameraSettings) => {
  if (!settings || settingsDirty.value) {
    return
  }
  exposure.value = settings.exposure
  gain.value = settings.gain
}

const pollStatus = async () => {
  try {
    const next = await $fetch<LiveStatus>(`${apiBase}/api/live/status`)
    status.value = next
    statusError.value = false
    applySettings(next.settings)
  } catch {
    statusError.value = true
  }
}

const isLive = computed(() => status.value?.live === true)
const telemetry = computed(() => status.value?.telemetry)
const telemetryFresh = computed(() => {
  const age = telemetry.value?.ageSeconds
  return typeof age === 'number' && age < 15
})

const badge = computed(() => {
  switch (playerState.value) {
    case 'playing':
      return { label: 'Live', dot: 'bg-emerald-300 shadow-[0_0_18px_rgb(141_227_200_/_0.9)]', text: 'text-emerald-200' }
    case 'buffering':
      return { label: 'Buffering', dot: 'bg-sky-300 shadow-[0_0_18px_rgb(125_211_252_/_0.8)]', text: 'text-sky-200' }
    case 'connecting':
      return { label: 'Connecting', dot: 'bg-sky-300 shadow-[0_0_18px_rgb(125_211_252_/_0.8)]', text: 'text-sky-200' }
    case 'paused':
      return { label: 'Paused', dot: 'bg-slate-400', text: 'text-slate-300' }
    case 'unsupported':
    case 'error':
      return { label: 'Error', dot: 'bg-rose-400 shadow-[0_0_18px_rgb(251_113_133_/_0.7)]', text: 'text-rose-200' }
    default:
      return { label: 'Offline', dot: 'bg-amber-300 shadow-[0_0_18px_rgb(252_211_77_/_0.7)]', text: 'text-amber-200' }
  }
})

const overlayVisible = computed(() => playerState.value !== 'playing')
const overlayTitle = computed(() => {
  switch (playerState.value) {
    case 'connecting':
      return 'Connecting to the camera'
    case 'buffering':
      return 'Buffering video'
    case 'paused':
      return 'Stream paused'
    case 'unsupported':
      return 'Playback not supported'
    case 'error':
      return 'Stream interrupted'
    case 'offline':
      return isLive.value ? 'Reconnecting' : 'Camera offline'
    default:
      return 'Starting player'
  }
})
const overlayText = computed(() => {
  if (playerMessage.value) {
    return playerMessage.value
  }
  if (playerState.value === 'offline' && status.value?.lastSessionEndReason) {
    return `Last session ended: ${status.value.lastSessionEndReason}.`
  }
  return ''
})

const formatNumber = (value: number | null | undefined, digits = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '--'

const latencyLabel = computed(() =>
  telemetryFresh.value ? formatNumber(telemetry.value?.latencyMs) : '--')
const exposureLabel = computed(() => exposure.value ?? '--')
const gainLabel = computed(() => gain.value ?? '--')
const resolutionLabel = computed(() =>
  isLive.value && status.value?.width && status.value?.height
    ? `${status.value.width}×${status.value.height}`
    : '--')
const fpsLabel = computed(() => isLive.value ? formatNumber(status.value?.fps, 1) : '--')
const bitrateLabel = computed(() => {
  if (!isLive.value || !status.value?.averageKbps) {
    return '--'
  }
  const kbps = status.value.averageKbps
  return kbps >= 1000 ? `${(kbps / 1000).toFixed(1)} Mb/s` : `${kbps} kb/s`
})
const lagLabel = computed(() =>
  playerState.value === 'playing' ? `${formatNumber(playerLagSeconds.value, 1)} s` : '--')
const receivedLabel = computed(() => {
  const bytes = bytesReceived.value
  if (bytes >= 1_000_000) {
    return `${(bytes / 1_000_000).toFixed(1)} MB`
  }
  return `${Math.round(bytes / 1000)} kB`
})
const positionLabel = computed(() =>
  telemetryFresh.value && telemetry.value?.pos ? telemetry.value.pos : '--')
const extras = computed(() => {
  const source = telemetry.value?.extras ?? {}
  return Object.entries(source)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => ({ key, value: typeof value === 'number' ? formatNumber(value, Number.isInteger(value) ? 0 : 2) : String(value) }))
})

const markDirty = () => {
  settingsDirty.value = true
}

const saveSettings = async () => {
  errorMessage.value = ''
  statusMessage.value = ''
  const nextExposure = exposure.value
  const nextGain = gain.value

  if (typeof nextExposure !== 'number'
    || !Number.isInteger(nextExposure)
    || nextExposure < 100
    || nextExposure > 10000000) {
    errorMessage.value = 'Exposure must be an integer between 100 and 10,000,000.'
    return
  }

  if (typeof nextGain !== 'number'
    || !Number.isInteger(nextGain)
    || nextGain < 1
    || nextGain > 100) {
    errorMessage.value = 'Gain must be an integer between 1 and 100.'
    return
  }

  isSaving.value = true

  try {
    const formData = new FormData()
    formData.append('exposure', String(nextExposure))
    formData.append('gain', String(nextGain))

    const response = await $fetch<{ ok?: boolean, settings?: CameraSettings }>(`${apiBase}/settings`, {
      method: 'POST',
      body: formData
    })

    settingsDirty.value = false
    if (response.settings) {
      exposure.value = response.settings.exposure
      gain.value = response.settings.gain
    }

    statusMessage.value = response.ok === false ? 'Settings were not saved.' : 'Settings saved. The camera picks them up on its next report.'
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to save settings.'
  } finally {
    isSaving.value = false
  }
}

onMounted(() => {
  pollStatus()
  statusTimer = setInterval(pollStatus, 1000)
})

onBeforeUnmount(() => {
  if (statusTimer) {
    clearInterval(statusTimer)
  }
})
</script>

<template>
  <UContainer class="py-8 lg:py-10">
    <div class="mb-8 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
      <div>
        <p class="astro-eyebrow">
          Real-time stream
        </p>
        <h1 class="mt-2 text-4xl font-black leading-none tracking-normal text-white md:text-6xl">
          Seeing Monitor
        </h1>
        <p class="mt-3 max-w-2xl text-base leading-7 text-slate-400">
          Live H.264 video of Polaris from the seeing camera, with telemetry and capture controls.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <UButton
          :loading="playerState === 'connecting'"
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="subtle"
          @click="restart"
        >
          Reconnect
        </UButton>
        <UButton
          :to="polarisDataUrl"
          target="_blank"
          icon="i-lucide-download"
        >
          Polaris CSV
        </UButton>
      </div>
    </div>

    <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
      <main class="astro-panel min-w-0 p-3">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
          <div class="flex items-center gap-2">
            <span
              class="size-2 rounded-full"
              :class="badge.dot"
            />
            <span
              class="text-xs font-black uppercase tracking-wider"
              :class="badge.text"
            >
              {{ badge.label }}
            </span>
            <span
              v-if="status?.viewers"
              class="text-xs font-semibold text-slate-500"
            >
              · {{ status.viewers }} watching
            </span>
          </div>
          <div class="text-xs font-semibold text-slate-400">
            {{ positionLabel }}
          </div>
        </div>

        <div class="relative overflow-hidden rounded-lg border border-white/10 bg-black">
          <video
            ref="video"
            class="min-h-[360px] max-h-[calc(100vh-15rem)] w-full object-contain"
            muted
            autoplay
            playsinline
            preload="none"
            aria-label="Live seeing monitor video"
          />
          <div
            v-if="overlayVisible"
            class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 px-6 text-center"
          >
            <UIcon
              :name="playerState === 'connecting' || playerState === 'buffering' ? 'i-lucide-loader-circle' : 'i-lucide-video-off'"
              class="size-8 text-sky-200"
              :class="{ 'animate-spin': playerState === 'connecting' || playerState === 'buffering' }"
            />
            <p class="text-lg font-black text-white">
              {{ overlayTitle }}
            </p>
            <p
              v-if="overlayText"
              class="max-w-md text-sm text-slate-300"
            >
              {{ overlayText }}
            </p>
            <p
              v-if="retryInSeconds !== null"
              class="text-xs font-semibold uppercase tracking-wider text-slate-500"
            >
              Retrying in {{ retryInSeconds }} s
            </p>
          </div>
          <div class="pointer-events-none absolute inset-3 rounded-lg border border-sky-200/15" />
        </div>

        <div class="mt-3 grid grid-cols-2 gap-2 px-1 text-xs text-slate-400 sm:grid-cols-4">
          <div>
            <span class="font-bold uppercase tracking-wider text-slate-500">Video</span>
            <div class="mt-0.5 font-semibold text-slate-300">
              {{ resolutionLabel }} · {{ fpsLabel }} fps
            </div>
          </div>
          <div>
            <span class="font-bold uppercase tracking-wider text-slate-500">Bitrate</span>
            <div class="mt-0.5 font-semibold text-slate-300">
              {{ bitrateLabel }}
            </div>
          </div>
          <div>
            <span class="font-bold uppercase tracking-wider text-slate-500">Player lag</span>
            <div class="mt-0.5 font-semibold text-slate-300">
              {{ lagLabel }}
            </div>
          </div>
          <div>
            <span class="font-bold uppercase tracking-wider text-slate-500">Received</span>
            <div class="mt-0.5 font-semibold text-slate-300">
              {{ receivedLabel }}<span v-if="codecs"> · {{ codecs }}</span>
            </div>
          </div>
        </div>
      </main>

      <aside class="grid gap-4">
        <div class="grid grid-cols-3 gap-3">
          <div class="astro-panel-strong p-4 text-center">
            <div class="text-2xl font-black text-sky-200">
              {{ latencyLabel }}
            </div>
            <div class="mt-1 text-[0.68rem] font-bold uppercase tracking-wider text-slate-500">
              ms latency
            </div>
          </div>
          <div class="astro-panel-strong p-4 text-center">
            <div class="text-2xl font-black text-amber-200">
              {{ exposureLabel }}
            </div>
            <div class="mt-1 text-[0.68rem] font-bold uppercase tracking-wider text-slate-500">
              exposure
            </div>
          </div>
          <div class="astro-panel-strong p-4 text-center">
            <div class="text-2xl font-black text-emerald-200">
              {{ gainLabel }}
            </div>
            <div class="mt-1 text-[0.68rem] font-bold uppercase tracking-wider text-slate-500">
              gain
            </div>
          </div>
        </div>

        <UCard
          class="astro-panel"
          :ui="{ body: 'p-4 sm:p-4' }"
        >
          <div class="mb-4 flex items-center justify-between gap-3">
            <div>
              <p class="astro-eyebrow">
                Camera
              </p>
              <h2 class="mt-1 text-lg font-black text-white">
                Controls
              </h2>
            </div>
            <UIcon
              name="i-lucide-sliders-horizontal"
              class="size-5 text-sky-200"
            />
          </div>

          <form
            class="grid gap-4"
            @submit.prevent="saveSettings"
          >
            <UFormField
              label="Exposure (microseconds)"
              name="exposure"
              :ui="{ label: 'text-xs font-bold uppercase tracking-wider text-slate-400' }"
            >
              <UInputNumber
                v-model="exposure"
                :min="100"
                :max="10000000"
                :step="1"
                class="w-full"
                @update:model-value="markDirty"
              />
            </UFormField>

            <UFormField
              label="Gain"
              name="gain"
              :ui="{ label: 'text-xs font-bold uppercase tracking-wider text-slate-400' }"
            >
              <UInputNumber
                v-model="gain"
                :min="1"
                :max="100"
                :step="1"
                class="w-full"
                @update:model-value="markDirty"
              />
            </UFormField>

            <UButton
              type="submit"
              :loading="isSaving"
              icon="i-lucide-save"
              block
            >
              Apply Settings
            </UButton>
          </form>

          <UAlert
            v-if="statusMessage"
            class="mt-4"
            color="success"
            variant="subtle"
            :title="statusMessage"
          />

          <UAlert
            v-if="errorMessage"
            class="mt-4"
            color="error"
            variant="subtle"
            title="Monitor error"
            :description="errorMessage"
          />
        </UCard>

        <UCard
          class="astro-panel"
          :ui="{ body: 'p-4 sm:p-4' }"
        >
          <div class="mb-3 flex items-center justify-between gap-3">
            <div>
              <p class="astro-eyebrow">
                Camera host
              </p>
              <h2 class="mt-1 text-lg font-black text-white">
                Telemetry
              </h2>
            </div>
            <UIcon
              name="i-lucide-activity"
              class="size-5 text-sky-200"
            />
          </div>
          <dl class="grid gap-2 text-sm">
            <div class="flex justify-between gap-3">
              <dt class="text-slate-500">
                Stream
              </dt>
              <dd class="text-right font-semibold text-slate-200">
                {{ statusError ? 'status unavailable' : (status?.state ?? '--') }}
              </dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-slate-500">
                Last report
              </dt>
              <dd class="text-right font-semibold text-slate-200">
                {{ typeof telemetry?.ageSeconds === 'number' ? `${formatNumber(telemetry.ageSeconds, 1)} s ago` : '--' }}
              </dd>
            </div>
            <div
              v-for="item in extras"
              :key="item.key"
              class="flex justify-between gap-3"
            >
              <dt class="text-slate-500">
                {{ item.key }}
              </dt>
              <dd class="max-w-[60%] truncate text-right font-semibold text-slate-200">
                {{ item.value }}
              </dd>
            </div>
          </dl>
        </UCard>
      </aside>
    </div>
  </UContainer>
</template>
