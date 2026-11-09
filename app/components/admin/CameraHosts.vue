<script setup lang="ts">
import type { CameraCommand, CameraCommandType, CameraHost, CameraHostSample, HeaterMode } from '~/type/admin'
import { formatDateTime } from '~/utils/formatDateTime'

// Camera hosts (the Raspberry Pis) in the admin panel. Each Pi's agent reports every ~5 s and
// picks up the commands queued here; this list refreshes every 5 s while the tab is visible.
const props = defineProps<{
  api: <T>(path: string, options?: { method?: 'GET' | 'POST' | 'PUT', body?: unknown }) => Promise<T>
}>()

const hosts = ref<CameraHost[] | null>(null)
const loadError = ref('')
const busy = ref<Record<string, CameraCommandType | null>>({})
const messages = ref<Record<string, { ok: boolean, text: string }>>({})
const confirming = ref<{ host: string, type: CameraCommandType } | null>(null)
const confirmText = ref('')
let timer: ReturnType<typeof setInterval> | undefined

const errorText = (error: unknown, fallback: string) => {
  const data = (error as { data?: { error?: string, message?: string } })?.data
  return data?.error || data?.message || (error instanceof Error ? error.message : fallback)
}

const load = async () => {
  try {
    hosts.value = (await props.api<{ devices: CameraHost[] }>('/cameras')).devices
    loadError.value = ''
  } catch (error) {
    loadError.value = errorText(error, 'Unable to load the camera hosts.')
  }
}

const send = async (host: CameraHost, type: CameraCommandType, confirm?: string, extra?: { mode: HeaterMode, target?: number }) => {
  busy.value = { ...busy.value, [host.id]: type }
  try {
    const command = await props.api<CameraCommand>(`/cameras/${encodeURIComponent(host.id)}/commands`, {
      method: 'POST',
      body: { type, confirm, ...extra }
    })
    messages.value = { ...messages.value, [host.id]: { ok: true, text: `${commandLabel(command)} sent${command.message ? ` — ${command.message}` : '.'}` } }
    confirming.value = null
    confirmText.value = ''
    await load()
  } catch (error) {
    messages.value = { ...messages.value, [host.id]: { ok: false, text: errorText(error, 'The command was refused.') } }
  } finally {
    busy.value = { ...busy.value, [host.id]: null }
  }
}

// Heater target being edited, per host; falls back to the Pi's current target.
const heaterTargets = ref<Record<string, number | undefined>>({})
const heaterTarget = (host: CameraHost) => heaterTargets.value[host.id] ?? host.report.heater?.target ?? 24

const setHeater = (host: CameraHost, mode: HeaterMode) => {
  const target = Number(heaterTarget(host))
  if (mode === 'AUTO' && !Number.isFinite(target)) {
    messages.value = { ...messages.value, [host.id]: { ok: false, text: 'Enter a target temperature for Auto.' } }
    return
  }
  send(host, 'HEATER', undefined, mode === 'AUTO' ? { mode, target } : { mode })
}

const ask = (host: CameraHost, type: CameraCommandType) => {
  confirming.value = { host: host.id, type }
  confirmText.value = ''
}

const refreshWhenVisible = () => {
  if (document.visibilityState === 'visible') load()
}

onMounted(() => {
  load()
  timer = setInterval(refreshWhenVisible, 5000)
  document.addEventListener('visibilitychange', refreshWhenVisible)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  document.removeEventListener('visibilitychange', refreshWhenVisible)
})

// ------------------------------------------------------------------ presentation

const labels: Record<CameraCommandType, string> = {
  CAPTURE: 'Take picture now',
  RESTART_SERVICE: 'Restart capture program',
  REBOOT: 'Reboot',
  SHUTDOWN: 'Shut down',
  HEATER: 'Heater'
}

const heaterModes: { mode: HeaterMode, label: string, icon: string }[] = [
  { mode: 'AUTO', label: 'Auto', icon: 'i-lucide-thermometer' },
  { mode: 'ON', label: 'On', icon: 'i-lucide-flame' },
  { mode: 'OFF', label: 'Off', icon: 'i-lucide-circle-off' }
]

