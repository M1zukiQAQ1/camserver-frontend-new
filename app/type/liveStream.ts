export type LiveStreamState = 'offline' | 'starting' | 'live'

export type SeeingHistoryPoint = {
  timestamp: number | null
  status: string
  segment: number
  jitterArcsec?: number | null
  altitudeDeg?: number | null
  driftPxPerMinute?: number | null
  fwhmPx?: number | null
  flux?: number | null
  backgroundRms?: number | null
  durationSeconds?: number
  blockers?: string[]
  resetReason?: string | null
  jitterRmsPx: number | null
  seeingArcsec: number | null
  fluxVariationPercent: number | null
  samples: number
  exposureUs: number | null
  gain: number | null
  sessionId?: string
  connectFromPrevious?: boolean
  records?: number
  calibration?: Record<string, unknown>
}

export type SeeingHistoryResponse = {
  start: string
  end: string
  bucketSeconds: number
  totalRecords: number
  points: SeeingHistoryPoint[]
  storage: 'persistent'
}

export type SeeingTelemetry = SeeingHistoryPoint & {
  historyStorageError?: string | null
  historyPersistent?: boolean
  version: number
  target: 'polaris_roi' | 'unconfirmed_star'
  simulated: boolean
  sampleAgeSeconds: number | null
  requiredSamples: number
  requiredDurationSeconds: number
  windowSeconds: number
  durationSeconds: number
  driftPxPerMinute: number | null
  fwhmPx: number | null
  flux: number | null
  backgroundRms: number | null
  plateScaleArcsecPx: number | null
  resetReason: string | null
  blockers: string[]
  history: SeeingHistoryPoint[]
}

export type LiveTelemetry = {
  clientTs?: number | null
  serverTs?: number | null
  latencyMs?: number | null
  pos?: string | null
  updatedAt?: string | null
  ageSeconds?: number | null
  extras?: Record<string, unknown> & { seeing?: SeeingTelemetry }
}

export type CameraSettings = {
  exposure?: number
  gain?: number
  autoExposure?: boolean
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
