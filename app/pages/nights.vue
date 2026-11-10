<script setup lang="ts">
import type { Night, NightVideoStatus } from '~/type/sky'

useHead({
  title: 'Nights'
})

const apiBase = useApiBase()
const ALL = 'all'

const nights = ref<Night[]>([])
const keyOf = (night: Night) => `${night.cameraId}/${night.date}`
const loaded = ref(false)
const errorMessage = ref('')
const camera = ref(ALL)
const playing = ref<Record<string, boolean>>({})

const load = async () => {
  try {
    nights.value = await $fetch<Night[]>(`${apiBase}/nightly`, { query: { limit: 60 } })
    errorMessage.value = ''
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to load the nightly summaries.'
  } finally {
    loaded.value = true
  }
}

onMounted(load)

// ---- videos on demand ---------------------------------------------------------------------

interface Site { cameraId: string, siteName: string | null }

const sites = ref<Site[]>([])
const askCamera = ref('')
const askDate = ref('')
/** Per camera/date: what the server last said about a video we asked for. */
const asked = ref<Record<string, { state: NightVideoStatus['state'], message: string }>>({})
const timers: ReturnType<typeof setTimeout>[] = []

onMounted(async () => {
  try {
    sites.value = (await $fetch<Site[]>(`${apiBase}/sites`)).map(site => ({ ...site, cameraId: site.cameraId.trim() }))
    askCamera.value = sites.value.find(site => nights.value.some(night => night.cameraId === site.cameraId))?.cameraId
      ?? sites.value[0]?.cameraId ?? ''
  } catch {
    sites.value = [] // the form is simply not shown
  }
})
onBeforeUnmount(() => timers.forEach(clearTimeout))

const siteItems = computed(() => sites.value.map(site => ({ label: site.siteName || site.cameraId, value: site.cameraId })))
const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
const askKey = computed(() => `${askCamera.value}/${askDate.value}`)
const isWaiting = (key: string) => asked.value[key]?.state === 'queued' || asked.value[key]?.state === 'building'

/** Puts a night that has just been built into the list, in date order, and opens its video. */
const showNight = (night: Night) => {
  const key = keyOf(night)
  nights.value = [...nights.value.filter(other => keyOf(other) !== key), night]
    .sort((a, b) => b.date.localeCompare(a.date) || a.cameraId.localeCompare(b.cameraId))
  if (camera.value !== ALL && camera.value !== night.cameraId) {
    camera.value = ALL
  }
  playing.value[key] = true
  nextTick(() => document.getElementById(`night-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
}

const askForVideo = async (cameraId: string, date: string, method: 'POST' | 'GET' = 'POST') => {
  const key = `${cameraId}/${date}`
  if (method === 'POST') {
    asked.value[key] = { state: 'queued', message: '' }
  }
  try {
    const status = await $fetch<NightVideoStatus>(`${apiBase}/nightly/${encodeURIComponent(cameraId)}/${date}`, { method })
    asked.value[key] = { state: status.state, message: status.message ?? '' }
    if (status.state === 'ready' && status.night) {
      showNight(status.night)
    } else if (status.state === 'queued' || status.state === 'building') {
      timers.push(setTimeout(() => askForVideo(cameraId, date, 'GET'), 3000))
    } else if (status.state === 'none') {
      asked.value[key] = { state: 'unavailable', message: 'The server forgot the request; please ask again.' }
    }
  } catch (error) {
    asked.value[key] = { state: 'unavailable', message: error instanceof Error ? error.message : 'The request failed.' }
  }
}

const waitingLabel = (key: string) => asked.value[key]?.state === 'building' ? 'Making the video…' : 'Waiting in line…'

const cameraItems = computed(() => {
  const names = new Map<string, string>()
  for (const night of nights.value) {
    names.set(night.cameraId, night.siteName || night.cameraId)
  }
  return [{ label: 'All cameras', value: ALL }, ...[...names].map(([value, label]) => ({ label, value }))]
})

const visibleNights = computed(() =>
  camera.value === ALL ? nights.value : nights.value.filter(night => night.cameraId === camera.value)
)

const fileUrl = (night: Night, name: string) =>
  `${apiBase}/nightly/${encodeURIComponent(night.cameraId)}/${night.date}/${name}?v=${encodeURIComponent(night.builtAt)}`

const dateLabel = (night: Night) =>
  new Intl.DateTimeFormat('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${night.date}T12:00:00Z`))

const timeLabel = (instant: string | number, night: Night) =>
  new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: night.timeZone })
    .format(new Date(instant))

