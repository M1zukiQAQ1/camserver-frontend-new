import type { CameraSettings, LiveTelemetry, PictureSettings } from '~/type/liveStream'

export type AdminSession = {
  authenticated: boolean
  expiresAt?: string | null
  clientAddress?: string
  network?: string | null
  passwordConfigured?: boolean
}

export type DailyViews = { date: string, views: number, visitors: number, peakLiveViewers: number }

export type RegionViews = {
  countryCode?: string | null
  country?: string | null
  region?: string | null
  views: number
  visitors: number
  cities: Record<string, number>
}

export type Analytics = {
  from: string
  to: string
  timeZone: string
  views: number
  visitors: number
  todayViews: number
  todayVisitors: number
  peakLiveViewers: number
  liveViewersNow: number
  daily: DailyViews[]
  pages: { path: string, views: number }[]
  regions: RegionViews[]
  referrers: { site: string, views: number }[]
  networks: { network: string, views: number }[]
  recent: { ts: string, path: string, country?: string | null, region?: string | null, city?: string | null, network?: string | null }[]
  geoDatabase?: string | null
}

export type AlertSettings = {
  enabled: boolean
  recipients: string[]
  smtpHost: string
  smtpPort: number
  security: 'none' | 'starttls' | 'starttls-required' | 'ssl'
  username?: string | null
  /** Write-only: blank keeps the stored password. */
  password?: string | null
  passwordSet?: boolean
  from: string
  downAfterMinutes: number
  alertOnWarn: boolean
  repeatHours: number
  muted: string[]
}

export type AlertComponent = {
  key: string
  name: string
  status: string
  since: string
  alertedStatus?: string | null
  alertedAt?: string | null
  muted: boolean
}

export type AlertOverview = {
  settings: AlertSettings
  components: AlertComponent[]
  log: { at: string, subject: string, recipients: string[], ok: boolean, error?: string | null }[]
}

export type Measurement = {
  settings: CameraSettings
  preview: PictureSettings
  telemetry: LiveTelemetry
}

export type CameraCommandType = 'CAPTURE' | 'RESTART_SERVICE' | 'REBOOT' | 'SHUTDOWN' | 'HEATER'

export type HeaterMode = 'AUTO' | 'ON' | 'OFF'

export type CameraCommand = {
  id: string
  type: CameraCommandType
  status: 'PENDING' | 'DELIVERED' | 'DONE' | 'FAILED' | 'EXPIRED' | 'UNANSWERED' | 'SUPERSEDED'
  issuedAt: string
  issuedBy?: string | null
  params?: { mode?: HeaterMode, target?: number } | null
  deliveredAt?: string | null
  completedAt?: string | null
  message?: string | null
  result?: { imgId?: number, exposureUs?: number, gain?: number } & Record<string, unknown> | null
}

export type CameraHostInfo = {
  hostname?: string
  ips?: string[]
  uptimeSeconds?: number
  load?: number[]
  cpus?: number
  memoryTotal?: number
  memoryAvailable?: number | null
  diskTotal?: number
  diskFree?: number
  cpuTemperature?: number
  throttled?: string
  os?: string
  kernel?: string
  python?: string
  service?: string
  error?: string
}

export type CameraHostReport = {
  agentVersion?: string
  capabilities?: CameraCommandType[]
  processUptimeSeconds?: number
  dryRun?: boolean
  host?: CameraHostInfo
  sensors?: { temperature?: number, humidity?: number, sensor?: string, error?: string }
  status?: Record<string, unknown> & { error?: string }
  /** Enclosure heater on the Pi's GPIO (only when the agent could claim the line). */
  heater?: {
    mode: HeaterMode
    target: number
    on: boolean
    pinHigh?: boolean | null
    pin?: number
    hysteresis?: number
    changedAt?: string
    switchedSecondsAgo?: number
    error?: string
  }
}

export type CameraHostSample = { at: string, temperature?: number | null, humidity?: number | null, cpuTemperature?: number | null }

export type CameraHost = {
  id: string
  name: string
  online: boolean
  lastSeen?: string | null
  sourceAddress?: string | null
  capabilities: CameraCommandType[]
  report: CameraHostReport
  history: CameraHostSample[]
  commands: CameraCommand[]
}