const commandLabel = (command: CameraCommand) => {
  if (command.type !== 'HEATER' || !command.params?.mode) return labels[command.type]
  const mode = heaterModes.find(m => m.mode === command.params!.mode)?.label ?? command.params.mode
  return `Heater ${mode}${command.params.mode === 'AUTO' && typeof command.params.target === 'number' ? ` (${command.params.target} °C)` : ''}`
}

const warnings: Partial<Record<CameraCommandType, string>> = {
  REBOOT: 'The Pi restarts and is back in about 1–2 minutes. Capture or streaming stops meanwhile.',
  SHUTDOWN: 'The Pi powers off and stays off until someone power-cycles it on site — it cannot be turned on from here. '
    + 'allskycam2 is also the SSH jump host to armageddon from outside the VPN.'
}

const statusColor: Record<CameraCommand['status'], string> = {
  PENDING: 'text-amber-200',
  DELIVERED: 'text-sky-200',
  DONE: 'text-emerald-200',
  FAILED: 'text-rose-200',
  EXPIRED: 'text-slate-400',
  UNANSWERED: 'text-amber-200',
  SUPERSEDED: 'text-slate-400'
}

const fixed = (value: unknown, digits = 1) =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '--'

const bytes = (value?: number | null) => {
  if (typeof value !== 'number') return '--'
  const gib = value / 1024 ** 3
  return gib >= 1 ? `${gib.toFixed(1)} GiB` : `${(value / 1024 ** 2).toFixed(0)} MiB`
}

const duration = (seconds?: number | null) => {
  if (typeof seconds !== 'number') return '--'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return d > 0 ? `${d} d ${h} h` : h > 0 ? `${h} h ${m} min` : `${m} min`
}

const ago = (iso?: string | null) => {
  if (!iso) return 'never'
  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000))
  return seconds < 90 ? `${seconds} s ago` : `${duration(seconds)} ago`
}

const busyCommand = (host: CameraHost) => host.commands.find(c => c.status === 'PENDING' || c.status === 'DELIVERED')

/** SVG polyline points for one series of the last 24 h, scaled to its own range. */
const sparkline = (samples: CameraHostSample[], key: 'temperature' | 'humidity' | 'cpuTemperature') => {
  const points = samples.filter(s => typeof s[key] === 'number')
  if (points.length < 2) return null
  const values = points.map(s => s[key] as number)
  const t0 = Date.parse(points[0]!.at)
  const span = Math.max(1, Date.parse(points[points.length - 1]!.at) - t0)
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const range = Math.max(hi - lo, 0.5)
  return {
    min: lo,
    max: hi,
    points: points.map((s, i) => `${((Date.parse(s.at) - t0) / span * 100).toFixed(2)},${(28 - (values[i]! - lo) / range * 26).toFixed(2)}`).join(' ')
  }
}

const series = [
  { key: 'temperature', label: 'Enclosure °C', color: 'stroke-amber-300' },
  { key: 'humidity', label: 'Humidity %', color: 'stroke-sky-300' },
  { key: 'cpuTemperature', label: 'CPU °C', color: 'stroke-rose-300' }
] as const
</script>

