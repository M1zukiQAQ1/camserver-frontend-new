<script setup lang="ts">
type CameraSettings = {
  exposure?: number
  gain?: number
}

type StatsResponse = {
  meta?: {
    latency_ms?: number
    latencyMs?: number
  }
  settings?: CameraSettings
}

useHead({
  title: 'Seeing Monitor'
})

const apiBase = useApiBase()

const exposure = ref<number | undefined>()
const gain = ref<number | undefined>()
const latencyMs = ref<number | null>(null)
const livePosition = ref('--')
const statusMessage = ref('')
const errorMessage = ref('')
const isSaving = ref(false)
const isRefreshing = ref(false)
const streamRevision = ref(0)
let statsTimer: ReturnType<typeof setInterval> | undefined
let positionTimer: ReturnType<typeof setInterval> | undefined

const streamUrl = computed(() => `${apiBase}/seeing_monitor?stream=${streamRevision.value}`)
const polarisDataUrl = computed(() => `${apiBase}/api/images/PolarisData.csv`)
const latencyLabel = computed(() => latencyMs.value === null ? '--' : latencyMs.value)
const exposureLabel = computed(() => exposure.value ?? '--')
const gainLabel = computed(() => gain.value ?? '--')

const fetchSettings = async () => {
  try {
    const settings = await $fetch<CameraSettings>(`${apiBase}/settings`)
    exposure.value = settings.exposure
    gain.value = settings.gain
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to load camera settings.'
  }
}

const pollStats = async () => {
  try {
    const stats = await $fetch<StatsResponse>(`${apiBase}/stats`)
    latencyMs.value = stats.meta?.latency_ms ?? stats.meta?.latencyMs ?? null

    if (stats.settings) {
      exposure.value = stats.settings.exposure
      gain.value = stats.settings.gain
    }
  } catch {
    latencyMs.value = null
  }
}

const pollPosition = async () => {
  try {
    const position = await $fetch<string>(`${apiBase}/live_pos`, {
      responseType: 'text'
    })
    livePosition.value = position || '--'
  } catch {
    livePosition.value = '--'
  }
}

const refreshStream = async () => {
  isRefreshing.value = true
  streamRevision.value = Date.now()
  await new Promise(resolve => setTimeout(resolve, 250))
  isRefreshing.value = false
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

    if (response.settings) {
      exposure.value = response.settings.exposure
      gain.value = response.settings.gain
    }

    statusMessage.value = response.ok === false ? 'Settings were not saved.' : 'Settings saved.'
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to save settings.'
  } finally {
    isSaving.value = false
  }
}

onMounted(() => {
  streamRevision.value = Date.now()
  fetchSettings()
  pollStats()
  pollPosition()
  statsTimer = setInterval(pollStats, 1000)
  positionTimer = setInterval(pollPosition, 1000)
})

onBeforeUnmount(() => {
  if (statsTimer) {
    clearInterval(statsTimer)
  }

  if (positionTimer) {
    clearInterval(positionTimer)
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
          Live Polaris feed with camera telemetry and capture controls.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <UButton
          :loading="isRefreshing"
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="subtle"
          @click="refreshStream"
        >
          Refresh Stream
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
            <span class="size-2 rounded-full bg-emerald-300 shadow-[0_0_18px_rgb(141_227_200_/_0.9)]" />
            <span class="text-xs font-black uppercase tracking-wider text-emerald-200">Observing</span>
          </div>
          <div class="text-xs font-semibold text-slate-400">
            {{ livePosition }}
          </div>
        </div>

        <div class="relative overflow-hidden rounded-lg border border-white/10 bg-black">
          <img
            :key="streamRevision"
            :src="streamUrl"
            alt="Live seeing monitor stream"
            class="min-h-[360px] max-h-[calc(100vh-15rem)] w-full object-contain"
          >
          <div class="pointer-events-none absolute inset-3 rounded-lg border border-sky-200/15" />
        </div>
      </main>

      <aside class="grid gap-4">
        <div class="grid grid-cols-3 gap-3">
          <div class="astro-panel-strong p-4 text-center">
            <div class="text-2xl font-black text-sky-200">
              {{ latencyLabel }}
            </div>
            <div class="mt-1 text-[0.68rem] font-bold uppercase tracking-wider text-slate-500">
              ms
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
      </aside>
    </div>
  </UContainer>
</template>