const hourLabel = (instant: number, night: Night) =>
  new Intl.DateTimeFormat('en-US', { hour: 'numeric', timeZone: night.timeZone }).format(new Date(instant))

/** Whole hours between dusk and dawn, as positions along the keogram. */
const hourTicks = (night: Night) => {
  const start = Date.parse(night.start)
  const end = Date.parse(night.end)
  const ticks: { left: string, label: string }[] = []
  for (let t = Math.ceil(start / 3_600_000) * 3_600_000; t < end; t += 3_600_000) {
    const fraction = (t - start) / (end - start)
    if (fraction > 0.07 && fraction < 0.93) {
      ticks.push({ left: `${fraction * 100}%`, label: hourLabel(t, night) })
    }
  }
  return ticks
}

/** The frame taken closest to the time under the pointer. */
const frameAt = (night: Night, event: MouseEvent) => {
  const box = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const fraction = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width))
  const start = Date.parse(night.start)
  const at = start + fraction * (Date.parse(night.end) - start)
  let best = night.frames[0]
  for (const frame of night.frames) {
    if (best && Math.abs(Date.parse(frame.at) - at) < Math.abs(Date.parse(best.at) - at)) {
      best = frame
    }
  }
  return best
}

const openFrame = (night: Night, event: MouseEvent) => {
  const frame = frameAt(night, event)
  if (frame) {
    navigateTo(`/gallery/${frame.imgId}`)
  }
}
</script>