<template>
  <section class="grid gap-4">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p class="astro-eyebrow">
          Cameras
        </p>
        <h2 class="mt-1 text-2xl font-black text-white">
          Camera hosts
        </h2>
        <p class="mt-1 max-w-3xl text-sm text-slate-400">
          The Raspberry Pis that run the cameras. Each one reports every few seconds and picks up commands from here;
          a command the Pi does not pick up within 90 seconds is dropped, never run later.
        </p>
      </div>
      <UButton
        color="neutral"
        variant="ghost"
        icon="i-lucide-refresh-cw"
        @click="load"
      >
        Refresh
      </UButton>
    </div>

    <p
      v-if="loadError"
      class="text-sm text-rose-200"
    >
      {{ loadError }}
    </p>
    <p
      v-else-if="hosts && hosts.length === 0"
      class="text-sm text-slate-400"
    >
      No camera hosts are registered yet (devices.json on the server).
    </p>

    <UCard
      v-for="host in hosts ?? []"
      :key="host.id"
      class="astro-panel"
      :ui="{ body: 'p-4 sm:p-5' }"
    >
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <h3 class="flex items-center gap-2 text-lg font-black text-white">
            <span
              class="inline-block size-2.5 rounded-full"
              :class="host.online ? 'bg-emerald-400' : 'bg-rose-400'"
            />
            {{ host.name }}
            <span class="text-sm font-normal text-slate-400">{{ host.id }}</span>
          </h3>
          <p class="mt-0.5 text-xs text-slate-400">
            {{ host.online ? 'Online' : 'Offline' }} · last report {{ ago(host.lastSeen) }}
            <span v-if="host.report.dryRun"> · <span class="text-amber-200">dry run (power commands are only logged)</span></span>
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton
            v-if="host.capabilities.includes('CAPTURE')"
            icon="i-lucide-camera"
            :loading="busy[host.id] === 'CAPTURE'"
            :disabled="!host.online || !!busyCommand(host)"
            @click="send(host, 'CAPTURE')"
          >
            Take picture now
          </UButton>
          <UButton
            v-if="host.capabilities.includes('RESTART_SERVICE')"
            color="neutral"
            variant="outline"
            icon="i-lucide-rotate-ccw"
            :loading="busy[host.id] === 'RESTART_SERVICE'"
            :disabled="!host.online || !!busyCommand(host)"
            @click="send(host, 'RESTART_SERVICE')"
          >
            Restart program
          </UButton>
          <UButton
            v-if="host.capabilities.includes('REBOOT')"
            color="warning"
            variant="outline"
            icon="i-lucide-power"
            :disabled="!host.online || !!busyCommand(host)"
            @click="ask(host, 'REBOOT')"
          >
            Reboot
          </UButton>
          <UButton
            v-if="host.capabilities.includes('SHUTDOWN')"
            color="error"
            variant="outline"
            icon="i-lucide-power-off"
            :disabled="!host.online || !!busyCommand(host)"
            @click="ask(host, 'SHUTDOWN')"
          >
            Shut down
          </UButton>
        </div>
      </div>

      <form
        v-if="confirming?.host === host.id"
        class="mt-4 grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_auto] sm:items-end"
        :class="confirming.type === 'SHUTDOWN' ? 'border-rose-400/40 bg-rose-500/10' : 'border-amber-400/40 bg-amber-500/10'"
        @submit.prevent="send(host, confirming.type, confirmText)"
      >
        <label class="grid gap-1 text-sm text-slate-200">
          <span>
            <strong>{{ labels[confirming.type] }} {{ host.id }}?</strong> {{ warnings[confirming.type] }}
            Type <code class="text-white">{{ host.id }}</code> to confirm.
          </span>
          <input
            v-model="confirmText"
            autocomplete="off"
            spellcheck="false"
            class="rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-sky-300"
          >
        </label>
        <div class="flex gap-2">
          <UButton
            type="submit"
            :color="confirming.type === 'SHUTDOWN' ? 'error' : 'warning'"
            :disabled="confirmText !== host.id"
            :loading="busy[host.id] === confirming.type"
          >
            {{ labels[confirming.type] }}
          </UButton>
          <UButton
            color="neutral"
            variant="ghost"
            @click="confirming = null"
          >
            Cancel
          </UButton>
        </div>
      </form>

      <p
        v-if="messages[host.id]"
        class="mt-3 text-sm"
        :class="messages[host.id]!.ok ? 'text-emerald-200' : 'text-rose-200'"
      >
        {{ messages[host.id]!.text }}
      </p>

      <div
        v-if="host.report.heater && host.capabilities.includes('HEATER')"
        class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-md border border-white/10 p-3"
      >
        <div class="min-w-36">
          <p class="text-xs font-bold uppercase tracking-wider text-slate-500">
            Heater
          </p>
          <p class="mt-0.5 flex items-center gap-2 text-lg font-black text-white">
            <span
              class="inline-block size-2.5 rounded-full"
              :class="host.report.heater.on ? 'bg-orange-400' : 'bg-slate-500'"
            />
            {{ host.report.heater.on ? 'Heating' : 'Off' }}
            <span class="text-sm font-normal text-slate-400">
              {{ host.report.heater.mode === 'AUTO' ? `auto, ${fixed(host.report.heater.target)} °C` : 'manual' }}
            </span>
          </p>
          <p class="text-xs text-slate-500">
            GPIO {{ host.report.heater.pin }}
            <span v-if="typeof host.report.heater.switchedSecondsAgo === 'number'"> · switched {{ duration(host.report.heater.switchedSecondsAgo) }} ago</span>
            <span
              v-if="host.report.heater.pinHigh !== undefined && host.report.heater.pinHigh !== host.report.heater.on"
              class="text-rose-200"
            > · pin reads {{ host.report.heater.pinHigh ? 'high' : 'low' }}</span>
          </p>
        </div>
        <div
          class="flex"
          role="group"
          aria-label="Heater mode"
        >
          <UButton
            v-for="(m, i) in heaterModes"
            :key="m.mode"
            :icon="m.icon"
            :color="host.report.heater.mode === m.mode ? 'primary' : 'neutral'"
            :variant="host.report.heater.mode === m.mode ? 'solid' : 'outline'"
            :class="i === 0 ? 'rounded-r-none' : i === heaterModes.length - 1 ? 'rounded-l-none' : 'rounded-none'"
            :aria-pressed="host.report.heater.mode === m.mode"
            :disabled="!host.online || busy[host.id] === 'HEATER'"
            @click="setHeater(host, m.mode)"
          >
            {{ m.label }}
          </UButton>
        </div>
        <form
          class="flex items-center gap-2 text-sm text-slate-300"
          @submit.prevent="setHeater(host, 'AUTO')"
        >
          <label :for="`heater-target-${host.id}`">Auto target</label>
          <input
            :id="`heater-target-${host.id}`"
            :value="heaterTarget(host)"
            type="number"
            min="-30"
            max="60"
            step="0.1"
            class="w-20 rounded-md border border-white/15 bg-white/5 px-2 py-1.5 text-sm tabular-nums text-white outline-none focus:border-sky-300"
            @input="heaterTargets = { ...heaterTargets, [host.id]: ($event.target as HTMLInputElement).valueAsNumber }"
          >
          <span>°C</span>
          <UButton
            type="submit"
            size="sm"
            color="neutral"
            variant="outline"
            :disabled="!host.online || busy[host.id] === 'HEATER'"
          >
            Set
          </UButton>
        </form>
        <p
          v-if="host.report.heater.error"
          class="basis-full text-xs text-amber-200"
        >
          {{ host.report.heater.error }}
        </p>
      </div>

      <dl class="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs sm:grid-cols-4">
        <div>
          <dt class="font-bold uppercase tracking-wider text-slate-500">
            Temperature
          </dt>
          <dd class="mt-0.5 text-lg font-black tabular-nums text-white">
            {{ fixed(host.report.sensors?.temperature) }} °C
          </dd>
        </div>
        <div>
          <dt class="font-bold uppercase tracking-wider text-slate-500">
            Humidity
          </dt>
          <dd class="mt-0.5 text-lg font-black tabular-nums text-white">
            {{ fixed(host.report.sensors?.humidity) }} %
          </dd>
        </div>
        <div>
          <dt class="font-bold uppercase tracking-wider text-slate-500">
            CPU temperature
          </dt>
          <dd class="mt-0.5 text-lg font-black tabular-nums text-white">
            {{ fixed(host.report.host?.cpuTemperature) }} °C
          </dd>
        </div>
        <div>
          <dt class="font-bold uppercase tracking-wider text-slate-500">
            Load (1/5/15 min)
          </dt>
          <dd class="mt-0.5 text-lg font-black tabular-nums text-white">
            {{ host.report.host?.load?.map(v => v.toFixed(2)).join(' / ') ?? '--' }}
          </dd>
        </div>
        <div>
          <dt class="font-bold uppercase tracking-wider text-slate-500">
            IP addresses
          </dt>
          <dd class="mt-0.5 break-all text-slate-200">
            {{ host.report.host?.ips?.join(', ') || '--' }}
            <span
              v-if="host.sourceAddress && !host.report.host?.ips?.includes(host.sourceAddress)"
              class="block text-slate-500"
            >seen as {{ host.sourceAddress }}</span>
          </dd>
        </div>
        <div>
          <dt class="font-bold uppercase tracking-wider text-slate-500">
            Uptime
          </dt>
          <dd class="mt-0.5 text-slate-200">
            Pi {{ duration(host.report.host?.uptimeSeconds) }} · program {{ duration(host.report.processUptimeSeconds) }}
          </dd>
        </div>
        <div>
          <dt class="font-bold uppercase tracking-wider text-slate-500">
            Memory / disk free
          </dt>
          <dd class="mt-0.5 text-slate-200">
            {{ bytes(host.report.host?.memoryAvailable) }} of {{ bytes(host.report.host?.memoryTotal) }} ·
            {{ bytes(host.report.host?.diskFree) }} of {{ bytes(host.report.host?.diskTotal) }}
          </dd>
        </div>
        <div>
          <dt class="font-bold uppercase tracking-wider text-slate-500">
            System
          </dt>
          <dd class="mt-0.5 text-slate-200">
            {{ host.report.host?.hostname ?? '--' }} · {{ host.report.host?.os ?? '--' }}
            <span class="block text-slate-500">{{ host.report.host?.service }}<span v-if="host.report.agentVersion"> · agent {{ host.report.agentVersion }}</span></span>
          </dd>
        </div>
        <div
          v-if="host.report.status?.cameraId"
          class="col-span-2"
        >
          <dt class="font-bold uppercase tracking-wider text-slate-500">
            Camera
          </dt>
          <dd class="mt-0.5 text-slate-200">
            {{ host.report.status.cameraId }}
            <span
              v-if="typeof host.report.status.exposureUs === 'number'"
              class="text-slate-400"
            > · {{ ((host.report.status.exposureUs as number) / 1e6).toPrecision(3) }} s, gain {{ host.report.status.gain }}</span>
          </dd>
        </div>
        <div
          v-if="host.report.status?.lastCaptureAt"
          class="col-span-2"
        >
          <dt class="font-bold uppercase tracking-wider text-slate-500">
            Last picture
          </dt>
          <dd class="mt-0.5 text-slate-200">
            {{ formatDateTime(host.report.status.lastCaptureAt as string) }}
            <NuxtLink
              v-if="host.report.status.lastImageId"
              :to="`/gallery/${host.report.status.lastImageId}`"
              class="text-sky-300 underline"
            >#{{ host.report.status.lastImageId }}</NuxtLink>
          </dd>
        </div>
      </dl>
      <p
        v-if="host.report.sensors?.error || host.report.status?.error || host.report.host?.error"
        class="mt-2 text-xs text-amber-200"
      >
        {{ host.report.sensors?.error || host.report.status?.error || host.report.host?.error }}
      </p>

      <div
        v-if="host.history.length > 1"
        class="mt-4 grid gap-3 sm:grid-cols-3"
      >
        <template
          v-for="line in series"
          :key="line.key"
        >
          <div
            v-if="sparkline(host.history, line.key)"
            class="rounded-md border border-white/10 p-2"
          >
            <p class="flex justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <span>{{ line.label }} · 24 h</span>
              <span class="tabular-nums">{{ fixed(sparkline(host.history, line.key)!.min) }}–{{ fixed(sparkline(host.history, line.key)!.max) }}</span>
            </p>
            <svg
              viewBox="0 0 100 30"
              preserveAspectRatio="none"
              class="mt-1 h-10 w-full"
              role="img"
              :aria-label="`${line.label} over the last 24 hours`"
            >
              <polyline
                :points="sparkline(host.history, line.key)!.points"
                fill="none"
                stroke-width="1.5"
                vector-effect="non-scaling-stroke"
                :class="line.color"
              />
            </svg>
          </div>
        </template>
      </div>

      <details
        v-if="host.commands.length"
        class="mt-4 text-xs"
        :open="!!busyCommand(host)"
      >
        <summary class="cursor-pointer font-bold uppercase tracking-wider text-slate-500">
          Recent commands
        </summary>
        <ul class="mt-2 grid gap-1.5">
          <li
            v-for="command in host.commands.slice(0, 8)"
            :key="command.id"
            class="flex flex-wrap gap-x-2 text-slate-300"
          >
            <span class="tabular-nums text-slate-500">{{ formatDateTime(command.issuedAt) }}</span>
            <span class="font-bold">{{ commandLabel(command) }}</span>
            <span :class="statusColor[command.status]">{{ command.status.toLowerCase() }}</span>
            <span v-if="command.message">— {{ command.message }}</span>
            <NuxtLink
              v-if="command.result?.imgId"
              :to="`/gallery/${command.result.imgId}`"
              class="text-sky-300 underline"
            >view picture</NuxtLink>
            <span class="text-slate-500">by {{ command.issuedBy }}</span>
          </li>
        </ul>
      </details>
    </UCard>
  </section>
</template>
