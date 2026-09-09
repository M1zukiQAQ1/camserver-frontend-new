// Shape of GET /api/health (HealthService.HealthReport on the backend).
export type HealthStatus = 'OK' | 'WARN' | 'DOWN' | 'INACTIVE' | 'UNKNOWN'

export interface HostProbe {
  host: string
  address?: string | null
  reachable: boolean
  icmp?: boolean | null
  tcp?: Record<string, boolean>
  latencyMs?: number | null
  error?: string | null
}

export interface LatestFrame {
  imgId: number
  fileName?: string | null
  timestamp: string
  timeZone?: string | null
  exposure: number
  gain: number
  temperature: number
  humidity: number
  isDayTime?: boolean | null
  jpgBytes?: number | null
}

export interface CameraHealth {
  cameraId: string
  siteName: string
  timeZone?: string | null
  status: HealthStatus
  reasons: string[]
  note?: string | null
  monitored: boolean
  latestFrame?: LatestFrame | null
  lastFrameAgeSeconds?: number | null
  framesLast24h?: number | null
  framesLastHour?: number | null
  host?: HostProbe | null
}

export interface SeeingHealth {
  label: string
  status: HealthStatus
  reasons: string[]
  note?: string | null
  live: boolean
  state?: string | null
  producer?: string | null
  remoteAddress?: string | null
  startedAt?: string | null
  lastFragmentAgeMs?: number | null
  fps?: number | null
  averageKbps?: number | null
  width?: number | null
  height?: number | null
  viewers?: number | null
  telemetryAgeSeconds?: number | null
  position?: string | null
  telemetry?: Record<string, unknown>
  settings?: { exposure?: number, gain?: number }
  lastSessionEndedAt?: string | null
  lastSessionEndReason?: string | null
  host?: HostProbe | null
}

export interface ServerHealth {
  status: HealthStatus
  reasons: string[]
  hostname?: string | null
  startedAt?: string | null
  uptimeSeconds?: number | null
  databaseOk: boolean
  databaseError?: string | null
  imagesDir?: string | null
  diskTotalBytes?: number | null
  diskFreeBytes?: number | null
  archive?: Record<string, unknown>
  liveViewers?: number | null
}

export interface HealthReport {
  generatedAt: string
  cacheSeconds: number
  status: HealthStatus
  summary: Record<string, number>
  cameras: CameraHealth[]
  seeing: SeeingHealth
  server: ServerHealth
}