<template>
  <UContainer class="py-8 lg:py-10">
    <div class="mb-8 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
      <div>
        <p class="astro-eyebrow">
          Night by night
        </p>
        <h1 class="mt-2 text-4xl font-black leading-none tracking-normal text-white md:text-6xl">
          Nights
        </h1>
        <p class="mt-3 max-w-2xl text-base leading-7 text-slate-400">
          Each night in one picture. A keogram takes the centre column of every frame and lays them side by side,
          dusk on the left and dawn on the right, so cloud shows as bright bands and a clear night stays dark and even.
          Click a keogram to open the frame taken at that moment.
        </p>
      </div>

      <USelect
        v-if="cameraItems.length > 2"
        v-model="camera"
        :items="cameraItems"
        class="w-60"
        aria-label="Camera"
      />
    </div>

    <UAlert
      v-if="errorMessage"
      class="mb-6"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="The nightly summaries could not be loaded"
      :description="errorMessage"
    />

    <div
      v-else-if="loaded && !visibleNights.length"
      class="astro-panel p-8 text-center text-sm leading-6 text-slate-400"
    >
      No night has been summarised yet. A summary is made within an hour of dawn, from the frames of the night before.
    </div>

    <form
      v-if="siteItems.length"
      class="astro-panel mb-6 flex flex-wrap items-end gap-3 p-4"
      aria-label="Make the time-lapse of another night"
      @submit.prevent="askForVideo(askCamera, askDate)"
    >
      <div class="min-w-0 grow basis-full text-sm leading-6 text-slate-400 lg:basis-0">
        <span class="font-bold text-white">Time-lapse of any night.</span>
        Pick a camera and the date of the evening; the video is made on request and takes about a minute.
      </div>
      <USelect
        v-model="askCamera"
        :items="siteItems"
        class="w-56"
        aria-label="Camera"
      />
      <UInput
        v-model="askDate"
        type="date"
        :max="yesterday"
        required
        aria-label="Date of the evening"
      />
      <UButton
        type="submit"
        icon="i-lucide-film"
        :loading="isWaiting(askKey)"
        :disabled="!askCamera || !askDate || isWaiting(askKey)"
      >
        {{ isWaiting(askKey) ? waitingLabel(askKey) : 'Make video' }}
      </UButton>
      <p
        v-if="asked[askKey]?.state === 'unavailable'"
        class="basis-full text-sm text-amber-300"
        role="status"
      >
        {{ asked[askKey]?.message }}
      </p>
    </form>

    <div class="space-y-6">
      <section
        v-for="night in visibleNights"
        :id="`night-${keyOf(night)}`"
        :key="keyOf(night)"
        class="astro-panel overflow-hidden"
        :aria-label="`${night.siteName || night.cameraId}, night of ${dateLabel(night)}`"
      >
        <div class="flex flex-wrap items-end justify-between gap-3 px-4 pb-3 pt-4">
          <div>
            <h2 class="text-lg font-extrabold text-white">
              {{ dateLabel(night) }}
            </h2>
            <p class="mt-0.5 text-xs text-slate-400">
              {{ night.siteName || night.cameraId }} · {{ night.frames.length }} frames ·
              {{ timeLabel(night.start, night) }} – {{ timeLabel(night.end, night) }}
            </p>
          </div>
          <UButton
            v-if="night.timelapse"
            size="sm"
            color="neutral"
            variant="subtle"
            :icon="playing[keyOf(night)] ? 'i-lucide-x' : 'i-lucide-film'"
            @click="playing[keyOf(night)] = !playing[keyOf(night)]"
          >
            {{ playing[keyOf(night)] ? 'Close time-lapse' : 'Time-lapse' }}
          </UButton>
          <div
            v-else
            class="flex flex-wrap items-center justify-end gap-3"
          >
            <span
              v-if="asked[keyOf(night)]?.state === 'unavailable'"
              class="max-w-xs text-xs text-amber-300"
              role="status"
            >{{ asked[keyOf(night)]?.message }}</span>
            <UButton
              size="sm"
              color="neutral"
              variant="subtle"
              icon="i-lucide-film"
              :loading="isWaiting(keyOf(night))"
              :disabled="isWaiting(keyOf(night))"
              @click="askForVideo(night.cameraId, night.date)"
            >
              {{ isWaiting(keyOf(night)) ? waitingLabel(keyOf(night)) : 'Make time-lapse' }}
            </UButton>
          </div>
        </div>

        <div class="px-4 pb-4">
          <button
            type="button"
            class="keogram block w-full cursor-crosshair overflow-hidden rounded-md border border-white/10 bg-black"
            :aria-label="`Keogram of ${dateLabel(night)}; click to open the frame at that time`"
            @click="openFrame(night, $event)"
          >
            <img
              :src="fileUrl(night, night.keogram)"
              :width="night.keogramWidth"
              :height="night.keogramHeight"
              alt=""
              loading="lazy"
              class="block h-40 w-full object-fill sm:h-56"
            >
          </button>
          <div
            class="relative mt-1 h-4 text-[11px] font-semibold text-slate-500"
            aria-hidden="true"
          >
            <span class="absolute left-0">{{ timeLabel(night.start, night) }}</span>
            <span
              v-for="tick in hourTicks(night)"
              :key="tick.left"
              class="absolute hidden -translate-x-1/2 sm:block"
              :style="{ left: tick.left }"
            >{{ tick.label }}</span>
            <span class="absolute right-0">{{ timeLabel(night.end, night) }}</span>
          </div>

          <video
            v-if="night.timelapse && playing[keyOf(night)]"
            class="mt-4 w-full rounded-md border border-white/10 bg-black"
            :src="fileUrl(night, night.timelapse)"
            controls
            autoplay
            loop
            muted
            playsinline
          />
        </div>
      </section>
    </div>
  </UContainer>
</template>
