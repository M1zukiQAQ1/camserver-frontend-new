export type LiveStreamState = 'offline' | 'starting' | 'live'

export type LiveTelemetry = {
  clientTs?: number | null
  serverTs?: number | null
  latencyMs?: number | null
  pos?: string | null
  updatedAt?: string | null
  ageSeconds?: number | null
  extras?: Record<string, unknown>
}

export type CameraSettings = {
  exposure?: number
  gain?: number
}

export type LiveStatus = {
  live: boolean
  state: LiveStreamState
  message?: string
  viewers?: number
  sessionId?: number
  producer?: string | null
  remoteAddress?: string
  startedAt?: string
  fragmentsReceived?: number
  bytesReceived?: number
  bufferedFragments?: number
  averageKbps?: number
  codecs?: string
  mimeType?: string
  width?: number
  height?: number
  fps?: number
  fragmentDurationMs?: number
  lastFragmentAt?: string
  lastFragmentAgeMs?: number
  streamPositionSeconds?: number
  lastSessionEndedAt?: string
  lastSessionEndReason?: string
  telemetry?: LiveTelemetry
  settings?: CameraSettings
}
